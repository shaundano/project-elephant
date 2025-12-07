# Creating KioskUser and Task Scheduler Modification

Alright, the time has come for us to set up KioskUser. This is going to be our second user that will only be able to access the Jitsi server (or whatever app), while OCAP runs in the background and captures desktop inputs.

To do this, we're going to:

1. Create the KioskUser account
2. Configure Task Scheduler for the user
3. Set up folder permissions
4. Configure health check logic (which is necessary to ensure everything is ready when the user logs in)
5. Set it up as a single app kiosk in Registry Editor

## Creating the KioskUser

This is quite easy. 

Go to `Run` and look up `lusrmgr.msc`. This stands for Local Users and Groups. It should look like this:

![Local Users and Groups](../images/Phase 3/Screenshot 2025-12-06 at 9.09.14 PM.png)

Go ahead and create a `new user`.

![Create New User](../images/Phase 3/Screenshot 2025-12-06 at 9.08.19 PM.png)

Then put in a User name and Password. I went with `KioskUser`.

!!! note "Testing - Login Verification"
    Press `ctrl + alt + del` and sign out of `Administrator`. Make sure that you can log into KioskUser. Once you can do that, go back into Administrator.

Within `C:\Users`, you should be able to see KioskUser now. Right off the bat, you're gonna do something that is a bit wack, but works for this setup.

**Setting up folder permissions:**

1. Right-click on `projects` and `scripts` folders
2. Click `Properties` and go to `Security`
3. Click `Edit` to modify permissions

![Edit Permissions](../images/Phase 3/Screenshot 2025-12-06 at 9.14.42 PM.png)

Give `KioskUser` full controls. Then do the same thing for the entire `Administrator` folder in `C:\Users`.

!!! warning "Warning - Permission Workaround"
    This whole setup is not super ideal, and you can try avoiding it. However, if you installed Miniconda and your `ocap-env` in Administrator (like I did), you'll need to give KioskUser access. This was an easier workaround, and KioskUser will not have access to these folders anyway since they're locked down by the kiosk mode.

## Editing Task Scheduler

![Task Scheduler](../images/Phase 3/Screenshot 2025-12-06 at 9.17.29 PM.png)

Remember how we configured the tasks to run as Administrator? Just change everything to KioskUser. We will be testing there from now on.

