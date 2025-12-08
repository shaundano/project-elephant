@echo off
setlocal EnableDelayedExpansion

set "TARGET_ENV=C:\Users\Administrator\Miniconda3\envs\ocap-env"
set "SCRIPT_ROOT=C:\scripts"
set "META_FILE=%SCRIPT_ROOT%\meeting\metadata.env"

:: --- 1. SMART STABILIZE (Wait for Internet) ---
:: Instead of sleeping 30s, we loop until we can reach the outside world.
:: This ensures python doesn't crash trying to hit DynamoDB.
echo [STATUS] Waiting for network...
:CHECK_NET
ping -n 1 8.8.8.8 >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto :CHECK_NET
)
echo [STATUS] Network Online.

:: --- 2. GET MEETING DATA ---
echo [STATUS] Fetching Link...
"%TARGET_ENV%\python.exe" "%SCRIPT_ROOT%\get-meeting-link.py"

:: Parse the link from the file
if exist "%META_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%META_FILE%") do (
        if "%%A"=="MEETING_URL" set "MEETING_URL=%%B"
    )
)
if "%MEETING_URL%"=="" set "MEETING_URL=https://meet.christardy.com/default"

:: --- 3. LAUNCH KIOSK (Non-Blocking) ---
:: Start Edge now so it loads while we run the health check.
echo [STATUS] Launching Kiosk...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "%MEETING_URL%" --edge-kiosk-type=fullscreen --no-first-run

:: --- 4. HEALTH CHECK (Blocking) ---
:: Warms .NET and writes "HEALTHY" to DynamoDB.
echo [STATUS] Running Health Check...
powershell.exe -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\health-check.ps1"

:: --- 5. SECURE THE ROOM ---
:: System is warm, healthy, and rendering Jitsi. Lock it up.
echo [STATUS] Locking Workstation...
rundll32.exe user32.dll,LockWorkStation