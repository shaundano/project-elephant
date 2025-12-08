# Health Check

!!! tip "Awesome - Health Check System"
    Seriously, the health check stuff is one of my favourite parts of the projects. It addresses some key limitations of using an automatically provisioned EC2.

This is basically how an EC2 feels when it is created from an AMI:

![EC2 Startup](../images/Phase 5/Pasted image 20251206210603.png)

The health checks are going to warm everything up, ensuring that the EC2 is ready when users connect.

!!! info "Note - What is Health Check?"
    Health check is mainly a PowerShell script, with a small counterpart in Python called `update_health.py`. The Python script simply writes "Healthy" to DynamoDB in the row of the session ID, which is the green light for entering into the EC2.

The health check has a somewhat complicated role in relation to the master launch script we're going to go through next, but for now, we're going to pretend that it is in a bubble.

As mentioned above, EC2's are slow on startup. Especially PowerShell, which loads a bunch of user profiles and default paths. I tried to eliminate PowerShell entirely from this project, which was faster (using `cmd.exe` and batch scripts are ways around PowerShell), but I ran into a ton of dynamic link library errors.

![DLL Errors](../images/Phase 5/Screenshot 2025-12-07 at 7.56.19 AM.png)

!!! warning "Warning - PowerShell Required"
    So, we want PowerShell, but we need to run a PowerShell script—actually run all the scripts we're going to use as a dry run before the user ever gets to us. This "warming up" process is critical for performance.

I will go through the health check PowerShell script now.

```powershell title="Start OCAP Process"
conda activate ocap-env
$OcapProc = Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass", "-File C:\scripts\ocap.ps1" -WindowStyle Hidden -PassThru
```

- This is basically a PowerShell script running a PowerShell script. Activating conda is probably not necessary because we do the same thing in ocap.ps1, but oh well. Get rid of it if you want.

```powershell title="Smart Waiter"
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

- This is what I would call a **Smart Waiter**. The previous step runs OCAP as a dry run, but how do we know when to kill it? Do we just sleep for 30 seconds? 60 seconds? Hell no.

!!! info "Note - How the Smart Waiter Works"
    We know that once OCAP starts, it sticks the files it is streaming to in our directory `temp_recordings`. So all we have to do is poll that folder until the files show up, and we know that OCAP is running. If you took CPSC 213 at UBC, you might be thinking, "Couldn't we have OCAP send an interrupt to the health check script, or use threads to block the current process until OCAP is done starting up"? Sure. I welcome contributions.

```powershell title="Cleanup and Update Health"
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

- Calls our stop script
- If the OCAP process defined above (first code chunk) is still running, wait another 15 seconds for it to terminate
- Remove the items in `temp_recordings`
- Run the update health script that writes "healthy" to DynamoDB

!!! note "Testing - Health Check"
    You should be able to test this whole thing. Make the status in your test row in DynamoDB something like "unhealthy", then run health check. It should be able to write "healthy", and you should also see OCAP startup and get terminated.

