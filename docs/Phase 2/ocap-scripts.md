# OCAP Scripts

Now we're going to set up OCAP such that upon workstation unlock, it will run, and then upon lock (when the user leaves the DCV session), it will stop the OCAP script and upload to your S3 bucket.

## Creating the OCAP Start Script

Go back to your EC2. And go to the Notepad. You're going to write the following script:

```powershell title="ocap.ps1"
# 1. Activate your environment
conda activate ocap-env

# 2. Create the timestamped name
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$baseName = "session_$($timestamp)"

# 3. Create the full path in your required folder
$fullPath = Join-Path -Path "C:\scripts\temp_recordings" -ChildPath $baseName

# 4. Run the ocap command with the full path
ocap $fullPath
```

Then save this as `ocap.ps1`, and ensure that you save as "All files". Save it in your `scripts` folder at the `C:\` level. This is a PowerShell script that, when run, will run OCAP and write to your temp_recordings folder.

### How to Test

- Activate your conda environment, `ocap-env` in PowerShell
- Navigate to `C:/scripts`
- Run `./ocap`

This should work.

## Creating the Stop Script

The stop_ocap script is a Python script that looks for the PID written by the OCAP program and sends a SIGINT (if any of this is confusing to you, go back and read [Fork Discussion](fork-discussion.md) in Phase 1).

I'm not going to provide the full stop script here (it should be in the repo), and I explain it in Fork Discussion. I will just go through some quick points.

```python title="stop_ocap.py"
# --- 1. Set the correct path to your PID file ---
PID_FILE = r"C:\scripts\pid\ocap.pid"

# --- 2. Define Windows API functions ---
kernel32 = ctypes.windll.kernel32
CTRL_C_EVENT = 0
```

- Finds the PID file
- Kernel32 is a low-level Windows API
- CTRL_C_EVENT is a static local variable

```python title="stop_ocap.py"
try:
    with open(PID_FILE, "r") as f:
        pid = int(f.read().strip())
```

- Program finds the PID

```python title="stop_ocap.py"
kernel32.FreeConsole()
kernel32.AttachConsole(pid)
kernel32.SetConsoleCtrlHandler(None, True)
kernel32.GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0)
kernel32.FreeConsole()
kernel32.SetConsoleCtrlHandler(None, False)
```

- Detach from this program's console
- Attach to the PID's console
- Disable Ctrl + C in this process. Even though we detached, AttachConsole(pid) adds current process to the pid's console which still opens us up
- Generate Ctrl + C event and send to all processes in the console
- Detach from PID's console
- Re-enable Ctrl + C on this process

## Creating the Upload Script

In `C:\scripts`, you're going to add the `upload_to_s3.py` script. Now, again this script is in the repo, but I will describe a few of the lines.

```python title="upload_to_s3.py"
import boto3
```

You will probably need to install boto3 into your conda environment. Just run:

```python title="Install boto3"
pip install boto3
```

```python title="upload_to_s3.py"
RECORDING_FOLDER = r"C:\scripts\temp_recordings"
S3_BUCKET = "elephant-bucket-ocap-recordings"
AWS_REGION = "us-west-2" # Match the region used in get_meeting_link.py
```

- Sets static local variables for where to find the recordings, the S3 bucket name, and the region it's located in.

```python title="upload_to_s3.py"
mcap_files = glob.glob(os.path.join(RECORDING_FOLDER, "*.mcap"))
mkv_files = glob.glob(os.path.join(RECORDING_FOLDER, "*.mkv"))
files_to_upload = mcap_files + mkv_files

# Construct the public S3 URL (using virtual-hosted style)
s3_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
s3_client.upload_file(archive_path, S3_BUCKET, s3_key)
```

- Finds the files to upload and uploads them

## Testing All Scripts

Try all three steps now: run OCAP, stop it via `stop_ocap.py` and then upload the data via `upload_to_s3.py`. If this does not work, there are a ton of debug lines within the scripts themselves, hopefully that helps. This part shouldn't be that bad, however.

Put `stop_ocap.py` at the same level as your `ocap.ps1` PowerShell script. Run OCAP the same way you did above. You should see the pid file get written in `scripts/pid`. Let OCAP run for a few seconds, and then run:

```python title="Test stop_ocap.py"
python ./stop_ocap.py
```

You should see your OCAP script get terminated gracefully. You'll know that it terminated gracefully if in `temp_recordings`, both your MCAP and MKV videos will not be 0 B large. As a rough rule, whatever MCAP is in KB, MKV will be in MB.

!!! note "Script Dependencies"
    Keep in mind that the scripts in the repo include steps that we haven't completed yet: we haven't even touched DynamoDB. So if you're getting errors related to stuff we haven't set up yet, just comment out those lines; I tried to make things reasonably modular.

---

**Next: [Task Scheduler →](task-scheduler.md)**

