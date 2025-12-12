# Force Fullscreen Display

This section covers how to force the DCV display to fill the entire viewport using client-side CSS upscaling and smart resolution capping.

## Overview

By default, DCV may display at a resolution that doesn't match your browser window, causing black bars or distorted images. This solution uses CSS to stretch the stream and JavaScript to request resolutions that stay within server limits while maintaining aspect ratio.

## CSS Configuration

Add the following to `frontend/src/css/index.css`:

```css
#dcv-display {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #ffffff;
}

/* Force video/canvas elements to fill container */
#dcv-display video,
#dcv-display canvas,
#dcv-display > div {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important; /* 'contain' maintains aspect ratio, 'fill' stretches */
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
}
```

**Key settings:**
- `object-fit: contain` - Maintains aspect ratio (no distortion)
- `object-fit: fill` - Stretches to fill (may distort on mismatched aspect ratios)
- White background ensures letterboxing appears as bars

## JavaScript Resolution Handling

Update `updateDcvResolution()` in `frontend/src/js/main.js` to cap requests within server limits:

```javascript
function updateDcvResolution() {
    if (!connection) return;
    
    const elem = document.getElementById("dcv-display");
    if (!elem) return;
    
    const pixelRatio = window.devicePixelRatio || 1;
    let width = Math.floor(elem.clientWidth * pixelRatio);
    let height = Math.floor(elem.clientHeight * pixelRatio);
    
    const originalWidth = width;
    const originalHeight = height;
    
    // Smart cap: Keep aspect ratio, stay under server limits
    const MAX_W = 1920;
    const MAX_H = 1080;

    if (width > MAX_W) {
        const scale = MAX_W / width;
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
    }

    if (height > MAX_H) {
        const scale = MAX_H / height;
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
    }

    console.log(`Requesting DCV resolution: ${width}x${height} (Original: ${originalWidth}x${originalHeight})`);
    
    connection.requestResolution(width, height).catch(e => {
        console.error("Error requesting resolution: ", e.message);
    });
}
```

**How it works:**
- Calculates desired resolution including pixel ratio (for Retina/high-DPI displays)
- Scales down proportionally if either dimension exceeds server limits (1920x1080)
- Maintains aspect ratio to prevent black bars
- Logs both final and original requests for debugging

## Why This Works

1. **CSS upscaling**: Forces browser to stretch DCV stream to viewport size
2. **Smart capping**: Requests resolutions server accepts while preserving aspect ratio
3. **Aspect ratio match**: Server sends image matching window shape, CSS displays it correctly

## Result

- Full-screen display without black bars (when aspect ratios match)
- No image distortion (with `contain`)
- Works across different window sizes and device pixel ratios
- Lower resolution than native but acceptable quality

---

**Next: [Auto-Enable Webcam and Microphone →](auto-enable-media.md)**

