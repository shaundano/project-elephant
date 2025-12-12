# Better Frame Rate and More Flexible Resolution

This section covers how to configure DCV for better frame rates and support for large monitors.

![DCV Display Registry](../images/Phase 6/Screenshot 2025-12-07 at 6.01.32 PM.png)

## Registry Configuration

### 1. Navigate to Registry Key

Navigate to:
```
HKEY_USERS\S-1-5-18\Software\GSettings\com\nicesoftware\dcv\display
```

### 2. Set Values

Right-click > **New** to create these entries inside `display`:

| Name | Type | Value |
| :--- | :--- | :--- |
| **`target-fps`** | DWORD (32-bit) | `0` (Uncapped) or `60` |
| **`max-head-resolution`** | String Value | `4096x4096` |

### 3. Apply Changes

1. Press **Win + R**, type `services.msc`, and hit **Enter**.
2. Locate **DCV Server** in the list.
3. Right-click it and select **Restart**.

---

**Next: [DCV Fullscreen Display →](dcv-fullscreen.md)**

