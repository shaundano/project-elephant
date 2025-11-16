elephant-scripts
=================

A small collection of utility scripts for kiosk/OCAP workflows and transferring recordings to S3.

Contents
--------
- `start-kiosk`: Launches kiosk mode (e.g., a browser or app locked fullscreen) for a managed station.
- `start-ocap`: Starts an OCAP capture/recording session and writes a PID file under `pid/`.
- `stop-ocap.py`: Stops a running OCAP session using the stored PID and handles cleanup.
- `upload-to-s3.py`: Uploads local recordings (e.g., from `temp_recordings/`) to an S3 bucket.
- `pid/`: Directory to store PID files for managed processes.
- `temp_recordings/`: Staging area for temporary recordings prior to upload.


Prerequisites
-------------
- Windows OS
- Python 3.9+ (for the `*.py` scripts)
- AWS credentials configured (for S3 uploads), e.g. via:
  - `aws configure` using `awscli`, or
  - environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_DEFAULT_REGION`


Quick start
-----------
1) Make scripts executable:
```bash
chmod +x start-kiosk start-ocap
```

2) Start kiosk or OCAP:
```bash
./start-kiosk
./start-ocap
```

3) Stop OCAP when done:
```bash
python3 stop-ocap.py
```

4) Upload recordings to S3:
```bash
python3 upload-to-s3.py
```


Configuration
-------------
- S3 settings, input/output folders, and any endpoint or device-specific flags can be wired into `upload-to-s3.py` and `start-ocap` as needed.
- Ensure `pid/` exists and is writable so process IDs can be tracked.
- Ensure `temp_recordings/` exists if your workflow creates local artifacts before upload.


