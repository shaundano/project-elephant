elephant-scripts
=================

A collection of utility scripts for managing OCAP recording sessions, kiosk workflows, and transferring recordings to S3 for EC2-based meeting stations.

Contents
--------
**Main Scripts:**
- `master-launch`: Main orchestration script that fetches meeting links, starts OCAP recording, and launches Edge in kiosk mode.
- `fallback_launch.bat`: Recovery-mode launcher that checks if Edge is already running before launching kiosk mode.
- `ocap`: PowerShell script that starts OCAP recording with timestamped session paths.
- `health_check`: PowerShell script that performs a health check workflow: warms up .NET, starts OCAP, waits for recording artifacts, stops OCAP, cleans up, and signals the database.
- `get-meeting-link.py`: Fetches meeting metadata (URL, session ID, role) from DynamoDB based on EC2 instance ID.
- `stop-ocap.py`: Stops a running OCAP session by sending Ctrl+C signal to the process using the stored PID.
- `update_health.py`: Updates DynamoDB to signal that a session is HEALTHY.
- `upload-to-s3.py`: Uploads local recordings to S3, creates ZIP archives with metadata, and updates DynamoDB with S3 URLs.

**Helper Scripts:**
- `invisible_shell.vbs`: VBScript wrapper to run `master-launch` invisibly.
- `invisible_fallback.vbs`: VBScript wrapper to run `fallback_launch.bat` invisibly.

**Directories:**
- `pid/`: Directory to store PID files for managed processes.
- `temp_recordings/`: Staging area for temporary recordings prior to upload.
- `old_scripts/`: Contains legacy/redundant scripts (deprecated).


Prerequisites
-------------
- Windows OS
- Python 3.9+ (for the `*.py` scripts)
- Conda environment with `ocap-env` activated
- AWS credentials configured (for S3 uploads and DynamoDB access), e.g. via:
  - `aws configure` using `awscli`, or
  - environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_DEFAULT_REGION`
- EC2 instance with metadata service access (for instance ID detection)
- DynamoDB table `elephant-meetings` in `us-west-2` region
- S3 bucket `elephant-bucket-ocap-recordings` in `us-west-2` region


Quick start
-----------
1) Start a full recording session:
```bash
master-launch
```
or use the invisible wrapper:
```bash
cscript invisible_shell.vbs
```

2) Stop OCAP when done:
```bash
python stop-ocap.py
```

3) Upload recordings to S3:
```bash
python upload-to-s3.py
```

4) Run health check workflow:
```powershell
powershell -ExecutionPolicy Bypass -File health_check
```


Configuration
-------------
- Script paths are configured for `C:\scripts\` by default. Update paths in scripts as needed.
- Conda environment path is set to `C:\Users\Administrator\Miniconda3\envs\ocap-env` in batch scripts.
- Ensure `pid/` exists and is writable so process IDs can be tracked.
- Ensure `temp_recordings/` exists for recording artifacts.
- Ensure `meeting/` directory exists for metadata storage (created automatically by `get-meeting-link.py`).
- AWS region and table/bucket names are configured in the Python scripts (default: `us-west-2`).


