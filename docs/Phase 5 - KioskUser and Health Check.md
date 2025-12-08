Alright, the time has come for us to set up KioskUser. This is going to be our second user that will only be able to access the jitsi server (or whatever app), while ocap runs in the background and captures desktop inputs.

To do this, we're going to create the user, then we're going to ensure that Task Scheduler is configured for the user, and that it has access to the necessary folders. Then we're going to set it up as a single app kiosk in Registry Edit, but before that, we're going to configure some pretty kickass health check logic which is necessary to ensure that everything is ready to fire when the user logs in.
### Creating the KioskUser

This is quite easy. 

Go to `Run` and look up `lusrmgr.msc`. This stands for Local Users and Groups. It should look like this:

![[Screenshot 2025-12-06 at 9.09.14 PM.png]]

Go ahead and create a `new user`.

![[Screenshot 2025-12-06 at 9.08.19 PM.png]]

Then put in a User name and Password. I went with `KioskUser`. Now, press `ctrl + alt + del` and sign out of `Administrator`. Make sure that you can log into KioskUser. Once you can do that, go back into Administrator.

Within `C:\Users`, you should be able to see KioskUser now. Right off the bat, you're gonna do something that is a bit wack, but works for this setup. You're going to right click on `projects` and `scripts`, click `Properties` and go to `Security`. Then you're going to edit permissions.

![[Screenshot 2025-12-06 at 9.14.42 PM.png]]

Give `KioskUser` full controls. Then do the same thing for the entire `Administrator` folder in `C:\Users`. This whole setup is not super ideal, and you can try avoiding it, but my issue was that I installed Miniconda and my ocap-env in Administrator, so I had to give KioskUser access. This was an easier workaround, and KioskUser will not have access to these folders anyway.

### Editing Task Scheduler

![[Screenshot 2025-12-06 at 9.17.29 PM.png]]

Remember how we configured the tasks to run as Administrator? Just change everything to KioskUser. We will be testing there from now on.

### Master Launcher, Invisible Shell and Health Check

We're going to write a few more scripts that are going to perform robust health checks, and allow for some pretty cool behaviour in the EC2.

(go small to large. Get Meeting Link, then Health Check)

### get_meeting_link.py

First things first, we need get_meeting_link.py in our `scripts` folder, which is going to fetch a meeting link from dynamoDB based on which row has the ec2's instance id.

Here are a few important pieces:

``` python
METADATA_URL = "http://169.254.169.254/latest/meta-data/instance-id"
TABLE_NAME = "elephant-meetings"
AWS_REGION = "us-west-2"

# --- Set the output file path ---
OUTPUT_DIR = r"C:\scripts\meeting"
OUTPUT_METADATA_PATH = os.path.join(OUTPUT_DIR, "metadata.env")
```

- static local variables defining where the metadata is, the name of the dynamoDB table, the region
- `169.254.169.254` is the **Instance Metadata Service (IMDS)**
	- EC2 instances can call it to find out information about themselves from AWS (cool as heck)

``` python
 try:
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(TABLE_NAME)
        
        # Scan for the EC2 ID in either teacher or student field
        response = table.scan(
            FilterExpression=(
	                boto3.dynamodb.conditions.Attr('teacher_ec2_id').eq(instance_id) |       boto3.dynamodb.conditions.Attr('student_ec2_id').eq(instance_id)
            )
        )
```

- This is where we scan for the instance id within dynamoDB

```python
	 role = None
            if item.get('teacher_ec2_id') == instance_id:
                role = 'teacher'
            elif item.get('student_ec2_id') == instance_id:
                role = 'student'
                
            # 2. Extract Data (Use safe defaults if keys are missing)
            metadata = {
                "MEETING_URL": item.get('jitsi_url', 'URL_NOT_FOUND'),
                "USER_ROLE": role,
                # *** FIX: Use 'id' (Primary Key) instead of 'session_id' ***
                "SESSION_ID": item.get('id', 'ID_NOT_FOUND'),
                "TEACHER_NAME": item.get('teacher_name', 'UnknownTeacher'),
                "STUDENT_NAME": item.get('student_name', 'UnknownStudent'),
            }
```

- In the case that there's a match (there should be), we initialize the "role" variable
- Assign the role to either "teacher" or "student"
- Then write the metadata.env file.
- By knowing the session_id and the role, we know exactly where to stick the link to the uploaded data.
- The meeting url will be used to dynamically determine our Jitsi meeting room. Fun fact about Jitsi, meetings are provisioned on the fly, meaning that we don't need to send any HTTP request saying, "hey Jitsi, spin me up a meeting". I can go to meet.jitsi.com/vancouveriscool and it will just be there. Kinda sick.

```python
try:
        # Ensure the directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Write the new .env file
        with open(OUTPUT_METADATA_PATH, 'w') as f:
            for key, value in metadata.items():
                # Write in strict KEY=VALUE format (no spaces)
                f.write(f"{key}={value}\n")
```

- os is the library that allows the function to interact with the environment it is running in. So we're creating the metadata.env file in the location we defined above and writing all the items.

Test this script, the only requisite is that you need a row in dynamoDB with a session_id and the ec2's id in either the teacher or student instance_id column. You can manually put this in easily, which is the upside to dynamoDB.

### Health Check

 Seriously, the health check stuff is one of my favourite parts of the projects. It addresses some key limitations of using an automatically provisioned EC2.

This is basically how an EC2 feels when it is created from an AMI:

![[Pasted image 20251206210603.png]]

The health checks are going to warm everything up, and in the next Phase, we'll ensure that the user can only enter the session once the ec2 is healthy.

So, the health check has a somewhat complicated role in relation to the master launch script we're going to go through next, but for now, we're going to pretend that it is in a bubble. Health check is mainly a powershell script, with a small counterpart in python called update_health.py. I'm not going to explain update_health.py because it basically just writes to the dynamoDB in the row of the session ID the word "Healthy", which is the green light for entering into the EC2.

As I mentioned above, EC2's are slow on startup. Especially PowerShell, which loads a bunch of user profiles and default paths. I tried to eliminate PowerShell entirely from this project, which was faster (using cmd.exe and batch scripts are ways around PowerShell), but I ran into a ton of dynamic link library errors.

![[Screenshot 2025-12-07 at 7.56.19 AM.png]]
(this gives me mild PTSD)

So, we want PowerShell, but we need to run a PowerShell script, actually run all the scripts we're going to use as a dry run before the user ever gets to us.

I will go through the health check PowerShell script now.

```powershell
conda activate ocap-env
$OcapProc = Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass", "-File C:\scripts\ocap.ps1" -WindowStyle Hidden -PassThru
```

- This is basically a powershell script running a powershell script. Activating conda is probably not necessary because we do the same thing in ocap.ps1, but oh well. Get rid of it if you want.

```PowerShell
$Timeout = 60
$Timer = [System.Diagnostics.Stopwatch]::StartNew()
$FileDetected = $false

while ($Timer.Elapsed.TotalSeconds -lt $Timeout) {
    # Check if .mcap or .mkv exists in the temp folder
    if (Test-Path "C:\scripts\temp_recordings\*.mcap" -PathType Leaf) {
        $FileDetected = $true
        break
    }
    if (Test-Path "C:\scripts\temp_recordings\*.mkv" -PathType Leaf) {
        $FileDetected = $true
        break
    }
    Start-Sleep -Seconds 1
}
```

- This is what I would call a Smart Waiter. The previous step runs OCAP as a dry run, but how do we know when to kill it? Do we just sleep for 30 seconds? 60 seconds? Hell no. We know that once OCAP starts, it sticks the files it is streaming to in our directory `temp_recordings`. So all we have to do is poll that folder until the files show up, and we know that OCAP is running. If you took CPSC 213 at UBC, you might be thinking, "Couldn't we have OCAP send an interrupt to the health check script, or use threads to block the current process until OCAP is done starting up"? Sure. I welcome contributions.

``` PowerShell
python "C:\scripts\stop_ocap.py"
if ($OcapProc) {
    $OcapProc | Wait-Process -Timeout 15 -ErrorAction SilentlyContinue
}
$RecDir = "C:\scripts\temp_recordings"
if (Test-Path $RecDir) {
    Get-ChildItem -Path $RecDir -Include *.* -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue
}

python "C:\scripts\update_health.py"
```

- calls our stop script
- If the OCAP process defined above (first code chunk) is still running, wait another 15 seconds, wait for it to terminate.
- Remove the items in temp_recordings
- Run the update health script that writes "healthy" to DynamoDB

You should be able to test this whole thing. Make the status in your test row in dynamoDB something like "unhealthy", run health check. It should be able to write "healthy", and you should also see OCAP startup and get terminated.

Next is master_launch.bat. This script is basically our sequence of behaviour that needs to happen on login; it kind of replaces the logic of just running ocap when the user joins. Also, this is a batch script, which kind of sucks in terms of syntax, but bear with me.

here are a few critical pieces:

``` batch
echo [STATUS] Waiting for network...
:CHECK_NET
ping -n 1 8.8.8.8 >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto :CHECK_NET
)
echo [STATUS] Network Online.
```

- this pings Google until it gets a response. It's kind of like a polling to ensure that a new EC2 has an internet connection.

``` batch
"%TARGET_ENV%\python.exe" "%SCRIPT_ROOT%\get_meeting_link.py"
```

- this runs the get_meeting_link function, storing metadata in the `meetings` folder

``` batch
start /wait "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "%MEETING_URL%" --edge-kiosk-type=fullscreen --no-first-run
```

- this starts the kiosk. Note that in batch, --words means that these are arguments. --edge-kiosk-type=fullscreen is self-evident, but the other one just makes sure that Edge doesn't go through its usual shebang that it would with a new user (what language, make Edge your default browser, can we gather your data, etc.)

``` batch
powershell.exe -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\health_check.ps1"
```

- this runs the health check powershell script.

``` batch
rundll32.exe user32.dll,LockWorkStation
```

- locks the workstation.

Finally, we have invisible shell. This is going to allow scripts to launch without having the powershell or cmd windows obvious to the user. We're gonna write this in VBS, which is an executable that the Registry Editor can execute. Also, hell yeah for Visual Basic!

![[Pasted image 20251206214625.png]]

This is the VBS script that basically just wraps master_launch.bat.

``` VBS
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c C:\scripts\master_launch.bat", 0, True
```

- 0 hides the window
- True waits for the script to finish, because if you set this as your shell and it finishes, it will just log you off.
- As always, this script goes in `C:\scripts`.
### Registry Editor

So now we have to do some pretty low-level stuff in order to set up the single app. The full Windows OS has a dedicated single-app kiosk mode, but it's not available on Windows Server 2022. We're going to use an application called Registry Editor.

Now, normally you have to be logged in as the user to edit their registries, but we're going to cheat. You can load in another user's registry by locating `NTUSER.DAT`, which will be at the `C:\` level

![[Screenshot 2025-12-06 at 9.27.39 PM.png]]

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

Once you're in Winlogon, you'll see a bunch of key/value pairs. The way this works is that you must be very strict in the names of your keys, and the data you put in. There's not really any compiler here; you're writing very close to assembly code.

Right click and create a new String. Call it Shell. Then modify it, and put in this script:

``` plaintext
wscript.exe "C:\scripts\invisible_shell.vbs"
```

This will be our shell script that will totally replace the desktop for KioskUser. When you're done, click the registry and then unload it in the task bar.

![[Screenshot 2025-12-06 at 9.31.05 PM.png]]

Now the next time you log in as KioskUser, it should only be able to run this script, which in this case, points to an Edge browser; it could be anything, though.

Last thing in this section: we're going to have a cousin of the master_launch script called fallback launch. What this is going to do is replace our scheduled task that triggers on workstation unlock. Previously, we were just running `powershell.exe ocap.ps1`. We're going to also reboot the kiosk in case a user closed it previously, or just if anything weird happened.

(fallback_launch.bat)

```PowerShell
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

- what this script does is check if an Edge process is running. If yes, it just skips to start OCAP. If not, it will boot one.
- Then it goes ahead with running OCAP as usual.

We're gonna wrap this is a VBS script just like we did with master_launch. Then we're gonna go into Task Scheduler, and go to our Start OCAP task. Simply point to `wscript.exe`as the executable, and the path to the script as the arguments.

![[Screenshot 2025-12-07 at 8.18.44 AM.png]]

Now, we have one thing left to do. We're going to configure AutoLogon for KioskUser in Registry Editor. This means that the moment that an EC2 boots up, before the user even enters, it's going to log into KioskUser and run our VBS-wrapped master_launch script. This means the whole health check, etc. Then when the user actually logs in, the kiosk will be waiting for them, and if not, the fallback script will reboot it. OCAP will trigger no matter what. I can't stress how necessary this is: on first boot up of an EC2, you can legitimately be waiting 2-3 minutes on a black screen until you see any sign of life, and that does not go away by just letting the EC2 stay idle. It MUST load user profiles into PowerShell, load the conda environment, etc.

Here's how to configure AutoLogon for KioskUser:

1. Press **Win + R**, type `regedit`, and press **Enter**.
2. Navigate to the following path:
    HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon
3. Modify (or create) the following **String Values (REG_SZ)**:
    
| **Value Name**        | **Value Data**           | **Note**                                                                             |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| **AutoAdminLogon**    | `1`                      | Enables the feature.                                                                 |
| **DefaultUserName**   | `KioskUser`              | The target account.                                                                  |
| **DefaultPassword**   | _(Your Actual Password)_ | **Must be the real password.**                                                       |
Note that last time, we were configuring for a specific user, hence HKEY_USERS. This is LOCAL_MACHINE, so it's machine wide.

A side inconvenience is that now, when you boot up the ec2, you'll be logged into KioskUser by default. Just hit `ctrl + alt + del` and Sign Out, switching back into Administrator.

Here's the full flow:

- EC2 boots up
- AutoLogon logs in as KioskUser
- VBS-wrapped master_launch runs, doing the whole health check and booting up the actual Edge kiosk
- When the health check finishes, writes Healthy to the DynamoDB and locks the workstation.
- User logs in, triggering the VBS-wrapped fallback script
- OCAP starts

And that's it. You've configured KioskUser as a single app kiosk, triggered the master_launch and health check.
