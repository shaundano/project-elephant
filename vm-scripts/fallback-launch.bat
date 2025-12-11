@echo off
setlocal EnableDelayedExpansion

:: --- CONFIG ---
set "TARGET_ENV=C:\Users\Administrator\Miniconda3\envs\ocap-env"
set "SCRIPT_ROOT=C:\scripts"
set "META_FILE=%SCRIPT_ROOT%\meeting\metadata.env"

:: --- 1. CHECK EXISTING KIOSK ---
tasklist /FI "IMAGENAME eq msedge.exe" 2>NUL | find /I /N "msedge.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [STATUS] Kiosk active. Skipping relaunch.
    goto :LAUNCH_OCAP
)

:: =========================================================
:: RECOVERY MODE
:: =========================================================

:: --- CLEANUP & SETUP ---
taskkill /F /IM msedge.exe >nul 2>&1
echo [STATUS] Fetching Link...
:: OPTIONAL: Use pythonw.exe if python.exe still flickers, but usually not needed here
"%TARGET_ENV%\python.exe" "%SCRIPT_ROOT%\get_meeting_link.py"

:: --- READ LINK ---
if exist "%META_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%META_FILE%") do (
        if "%%A"=="MEETING_URL" set "MEETING_URL=%%B"
    )
)
if "%MEETING_URL%"=="" set "MEETING_URL=https://meet.christardy.com/default"

:: --- LAUNCH EDGE ---
echo [STATUS] Launching Kiosk...
:: We KEEP 'start' here because Edge is a GUI app and we want the script to proceed
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "%MEETING_URL%" --edge-kiosk-type=fullscreen --no-first-run

:: =========================================================
:: ALWAYS RUN: Start Recording
:: =========================================================
:LAUNCH_OCAP
:: --- START RECORDING ---
powershell.exe -NoExit -WindowStyle Hidden -ExecutionPolicy Bypass -Command "& '%SCRIPT_ROOT%\ocap.ps1'"