# Auto-Enable Webcam and Microphone

This section covers the implementation of automatic webcam and microphone activation in the DCV frontend, including the dual-strategy approach for reliable device activation and the Jitsi refresh mechanism.

## Overview

The auto-enable feature ensures that webcam and microphone are automatically activated when a DCV session connects, eliminating the need for manual user intervention. This is critical for seamless integration with Jitsi Meet, which requires active media streams to function properly.

## Architecture

The implementation uses a dual-strategy approach to handle different scenarios:

1. **Explicit Feature Announcements** - Reacts to server announcements via `featuresUpdate` callback
2. **Blind Auto-Start** - Attempts to enable devices after a delay, regardless of announcements

This redundancy ensures devices activate even when the server doesn't explicitly announce capabilities or when callbacks are missed.

## Implementation Details

### 1. Features Update Callback

The `featuresUpdate` callback listens for explicit server announcements about available features:

```javascript
featuresUpdate: function (features) {
    console.log("Server Feature Update:", features);
    // Redundancy: If server explicitly says "ready", try to start immediately
    if (features.webcam) {
        connection.setWebcam(true).catch(e => console.warn("Webcam start retry:", e.message));
    }
    if (features['audio-in']) {
        connection.setMicrophone(true).catch(e => console.warn("Mic start retry:", e.message));
    }
}
```

**Why this is needed:** Some DCV servers explicitly announce when features are ready. This callback provides immediate activation when such announcements occur.

### 2. Blind Auto-Start Logic

After the connection is established, a 2-second delay triggers a "blind" attempt to enable devices:

```javascript
setTimeout(() => {
    console.log("Attempting blind auto-start of devices...");
    
    connection.setMicrophone(true).catch(e => console.warn(e));

    connection.setWebcam(true).then(() => {
        console.log("Webcam Started. Waiting 1s for driver, then kicking Jitsi...");
        
        // Wait 1 second for the virtual driver to mount, then refresh
        setTimeout(() => {
            // Send F5 refresh to wake up Jitsi
            // ... (see F5 Refresh section below)
        }, 1000);
    }).catch(e => console.warn("Webcam start error:", e.message));
}, 2000); // 2 second delay
```

**Why this is needed:** Some devices (especially audio) may be created silently without triggering feature announcements. The blind auto-start ensures these devices are activated regardless.

### 3. F5 Refresh Mechanism ("The Kick")

After the webcam is successfully enabled, the system automatically sends an F5 keypress to refresh the remote browser window. This is critical because Jitsi may have loaded before the webcam driver was ready.

```javascript
connection.setWebcam(true).then(() => {
    setTimeout(() => {
        if (typeof connection.sendKeyboardEvent === 'function') {
            // Create F5 keydown event
            const keyDownEvent = new KeyboardEvent('keydown', {
                key: 'F5',
                code: 'F5',
                keyCode: 116,
                which: 116,
                bubbles: true,
                cancelable: true
            });
            
            // Create F5 keyup event
            const keyUpEvent = new KeyboardEvent('keyup', {
                key: 'F5',
                code: 'F5',
                keyCode: 116,
                which: 116,
                bubbles: true,
                cancelable: true
            });
            
            connection.sendKeyboardEvent(keyDownEvent);
            setTimeout(() => {
                connection.sendKeyboardEvent(keyUpEvent);
                console.log("🚀 F5 Refresh Sent!");
            }, 50);
        }
    }, 1000);
});
```

**Why this is needed:** 
- Jitsi may load before the virtual webcam driver is fully mounted
- The refresh ensures Jitsi detects the webcam after it's ready
- Prevents "Unable to access camera" errors in Jitsi

**Timing:** The refresh happens 1 second after webcam activation to allow the virtual driver to mount.

### 4. Pre-Flight Media Permissions

Before connecting to DCV, users must grant permissions for webcam, microphone, and clipboard. The implementation includes:

#### Individual Enable Buttons
- **Enable Webcam** - Requests camera permission and verifies the stream
- **Enable Microphone** - Requests microphone permission and verifies the stream  
- **Enable Clipboard** - Requests clipboard write permission

#### "Allow All" Button
A convenient one-click option that enables all three permissions sequentially:

```javascript
enableAllBtn.onclick = async (e) => {
    // Sequentially enable webcam, mic, and clipboard
    // Handles errors gracefully (continues if one fails)
    // Updates button state when all are enabled
};
```

**Features:**
- Enables all permissions in one click
- Continues even if one permission fails
- Shows "All Enabled" state when complete
- Disables button when all permissions are granted

### 5. Stream Management

Media streams remain active after enabling to provide user feedback:

- **During Pre-Flight:** Streams stay active so users can see/hear their devices working
- **Before Launch:** Streams are cleaned up via `cleanupStreams()` method
- **During DCV Session:** DCV takes over the media streams automatically

```javascript
// Cleanup function stops all active streams before DCV takes over
function cleanupStreams() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
}
```

## Configuration Options

### Toggle F5 Refresh

To disable the automatic F5 refresh, you can modify the code:

```javascript
const ENABLE_JITSI_AUTO_REFRESH = false; // Set to false to disable

if (ENABLE_JITSI_AUTO_REFRESH) {
    // ... F5 refresh code
}
```

### Adjust Auto-Start Delay

The 2-second delay can be modified if needed:

```javascript
setTimeout(() => {
    // ... auto-start code
}, 2000); // Change this value to adjust delay
```

## Troubleshooting

### Webcam Not Activating

1. **Check Server-Side Configuration:**
   - Verify Windows Privacy Settings allow camera access for desktop apps
   - Ensure NICE DCV Virtual Webcam driver is installed (check Device Manager)
   - Verify DCV Server permissions file allows webcam

2. **Check Browser Console:**
   - Look for "Server Feature Update" logs
   - Check for "Webcam auto-start" messages
   - Verify F5 refresh is being sent

3. **Check Server Logs:**
   - Look for `[channelfactory] Created channel of type 'video'` messages
   - Verify no blocking errors in DCV Server logs

### Microphone Not Activating

1. **Check Server-Side Configuration:**
   - Verify Windows Privacy Settings allow microphone access for desktop apps
   - Check that microphone is enabled in DCV Server configuration

2. **Check Browser Console:**
   - Look for "Mic auto-start" messages
   - Verify no error messages in console

3. **Check Server Logs:**
   - Look for `[channelfactory] Created channel of type 'audio'` messages

### Jitsi Not Detecting Webcam

1. **Verify F5 Refresh:**
   - Check console for "🚀 F5 Refresh Sent!" message
   - Ensure browser window is in focus when refresh is sent

2. **Check Timing:**
   - The refresh happens 1 second after webcam activation
   - If Jitsi loads very slowly, you may need to increase the delay

3. **Manual Refresh:**
   - If automatic refresh fails, manually refresh the Jitsi page (F5)
   - The webcam should be detected after refresh

---

**Next: [AppLocker Configuration →](applocker.md)**

