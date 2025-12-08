In this last section, we're gonna cover a few ways that you can make the experience better.

## Better frame rate and more flexible resolution on large monitors

![[Screenshot 2025-12-07 at 6.01.32 PM.png]]


**1. Navigate to Registry Key**
`HKEY_USERS\S-1-5-18\Software\GSettings\com\nicesoftware\dcv\display`

**2. Set Values**
Right-click > **New** to create these entries inside `display`:

| Name | Type | Value |
| :--- | :--- | :--- |
| **`target-fps`** | DWORD (32-bit) | `0` (Uncapped) or `60` |
| **`max-head-resolution`** | String Value | `4096x4096` |

**3. Apply Changes**

1.  Press **Win + R**, type `services.msc`, and hit **Enter**.
2.  Locate **DCV Server** in the list.
3.  Right-click it and select **Restart**.

## AppLocker

AppLocker is a windows method that allows you to block certain applications for certain users, such as Task Manager for KioskUser.



### **Part 1: Block Task Manager via AppLocker**

*Note: AppLocker requires the "Application Identity" service to be running.*

1.  **Open Policy Editor:** Run `secpol.msc`.
2.  **Create Default Rules (Vital):** Navigate to **Application Control Policies** \> **AppLocker** \> **Executable Rules**. Right-click and select **Create Default Rules** (prevents you from locking yourself out). Also do it for Script Rules. Some of our code counts as an executable, some as scripts.

![[Screenshot 2025-12-07 at 6.05.13 PM.png]]

This is what mine looks like.

Executable:

|**Action**|**User**|**Name/Path**|**Condition**|
|---|---|---|---|
|✅ Allow|Everyone|`C:\Users\Administrator\Miniconda3\*`|Path|
|✅ Allow|Everyone|`C:\projects\*`|Path|
|✅ Allow|Everyone|(Default Rule) All files located in the Program Files folder|Path|
|✅ Allow|Everyone|`C:\Users\KioskUser\*`|Path|
|✅ Allow|Everyone|(Default Rule) All files located in the Windows folder|Path|
|🚫 Deny|EC2AMAZ-GPDFMFQ\KioskUser|`C:\Windows\System32\Taskmgr.exe`|Path|
|✅ Allow|Everyone|`C:\scripts\*`|Path|
|✅ Allow|BUILTIN\Administrators|(Default Rule) All files|Path|

Script:

|**Action**|**User**|**Name/Path**|**Condition**|
|---|---|---|---|
|✅ Allow|Everyone|`C:\scripts\*`|Path|
|✅ Allow|Everyone|(Default Rule) All scripts located in the Program Files folder|Path|
|✅ Allow|Everyone|`C:\Users\Administrator\Miniconda3\Scripts\*`|Path|
|✅ Allow|Everyone|`%OSDRIVE%\USERS\KIOSKUSER\APPDATA\LOCAL\TEMP\*`|Path|
|✅ Allow|Everyone|`C:\Users\Administrator\Miniconda3\*`|Path|
|✅ Allow|EC2AMAZ-GPDFMFQ\KioskUser|`C:\Users\KioskUser*`|Path|
|✅ Allow|Everyone|(Default Rule) All scripts located in the Windows folder|Path|
|✅ Allow|Everyone|`C:\Users\Administrator\Miniconda3\condabin\*`|Path|
|✅ Allow|BUILTIN\Administrators|(Default Rule) All scripts|Path|

3.  **Create Deny Rule:**
      * Right-click \> **Create New Rule**.
      * **Action:** Deny.
      * **User:** Select the specific Student/User.
      * **Conditions:** Path \> Browse Files \> `C:\Windows\System32\Taskmgr.exe`.
      * Click **Create**.
4.  **Enforce Policy:** Right-click **AppLocker** (the root node) \> **Properties**. Check **Configured** under Executable rules and set to **Enforce rules**.
5.  **Start Service (CMD):**
    Run this as Admin to ensure the AppLocker engine is on:
    ```cmd
    sc start AppIDSvc
    gpupdate /force
    ```

NOTE: This will probably make your start menu unusable. You'll have to boot stuff from cmd.exe while it's on.
### Looking at Events via Event Viewer

This is SUPER helpful to monitor AppLocker.

![[Screenshot 2025-12-07 at 6.10.23 PM.png]]

Here is how to check the AppLocker logs using the Event Viewer GUI:

1.  Press **Win + R**, type `eventvwr.msc`, and hit **Enter**.
2.  Navigate to this specific folder tree:
    **Applications and Services Logs** > **Microsoft** > **Windows** > **AppLocker**
3.  Click on **EXE and DLL**.
4.  Look for **Event ID 8004**.
    * **8004:** Application was blocked.
    * **8002:** Application was allowed.

The "General" tab in the bottom pane will tell you exactly which file was blocked and which user tried to run it.


