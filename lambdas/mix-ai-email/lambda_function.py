import json
import os
import boto3
import subprocess
import glob
import zipfile
import time
import google.generativeai as genai
from botocore.exceptions import ClientError
from urllib.parse import urlparse
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# --- CONFIG ---
OUTPUT_BUCKET = "elephant-bucket-ai-summaries"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

s3 = boto3.client('s3')
ses = boto3.client('ses')


def lambda_handler(event, context):
    print("Elephant Lambda Waking Up...")

    for record in event['Records']:
        if record['eventName'] in ['INSERT', 'MODIFY']:
            try:
                # 1. Parse DynamoDB (Looking for 'teacher_session_data' S3 link)
                new_image = record['dynamodb']['NewImage']

                # Extract the S3 URL from the DynamoDB Map
                # Adjust key access based on your exact schema
                s3_url = new_image.get('teacher_session_data', {}).get('S', '')

                # Attempt to get email, fallback to empty string
                email = new_image.get('teacher_email', {}).get('S', '')
                
                # Early exit if no teacher email - skip all processing to save costs
                if not email:
                    print("No teacher email found, skipping lambda")
                    continue
                
                # Attempt to get student name, fallback to generic to prevent errors
                student_name = new_image.get('student_name', {}).get('S', 'Student')

                # --- NEW PARSING LOGIC START ---
                if not s3_url:
                    print("Skipping: Empty URL")
                    continue

                if s3_url.startswith('s3://'):
                    # Handle "s3://bucket/key"
                    parts = s3_url.replace("s3://", "").split("/", 1)
                    input_bucket = parts[0]
                    input_key = parts[1]
                
                elif s3_url.startswith('https://'):
                    # Handle "https://bucket.s3.region.amazonaws.com/key"
                    parsed = urlparse(s3_url)
                    # netloc is "bucket.s3.region.amazonaws.com"
                    # We split by '.' to get the bucket name
                    input_bucket = parsed.netloc.split('.')[0]
                    input_key = parsed.path.lstrip('/') # Remove leading slash
                
                else:
                    print(f"Skipping: Invalid S3 URL format: {s3_url}")
                    continue
                # --- NEW PARSING LOGIC END ---

                print(f"Processing: {input_key} from {input_bucket}")
                process_session(input_bucket, input_key, email, student_name)

            except Exception as e:
                print(f"Error processing record: {e}")
                continue

    return {"statusCode": 200, "body": "Processing Complete"}


def process_session(bucket, key, teacher_email, student_name):
    # Paths
    local_zip = "/tmp/session.zip"
    extract_dir = "/tmp/extracted"
    local_fused = "/tmp/fused.mkv"  # Keeping MKV container since we fuse audio

    # Clean /tmp to prevent space issues
    subprocess.run("rm -rf /tmp/*", shell=True)
    os.makedirs(extract_dir, exist_ok=True)

    # A. Download ZIP
    print(f"Downloading {key}...")
    s3.download_file(bucket, key, local_zip)

    # B. Unzip & Find MKV
    print("Unzipping...")
    with zipfile.ZipFile(local_zip, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)

    # Find the first .mkv file in the extracted folder
    mkv_files = glob.glob(f"{extract_dir}/*.mkv")
    if not mkv_files:
        print("No MKV file found inside the ZIP.")
        return
    local_input_mkv = mkv_files[0]
    print(f"Found input video: {local_input_mkv}")

    # C. Fuse Audio (The Simplified Logic)
    print("Fusing audio tracks...")
    success = fuse_audio_tracks(local_input_mkv, local_fused)

    if not success:
        print("Fusing failed, aborting.")
        return

    # D. Gemini Processing
    print("Uploading to Gemini...")
    video_file = genai.upload_file(path=local_fused)

    # Poll for active state
    while video_file.state.name == "PROCESSING":
        print("Waiting for Gemini processing...")
        time.sleep(5)
        video_file = genai.get_file(video_file.name)

    if video_file.state.name == "FAILED":
        print("Gemini processing failed.")
        return

    # E. Generate HTML Report
    print("Generating Analysis...")
    model = genai.GenerativeModel(model_name="gemini-flash-latest")

    prompt = """
    You are an expert educational analyst. 
    Analyze the video and generate a **formatted HTML email body** for the student.
    
    STYLING:
    - Use inline CSS (e.g., <div style='font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;'>).
    - Header: '🐘 Elephant Session Report' (Green background #4CAF50, white text).
    - Content: Executive Summary, What We Covered (Bullets), Cheatsheet (HTML Table with Question, Student Response, Correctness), Areas for the Student to Improve.
    - No Markdown. No LaTeX. Raw HTML only.
    """

    response = model.generate_content([video_file, prompt])
    html_content = response.text

    # --- FIX: Clean up Markdown tags ---
    # Gemini often wraps HTML in ```html ... ```. We must remove them.
    html_content = html_content.replace("```html", "").replace("```", "").strip()

    # F. Save to New Summary Bucket
    # Create a nice filename based on the input key
    # e.g., session123.zip -> session123_report.html
    base_name = os.path.splitext(os.path.basename(key))[0]
    output_key = f"{base_name}_report.html"

    print(f"Saving report to {OUTPUT_BUCKET}/{output_key}...")
    s3.put_object(
        Bucket=OUTPUT_BUCKET,
        Key=output_key,
        Body=html_content,
        ContentType='text/html'
    )

    # G. Send Email
    if teacher_email:
        print(f"Sending email to {teacher_email}...")
        send_email_via_ses(teacher_email, html_content, student_name)

    # Cleanup
    genai.delete_file(video_file.name)


# --- SIMPLIFIED FUSER LOGIC ---
def fuse_audio_tracks(input_path, output_path):
    """
    Scans the input MKV for ALL audio streams and mixes them into one.
    Adapted from your script: stripped of watchdog/argparse.
    """
    try:
        # 1. FFprobe: Find all audio tracks
        cmd_probe = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_streams', str(input_path)
        ]
        result = subprocess.run(cmd_probe, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)

        # Count audio streams
        audio_indices = []
        audio_stream_counter = 0

        for stream in data.get('streams', []):
            if stream.get('codec_type') == 'audio':
                # We track the index relative to audio streams for the filter [0:a:N]
                audio_indices.append(audio_stream_counter)
                audio_stream_counter += 1

        print(f"Found {len(audio_indices)} audio tracks.")

        # 2. Build FFmpeg Command
        ffmpeg_cmd = ['ffmpeg', '-y', '-i', str(input_path)]

        if len(audio_indices) > 1:
            # Complex Mix: [0:a:0][0:a:1]amix=inputs=2[out]
            inputs = "".join([f"[0:a:{i}]" for i in audio_indices])
            filter_complex = f"{inputs}amix=inputs={len(audio_indices)}[a_out]"

            ffmpeg_cmd.extend(['-filter_complex', filter_complex])
            ffmpeg_cmd.extend(['-map', '0:v', '-map', '[a_out]'])  # Map original video + mixed audio

        else:
            # Simple Case: 0 or 1 track. Just downmix to mono to be safe.
            # -ac 1 mixes stereo to mono
            ffmpeg_cmd.extend(['-ac', '1'])
            # Note: If 0 tracks, this might warn, but usually safe for Gemini (it reads visual)

        # Common Output Settings
        ffmpeg_cmd.extend([
            '-c:v', 'copy',   # Don't re-encode video (Speed!)
            '-c:a', 'aac',    # AAC for audio
            '-b:a', '192k',
            str(output_path)
        ])

        subprocess.run(ffmpeg_cmd, check=True)
        return True

    except Exception as e:
        print(f"Fuser Error: {e}")
        return False


def send_email_via_ses(recipient, html_body, student_name):
    # 1. Configuration
    sender = "Elephant AI <christardy99@gmail.com>"
    subject = f"Your Tutoring Session Recap with {student_name}"
    aws_region = os.getenv("AWS_REGION", "us-east-1")
    
    # 2. Specific 'List-Unsubscribe' header values
    # Ideally, provide both a mailto and a click link.
    # The 'mailto' is often preferred by automated systems.
    unsub_link = "https://example.com/unsubscribe?user=123"
    unsub_header = f"<{unsub_link}>, <mailto:unsubscribe@yourdomain.com>"

    # 3. Create the MIME container
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = recipient
    
    # --- CRITICAL: Add the List-Unsubscribe Header ---
    msg.add_header('List-Unsubscribe', unsub_header)
    # Optional: 'List-Unsubscribe-Post' tells clients like Gmail you support one-click
    msg.add_header('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click')

    # 4. Define the HTML Body with the Footer
    # We append the footer logic here
    full_html = f"""
    <html>
    <head></head>
    <body>
      {html_body}
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-family: sans-serif; font-size: 12px; color: #888888; text-align: center;">
          <p>You are receiving this email because you used Project Elephant.</p>
          <p>
            <strong>Project Elephant</strong><br>
            1234 Innovation Drive, Suite 100<br>
            Vancouver, BC, V6T 1Z4, Canada
          </p>
          <p>
            <a href="https://example.com/privacy" style="color: #888888;">Privacy Policy</a> | 
            <a href="{unsub_link}" style="color: #888888;">Unsubscribe</a>
          </p>
      </div>
      </body>
    </html>
    """

    # 5. Attach the body
    part = MIMEText(full_html, 'html')
    msg.attach(part)

    # 6. Send via SES using send_raw_email
    try:
        response = ses.send_raw_email(
            Source=sender,
            Destinations=[recipient],
            RawMessage={
                'Data': msg.as_string(),
            }
        )
        print("Email sent! Message ID:", response['MessageId'])
        return True
    except ClientError as e:
        print(f"SES Error: {e}")
        return False