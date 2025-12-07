# Task Scheduler

**I'm gonna just say this right now**: Task Scheduler is pretty easy to set up, however the settings are quite important. If you are too liberal with how you set this up, there's a strong chance something will not work.

## Setting Up Task 1: Start OCAP

Open Task Scheduler on your EC2. We're going to set up two tasks. The first one is going to Start OCAP. Go to the right hand side in Task Scheduler, and select "Create Task". You should be staring at a screen like this:

![Task Scheduler Create Task](../images/Phase 2/Screenshot 2025-12-06 at 8.04.33 PM.png)

### Configuring the Trigger

First off, go to "Triggers". This will decide how our task will be... triggered. Yeah that might have been obvious. Here's the config for the Trigger:

- **Begin the task**: On workstation unlock
    - Fun fact: there's a whole AWS docs page about Task Scheduler and DCV which as far as I know is WRONG. You might see "connect to user session" as the answer, and if that works for you, mazel tov. This is what I did.
- **Any User** for now (we haven't configured our KioskUser yet)
- **CHECK OFF ENABLED**

### Configuring the Action

Now go to Actions. Here's the Config:

- **Start a program**
- **Program/script**: `powershell.exe`
- **Arguments**: `C:\scripts\ocap.ps1`

### Important Configuration Settings

**This is important. On the first page, this is the config you need:**

- **When running task, use the following user account**: Administrator for now
    - Basically, whatever user is meant to run this, select that user.
- **Select Run only when user is logged on**
- **Check Run with highest privileges**
- **Configure for Windows Server 2022**

!!! warning "Session Context is Critical"
    If you don't do any of this, Windows won't run OCAP inside the session; it will run it in a totally separate session. This is not always a bad thing; but basically the user's session is session 1 to Windows, and there is a higher plane of existence called session 0. The issue is that we are trying to capture the user's inputs, and we NEED to run it in this session.

And that's the first task. Now we create the second. I'm gonna speed through this a bit.

## Setting Up Task 2: Stop OCAP and Upload

**Name**: Stop OCAP

### Trigger Configuration

- **Trigger**: On Workstation lock
- **Any User** for now
- **Enabled**

### Actions Configuration

This one has two actions: first, the stop script, then the upload script.

**Action 1**: Start a program
- **Program/script**: `C:\Users\Administrator\Miniconda3\envs\ocap-env\python.exe`
- **Arguments**: `C:\scripts\stop_ocap.py`

**Action 2**: Start a program
- **Program/script**: `C:\Users\Administrator\Miniconda3\envs\ocap-env\python.exe`
- **Arguments**: `C:\scripts\upload_to_s3.py`

!!! note "Action Execution Order"
    Note that these do not necessarily happen synchronously, which is why I put a sleep at the beginning of my upload script.

## Testing

Try this whole setup. You can reboot your EC2 instance if you want things to take effect. Also, if you open `services.msc` in the Run menu, you can find the DCV server and restart it for changes to take effect.

You will know that you were successful if:

1. You log in and you see OCAP boot up
2. Once OCAP is running, you exit out of your DCV viewer, and then you see your S3 bucket get populated by the files

### Troubleshooting

If it's not working, the first thing you should do is enable history in Task Scheduler for your tasks. You will see if there were any errors. Some of the errors are just numbers (8000x), just look those up. Also, on booting up, if it doesn't work, just try logging in again. We'll deal with that later, but I think that the trigger for "first" log in after booting up is treated differently by Windows.

---

**Congratulations!** You've completed Phase 2. You should now have automated OCAP recording that starts on workstation unlock and stops/uploads to S3 on workstation lock.

