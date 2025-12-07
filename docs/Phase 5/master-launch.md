# Master Launch, Invisible Shell, and Fallback

We're going to write a few more scripts that are going to perform robust health checks and allow for some pretty cool behaviour in the EC2.

## Master Launch

Next is `master_launch.bat`. This script is basically our sequence of behaviour that needs to happen on login; it kind of replaces the logic of just running OCAP when the user joins.

!!! info "Note - Batch Script Syntax"
    This is a batch script, which kind of sucks in terms of syntax, but bear with me.

Here are a few critical pieces:

```batch
echo [STATUS] Waiting for network...
:CHECK_NET
ping -n 1 8.8.8.8 >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto :CHECK_NET
)
echo [STATUS] Network Online.
```

- This pings Google until it gets a response. It's kind of like a polling to ensure that a new EC2 has an internet connection.

```batch
"%TARGET_ENV%\python.exe" "%SCRIPT_ROOT%\get_meeting_link.py"
```

- This runs the get_meeting_link function, storing metadata in the `meetings` folder

```batch
start /wait "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "%MEETING_URL%" --edge-kiosk-type=fullscreen --no-first-run
```

- This starts the kiosk. Note that in batch, `--` means that these are arguments. `--edge-kiosk-type=fullscreen` is self-evident, but `--no-first-run` makes sure that Edge doesn't go through its usual setup prompts that it would with a new user (what language, make Edge your default browser, can we gather your data, etc.)

```batch
powershell.exe -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\health_check.ps1"
```

- This runs the health check PowerShell script.

```batch
rundll32.exe user32.dll,LockWorkStation
```

- Locks the workstation.

## Invisible Shell

Finally, we have invisible shell. This is going to allow scripts to launch without having the PowerShell or cmd windows obvious to the user. We're gonna write this in VBS, which is an executable that the Registry Editor can execute. Also, hell yeah for Visual Basic!

![VBS Script](../images/Phase 5/Pasted image 20251206214625.png)

This is the VBS script that basically just wraps `master_launch.bat`.

```VBS
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c C:\scripts\master_launch.bat", 0, True
```

- `0` hides the window
- `True` waits for the script to finish, because if you set this as your shell and it finishes, it will just log you off.
- As always, this script goes in `C:\scripts`.

## Registry Editor

So now we have to do some pretty low-level stuff in order to set up the single app. The full Windows OS has a dedicated single-app kiosk mode, but it's not available on Windows Server 2022. We're going to use an application called Registry Editor.

!!! info "Note - Editing Another User's Registry"
    Normally you have to be logged in as the user to edit their registries, but we're going to cheat. You can load in another user's registry by locating `NTUSER.DAT`, which will be at the `C:\Users\KioskUser\` level.

![Registry Editor](../images/Phase 5/Screenshot 2025-12-06 at 9.27.39 PM.png)

Here's what you need to do:

- **Open Regedit:**
    - Press `Win + R`, type `regedit`, and hit Enter.
- **Select the Landing Zone:**
    - Single-click on **`HKEY_USERS`** to highlight it.
- **Load the Hive:**
    - Go to **File > Load Hive...**
    - Navigate to `C:\Users\KioskUser\NTUSER.DAT` (Type filename manually if hidden).
- **Name It:**
    - Enter the Key Name: `Kiosk_Edit`.
- **Expand the Folder:**
    - Double-click `HKEY_USERS` > `Kiosk_Edit`.
- **Navigate to WinLogon (The Step You Added):**
    - Drill down into this specific path: **`Software`** > **`Microsoft`** > **`Windows NT`** > **`CurrentVersion`** > **`Winlogon`**
        
    - _Full Path:_ `Computer\HKEY_USERS\Kiosk_Edit\Software\Microsoft\Windows NT\CurrentVersion\Winlogon`

Once you're in Winlogon, you'll see a bunch of key/value pairs.

!!! warning "Warning - Registry Editing Precision"
    The way this works is that you must be very strict in the names of your keys, and the data you put in. There's not really any compiler here; you're writing very close to assembly code.

Right click and create a new String. Call it Shell. Then modify it, and put in this script:

```plaintext
wscript.exe "C:\scripts\invisible_shell.vbs"
```

This will be our shell script that will totally replace the desktop for KioskUser. When you're done, click the registry and then unload it in the task bar.

![Unload Registry](../images/Phase 5/Screenshot 2025-12-06 at 9.31.05 PM.png)

Now the next time you log in as KioskUser, it should only be able to run this script, which in this case, points to an Edge browser; it could be anything, though.

## Fallback Launch

Last thing in this section: we're going to have a cousin of the `master_launch` script called `fallback_launch`. 

**What this script does:**

- Replaces our scheduled task that triggers on workstation unlock
- Previously, we were just running `powershell.exe ocap.ps1`
- Now we're going to also reboot the kiosk in case a user closed it previously, or just if anything weird happened

(`fallback_launch.bat`)

```batch
tasklist /FI "IMAGENAME eq msedge.exe" 2>NUL | find /I /N "msedge.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [STATUS] Kiosk active. Skipping relaunch.
    goto :LAUNCH_OCAP
)

echo [STATUS] Launching Kiosk...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "%MEETING_URL%" --edge-kiosk-type=fullscreen --no-first-run

:LAUNCH_OCAP
:: --- START RECORDING ---
start "OCAP_RECORDER" powershell.exe -NoExit -WindowStyle Hidden -ExecutionPolicy Bypass -Command "& '%SCRIPT_ROOT%\ocap.ps1'"
```

- What this script does is check if an Edge process is running. If yes, it just skips to start OCAP. If not, it will boot one.
- Then it goes ahead with running OCAP as usual.

We're gonna wrap this in a VBS script just like we did with `master_launch`. Then we're gonna go into Task Scheduler, and go to our Start OCAP task. Simply point to `wscript.exe` as the executable, and the path to the script as the arguments.

![Task Scheduler Configuration](../images/Phase 5/Screenshot 2025-12-07 at 8.18.44 AM.png)

