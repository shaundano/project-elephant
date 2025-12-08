@echo off
setlocal EnableDelayedExpansion

:: --- CONFIG ---
set "TARGET_ENV=C:\Users\Administrator\Miniconda3\envs\ocap-env"
set "SCRIPT_ROOT=C:\scripts"
set "META_FILE=%SCRIPT_ROOT%\meeting\metadata.env"

:: --- 1. CHECK EXISTING KIOSK ---
:: If Edge is running, we skip the Kiosk launch logic entirely and go straight to OCAP.
tasklist /FI "IMAGENAME eq msedge.exe" 2>NUL | find /I /N "msedge.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [STATUS] Kiosk active. Skipping relaunch.
    goto :LAUNCH_OCAP
)

:: =========================================================
:: RECOVERY MODE: Only runs if Edge was NOT found
:: =========================================================

:: --- CLEANUP & SETUP ---
taskkill /F /IM msedge.exe >nul 2>&1
echo [STATUS] Fetching Link...
"%TARGET_ENV%\python.exe" "%SCRIPT_ROOT%\get_meeting_link.py"

:: --- READ LINK ---
if exist "%META_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%META_FILE%") do (
        if "%%A"=="MEETING_URL" set "MEETING_URL=%%B"
    )
)
if "%MEETING_URL%"=="" set "MEETING_URL=https://meet.christardy.com/default"

:: --- LAUNCH EDGE (NON-BLOCKING) ---
echo [STATUS] Launching Kiosk...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "%MEETING_URL%" --edge-kiosk-type=fullscreen --no-first-run

:: =========================================================
:: ALWAYS RUN: Start Recording
:: =========================================================

:LAUNCH_OCAP
:: --- START RECORDING (Transcript Mode) ---
:: 1. Start-Transcript: Writes to file AND shows on screen.
:: 2. No piping/redirection in Batch, so no stalls.
start "OCAP_RECORDER" powershell.exe -NoExit -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Start-Transcript -Path 'C:\scripts\ocap_debug.log' -Append; & '%SCRIPT_ROOT%\ocap.ps1'"