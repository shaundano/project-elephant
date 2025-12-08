@echo off
:: --- CONFIG ---
set "TARGET_ENV=C:\Users\Administrator\Miniconda3\envs\ocap-env"
set "SCRIPT_ROOT=C:\scripts"
set "PROJECT_ROOT=C:\projects\ocap-dcv-main"

:: --- DLL FIX (CRITICAL FOR BOTO3) ---
:: We force the env's bin folder to the front so SSL libraries load correctly
set "PATH=%TARGET_ENV%\Library\bin;%TARGET_ENV%\Scripts;%TARGET_ENV%;%PATH%"

:: --- 1. STOP RECORDING ---
echo [CLEANUP] Signal Stop to OCAP...
:: Using python from the env to run the stop script
"%TARGET_ENV%\python.exe" "%SCRIPT_ROOT%\stop_ocap.py"

:: --- 2. UPLOAD TO S3 ---
echo [CLEANUP] Processing and Uploading...
:: Navigate to project root just in case, though upload usually handles paths
cd /d "%PROJECT_ROOT%"
"%TARGET_ENV%\python.exe" "%SCRIPT_ROOT%\upload_to_s3.py"

echo [CLEANUP] Done.