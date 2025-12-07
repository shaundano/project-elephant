# Autologon

Now, we have one thing left to do. We're going to configure AutoLogon for KioskUser in Registry Editor.

**What AutoLogon does:**

- The moment an EC2 boots up, before the user even enters, it will log into KioskUser
- It runs our VBS-wrapped `master_launch` script, which includes the whole health check
- When the user actually logs in, the kiosk will be waiting for them
- If not, the fallback script will reboot it
- OCAP will trigger no matter what

!!! warning "Warning - Why AutoLogon is Critical"
    I can't stress how necessary this is: on first boot up of an EC2, you can legitimately be waiting 2-3 minutes on a black screen until you see any sign of life, and that does not go away by just letting the EC2 stay idle. It MUST load user profiles into PowerShell, load the conda environment, etc. AutoLogon ensures this "warming up" happens automatically.

Here's how to configure AutoLogon for KioskUser:

1. Press **Win + R**, type `regedit`, and press **Enter**.
2. Navigate to the following path:
    ```
    HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon
    ```
3. Modify (or create) the following **String Values (REG_SZ)**:
    
| **Value Name**        | **Value Data**           | **Note**                                                                             |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| **AutoAdminLogon**    | `1`                      | Enables the feature.                                                                 |
| **DefaultUserName**   | `KioskUser`              | The target account.                                                                  |
| **DefaultPassword**   | _(Your Actual Password)_ | **Must be the real password.**                                                       |

!!! info "Note - HKEY_LOCAL_MACHINE vs HKEY_USERS"
    Note that last time, we were configuring for a specific user, hence `HKEY_USERS`. This is `LOCAL_MACHINE`, so it's machine wide.

!!! info "Note - Switching Back to Administrator"
    A side inconvenience is that now, when you boot up the EC2, you'll be logged into KioskUser by default. Just hit `ctrl + alt + del` and Sign Out, switching back into Administrator.

## Full Flow

Here's the complete flow from EC2 boot to user session:

1. **EC2 boots up**
2. **AutoLogon logs in as KioskUser**
3. **VBS-wrapped `master_launch` runs**, doing the whole health check and booting up the actual Edge kiosk
4. **When the health check finishes**, writes "Healthy" to the DynamoDB and locks the workstation
5. **User logs in**, triggering the VBS-wrapped fallback script
6. **OCAP starts**

!!! success "Phase 3 Complete"
    And that's it. You've configured KioskUser as a single app kiosk, triggered the master_launch and health check.

