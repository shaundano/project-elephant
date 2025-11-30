import os
import boto3
import glob
import sys
import time
import zipfile
import datetime
from botocore.exceptions import ClientError

# --- Configuration ---
RECORDING_FOLDER = r"C:\scripts\temp_recordings"
METADATA_PATH = r"C:\scripts\meeting\metadata.env"
S3_BUCKET = "elephant-bucket-ocap-recordings"
AWS_REGION = "us-west-2" # Match the region used in get_meeting_link.py
# --- End Configuration ---

TABLE_NAME = "elephant-meetings" 


def load_metadata():
    """Reads key-value pairs from the metadata.env file."""
    metadata = {}
    if not os.path.exists(METADATA_PATH):
        print(f"FATAL: Metadata file not found at {METADATA_PATH}. Cannot proceed with upload.")
        sys.exit(1)
    
    with open(METADATA_PATH, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            try:
                key, value = line.split('=', 1)
                metadata[key.strip()] = value.strip()
            except ValueError:
                print(f"Warning: Skipping malformed line in .env file: {line}")
            
    # Validate critical keys
    required_keys = ['USER_ROLE', 'SESSION_ID']
    for key in required_keys:
        if key not in metadata or not metadata[key]:
            print(f"FATAL: Missing or empty critical metadata key: {key}")
            sys.exit(1)
            
    return metadata

def create_archive(metadata, files_to_compress, timestamp):
    """
    Compresses all found files into a single temporary ZIP archive.
    Filename format: [SESSION_ID]_[ROLE]_[TIMESTAMP].zip
    """
    session_id = metadata['SESSION_ID']
    role = metadata['USER_ROLE']
    
    # NEW FILENAME FORMAT: sessionID_role_timestamp.zip
    archive_name = f"{session_id}_{role}_{timestamp}.zip"
    archive_path = os.path.join(RECORDING_FOLDER, archive_name)
    
    print(f"Creating archive: {archive_path}")
    
    try:
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Include the metadata.env file in the zip for diagnostic purposes
            zf.write(METADATA_PATH, os.path.basename(METADATA_PATH))
            print(f"Included metadata file: {os.path.basename(METADATA_PATH)}")
            
            for file_path in files_to_compress:
                # Add file to ZIP, using only the filename as the archive path
                zf.write(file_path, os.path.basename(file_path))
        print(f"Archive created successfully with {len(files_to_compress) + 1} file(s) total.")
        return archive_path, archive_name
    except Exception as e:
        print(f"ERROR creating ZIP archive: {e}")
        return None, None

def upload_and_update_db():
    """Main upload and DB update process."""
    print("Waiting 5 seconds for graceful shutdown...")
    time.sleep(5)
    
    # Generate timestamp immediately after waiting for clean shutdown
    timestamp = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")

    metadata = load_metadata()
    s3_client = boto3.client('s3', region_name=AWS_REGION)
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(TABLE_NAME)
    
    # --- 1. FIND FILES ---
    mcap_files = glob.glob(os.path.join(RECORDING_FOLDER, "*.mcap"))
    mkv_files = glob.glob(os.path.join(RECORDING_FOLDER, "*.mkv"))
    files_to_upload = mcap_files + mkv_files
    
    if not files_to_upload:
        print("S3 Upload: No matching .mcap or .mkv files found. Skipping.")
        return
        
    print(f"S3 Upload: Found {len(files_to_upload)} file(s) to process.")
    
    # --- 2. CREATE ARCHIVE ---
    archive_path, archive_name = create_archive(metadata, files_to_upload, timestamp)
    if not archive_path:
        return
        
    # --- 3. DETERMINE S3 KEY AND URL ---
    role = metadata['USER_ROLE']
    session_id = metadata['SESSION_ID']
    
    # *** FIX: S3 Key is now just the filename (no folder prefix) ***
    s3_key = archive_name
    
    # Construct the public S3 URL (using virtual-hosted style)
    s3_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
    
    # --- 4. UPLOAD ARCHIVE ---
    print(f"Uploading archive to s3://{S3_BUCKET}/{s3_key}...")
    try:
        s3_client.upload_file(archive_path, S3_BUCKET, s3_key)
        print(f"Upload complete. S3 URL: {s3_url}")
        
    except ClientError as e:
        print(f"ERROR uploading to S3: {e}. Check IAM permissions or bucket name.")
        return
        
    # --- 5. UPDATE DYNAMODB ---
    db_field = f"{role}_session_data" # teacher_session_data or student_session_data
    print(f"Updating DynamoDB item {session_id} with field: {db_field}...")
    
    try:
        table.update_item(
            Key={'id': session_id}, 
            # Update only the URL field
            UpdateExpression=f"SET {db_field} = :url_val",
            ExpressionAttributeValues={
                ':url_val': s3_url
            },
            ReturnValues="UPDATED_NEW"
        )
        print("DynamoDB update successful.")
        
    except Exception as e:
        print(f"ERROR updating DynamoDB for ID {session_id}: {e}")
        
    # --- 6. CLEANUP LOCAL FILES ---
    print("Starting local file cleanup...")
    
    # Files to delete: original recordings, the metadata.env, and the zip archive
    files_to_delete = files_to_upload + [METADATA_PATH, archive_path]
    
    for file_path in files_to_delete:
        try:
            os.remove(file_path)
            print(f"Deleted local file: {os.path.basename(file_path)}")
        except Exception as e:
            print(f"Warning: Could not delete {os.path.basename(file_path)}: {e}")


# --- 7. RUN THE UPLOAD ---
if __name__ == "__main__":
    try:
        upload_and_update_db()
        print("Upload script finished.")
    except Exception as e:
        print(f"An unexpected error occurred during the upload process: {e}")
        sys.exit(1)