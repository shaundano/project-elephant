//
// By Ni SP GmbH // www.ni-sp.com // Use at own risk
//
// http://www.ni-sp.com/DCVSDK/

import "../../dcvjs/dcv.js"
import { CONFIGTEACHER, CONFIGSTUDENT, API_CONFIG } from './config.js'


let auth,
    connection,
    serverUrl,
    selectedConfig,
    currentMeetingId = null,
    currentRole = null,
    fetchedDcvUrl = null; // Store the fetched EC2 DCV URL

console.log("Using NICE DCV Web Client SDK version " + dcv.version.versionStr);
// Check for meeting parameters on page load
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const meetingId = urlParams.get('id');
    const role = urlParams.get('role');
    const teacherLink = urlParams.get('tlink');
    const studentLink = urlParams.get('slink');
    
    // If we have meeting links to display (from scheduling success)
    if (teacherLink && studentLink) {
        // Decode the links
        const decodedTeacherLink = decodeURIComponent(teacherLink);
        const decodedStudentLink = decodeURIComponent(studentLink);
        
        // Display the links
        displayLinks(decodedTeacherLink, decodedStudentLink);
    } 
    // If we have id and role parameters (from clicking a meeting link)
    else if (meetingId && role) {
        // Show launch prompt with the meeting ID and role
        showLaunchPrompt(meetingId, role);
    } 
    // No valid parameters, show normal launch prompt (fallback)
    else {
        showLaunchPrompt();
    }
});

// -----------------------------------------------------------------
// MEDIA PERMISSIONS COMPONENT
// -----------------------------------------------------------------

function createMediaPermissionsComponent() {
    const container = document.createElement('div');
    container.style.cssText = 'margin: 25px 0; padding: 20px; background: #f9f9f9; border-radius: 8px;';
    
    const title = document.createElement('h3');
    title.textContent = 'Media Permissions';
    title.style.cssText = 'margin: 0 0 15px 0; color: #333; font-size: 18px; font-weight: 500;';
    container.appendChild(title);
    
    // Status indicators
    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = 'margin: 15px 0; display: flex; flex-direction: column; gap: 12px;';
    
    const webcamStatus = document.createElement('div');
    webcamStatus.id = 'pre-webcam-status';
    webcamStatus.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: white; border-radius: 6px; border: 1px solid #ddd;';
    
    const micStatus = document.createElement('div');
    micStatus.id = 'pre-mic-status';
    micStatus.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: white; border-radius: 6px; border: 1px solid #ddd;';
    
    const clipboardStatus = document.createElement('div');
    clipboardStatus.id = 'pre-clipboard-status';
    clipboardStatus.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: white; border-radius: 6px; border: 1px solid #ddd;';
    
    // Webcam status
    const webcamLabel = document.createElement('span');
    webcamLabel.textContent = 'Webcam:';
    webcamLabel.style.cssText = 'font-weight: 500; color: #333;';
    
    const webcamIndicator = document.createElement('span');
    webcamIndicator.id = 'pre-webcam-indicator';
    webcamIndicator.textContent = 'Not Enabled';
    webcamIndicator.style.cssText = 'color: #d9534f; font-weight: bold;';
    
    webcamStatus.appendChild(webcamLabel);
    webcamStatus.appendChild(webcamIndicator);
    
    // Mic status
    const micLabel = document.createElement('span');
    micLabel.textContent = 'Microphone:';
    micLabel.style.cssText = 'font-weight: 500; color: #333;';
    
    const micIndicator = document.createElement('span');
    micIndicator.id = 'pre-mic-indicator';
    micIndicator.textContent = 'Not Enabled';
    micIndicator.style.cssText = 'color: #d9534f; font-weight: bold;';
    
    micStatus.appendChild(micLabel);
    micStatus.appendChild(micIndicator);
    
    // Clipboard status
    const clipboardLabel = document.createElement('span');
    clipboardLabel.textContent = 'Clipboard:';
    clipboardLabel.style.cssText = 'font-weight: 500; color: #333;';
    
    const clipboardIndicator = document.createElement('span');
    clipboardIndicator.id = 'pre-clipboard-indicator';
    clipboardIndicator.textContent = 'Not Enabled';
    clipboardIndicator.style.cssText = 'color: #d9534f; font-weight: bold;';
    
    clipboardStatus.appendChild(clipboardLabel);
    clipboardStatus.appendChild(clipboardIndicator);
    
    statusContainer.appendChild(webcamStatus);
    statusContainer.appendChild(micStatus);
    statusContainer.appendChild(clipboardStatus);
    
    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-top: 15px;';
    
    const enableWebcamBtn = document.createElement('button');
    enableWebcamBtn.id = 'pre-enable-webcam';
    enableWebcamBtn.textContent = 'Enable Webcam';
    enableWebcamBtn.style.cssText = `
        padding: 10px 20px;
        font-size: 14px;
        background: #5cb85c;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    `;
    enableWebcamBtn.onmouseover = () => {
        if (!enableWebcamBtn.disabled) {
            enableWebcamBtn.style.background = '#4cae4c';
        }
    };
    enableWebcamBtn.onmouseout = () => {
        if (!enableWebcamBtn.disabled) {
            enableWebcamBtn.style.background = '#5cb85c';
        }
    };
    
    const enableMicBtn = document.createElement('button');
    enableMicBtn.id = 'pre-enable-mic';
    enableMicBtn.textContent = 'Enable Microphone';
    enableMicBtn.style.cssText = `
        padding: 10px 20px;
        font-size: 14px;
        background: #5cb85c;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    `;
    enableMicBtn.onmouseover = () => {
        if (!enableMicBtn.disabled) {
            enableMicBtn.style.background = '#4cae4c';
        }
    };
    enableMicBtn.onmouseout = () => {
        if (!enableMicBtn.disabled) {
            enableMicBtn.style.background = '#5cb85c';
        }
    };
    
    const enableClipboardBtn = document.createElement('button');
    enableClipboardBtn.id = 'pre-enable-clipboard';
    enableClipboardBtn.textContent = 'Enable Clipboard';
    enableClipboardBtn.style.cssText = `
        padding: 10px 20px;
        font-size: 14px;
        background: #5cb85c;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    `;
    enableClipboardBtn.onmouseover = () => {
        if (!enableClipboardBtn.disabled) {
            enableClipboardBtn.style.background = '#4cae4c';
        }
    };
    enableClipboardBtn.onmouseout = () => {
        if (!enableClipboardBtn.disabled) {
            enableClipboardBtn.style.background = '#5cb85c';
        }
    };
    
    const enableAllBtn = document.createElement('button');
    enableAllBtn.id = 'pre-enable-all';
    enableAllBtn.textContent = 'Allow All';
    enableAllBtn.style.cssText = `
        padding: 12px 24px;
        font-size: 15px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    `;
    enableAllBtn.onmouseover = () => {
        if (!enableAllBtn.disabled) {
            enableAllBtn.style.background = '#0056b3';
        }
    };
    enableAllBtn.onmouseout = () => {
        if (!enableAllBtn.disabled) {
            enableAllBtn.style.background = '#007bff';
        }
    };
    
    buttonsContainer.appendChild(enableWebcamBtn);
    buttonsContainer.appendChild(enableMicBtn);
    buttonsContainer.appendChild(enableClipboardBtn);
    buttonsContainer.appendChild(enableAllBtn);
    
    container.appendChild(statusContainer);
    container.appendChild(buttonsContainer);
    
    // State tracking
    let webcamEnabled = false;
    let micEnabled = false;
    let clipboardEnabled = false;
    let webcamStream = null;
    let micStream = null;
    let onStatusChangeCallback = null;
    
    // Function to update "Allow All" button state
    function updateAllowAllButtonState() {
        if (webcamEnabled && micEnabled && clipboardEnabled) {
            enableAllBtn.disabled = true;
            enableAllBtn.textContent = 'All Enabled';
            enableAllBtn.style.background = '#5cb85c';
        } else {
            enableAllBtn.disabled = false;
            enableAllBtn.textContent = 'Allow All';
            enableAllBtn.style.background = '#007bff';
        }
    }
    
    function updateStatusCallback() {
        if (onStatusChangeCallback) {
            onStatusChangeCallback();
        }
        updateAllowAllButtonState();
    }
    
    function verifyWebcam(stream) {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
            webcamEnabled = true;
            webcamIndicator.textContent = 'Enabled';
            webcamIndicator.style.color = '#5cb85c';
            enableWebcamBtn.textContent = 'Webcam Enabled';
            enableWebcamBtn.disabled = true;
            enableWebcamBtn.style.background = '#5cb85c';
            updateStatusCallback();
            return true;
        }
        return false;
    }
    
    function verifyMicrophone(stream) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
            micEnabled = true;
            micIndicator.textContent = 'Enabled';
            micIndicator.style.color = '#5cb85c';
            enableMicBtn.textContent = 'Microphone Enabled';
            enableMicBtn.disabled = true;
            enableMicBtn.style.background = '#5cb85c';
            updateStatusCallback();
            return true;
        }
        return false;
    }
    
    function verifyClipboard() {
        clipboardEnabled = true;
        clipboardIndicator.textContent = 'Enabled';
        clipboardIndicator.style.color = '#5cb85c';
        enableClipboardBtn.textContent = 'Clipboard Enabled';
        enableClipboardBtn.disabled = true;
        enableClipboardBtn.style.background = '#5cb85c';
        updateStatusCallback();
        return true;
    }
    
    // Enable webcam handler
    enableWebcamBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        enableWebcamBtn.disabled = true;
        enableWebcamBtn.textContent = 'Enabling...';
        webcamIndicator.textContent = 'Enabling...';
        webcamIndicator.style.color = '#ffa500';
        
        try {
            // Stop existing stream if any
            if (webcamStream) {
                webcamStream.getTracks().forEach(track => track.stop());
            }
            
            // Request webcam permission
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            webcamStream = stream;
            
            if (verifyWebcam(stream)) {
                // Keep the stream active until meeting launches
                // DCV will take over the stream when connecting
            } else {
                throw new Error('Webcam track not available');
            }
        } catch (e) {
            console.error("Failed to enable webcam:", e.message);
            enableWebcamBtn.disabled = false;
            enableWebcamBtn.textContent = 'Enable Webcam';
            webcamIndicator.textContent = 'Not Enabled';
            webcamIndicator.style.color = '#d9534f';
            alert('Failed to enable webcam. Please check your browser permissions and ensure a webcam is connected.');
        }
    };
    
    // Enable mic handler
    enableMicBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        enableMicBtn.disabled = true;
        enableMicBtn.textContent = 'Enabling...';
        micIndicator.textContent = 'Enabling...';
        micIndicator.style.color = '#ffa500';
        
        try {
            // Stop existing stream if any
            if (micStream) {
                micStream.getTracks().forEach(track => track.stop());
            }
            
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            micStream = stream;
            
            if (verifyMicrophone(stream)) {
                // Keep the stream active until meeting launches
                // DCV will take over the stream when connecting
            } else {
                throw new Error('Microphone track not available');
            }
        } catch (e) {
            console.error("Failed to enable microphone:", e.message);
            enableMicBtn.disabled = false;
            enableMicBtn.textContent = 'Enable Microphone';
            micIndicator.textContent = 'Not Enabled';
            micIndicator.style.color = '#d9534f';
            alert('Failed to enable microphone. Please check your browser permissions and ensure a microphone is connected.');
        }
    };
    
    // Enable clipboard handler
    enableClipboardBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        enableClipboardBtn.disabled = true;
        enableClipboardBtn.textContent = 'Enabling...';
        clipboardIndicator.textContent = 'Enabling...';
        clipboardIndicator.style.color = '#ffa500';
        
        try {
            // Check if clipboard API is available
            if (!navigator.clipboard) {
                throw new Error('Clipboard API not available. Please use a modern browser or ensure the page is served over HTTPS.');
            }
            
            // Request clipboard write permission by attempting to write a test string
            // This will trigger the browser's permission prompt if needed
            await navigator.clipboard.writeText('test');
            
            // If successful, verify the permission
            if (verifyClipboard()) {
                console.log('Clipboard permission granted');
            } else {
                throw new Error('Failed to verify clipboard permission');
            }
        } catch (e) {
            console.error("Failed to enable clipboard:", e.message);
            enableClipboardBtn.disabled = false;
            enableClipboardBtn.textContent = 'Enable Clipboard';
            clipboardIndicator.textContent = 'Not Enabled';
            clipboardIndicator.style.color = '#d9534f';
            alert('Failed to enable clipboard. Please check your browser permissions. The page must be served over HTTPS for clipboard access.');
        }
    };
    
    // Enable all handler
    enableAllBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        // Disable button and show loading state
        enableAllBtn.disabled = true;
        enableAllBtn.textContent = 'Enabling All...';
        
        const results = {
            webcam: false,
            mic: false,
            clipboard: false
        };
        
        // Enable webcam
        if (!webcamEnabled) {
            try {
                enableWebcamBtn.disabled = true;
                enableWebcamBtn.textContent = 'Enabling...';
                webcamIndicator.textContent = 'Enabling...';
                webcamIndicator.style.color = '#ffa500';
                
                if (webcamStream) {
                    webcamStream.getTracks().forEach(track => track.stop());
                }
                
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                webcamStream = stream;
                
                if (verifyWebcam(stream)) {
                    results.webcam = true;
                    // Keep the stream active until meeting launches
                }
            } catch (e) {
                console.error("Failed to enable webcam:", e.message);
                enableWebcamBtn.disabled = false;
                enableWebcamBtn.textContent = 'Enable Webcam';
                webcamIndicator.textContent = 'Not Enabled';
                webcamIndicator.style.color = '#d9534f';
            }
        } else {
            results.webcam = true;
        }
        
        // Enable microphone
        if (!micEnabled) {
            try {
                enableMicBtn.disabled = true;
                enableMicBtn.textContent = 'Enabling...';
                micIndicator.textContent = 'Enabling...';
                micIndicator.style.color = '#ffa500';
                
                if (micStream) {
                    micStream.getTracks().forEach(track => track.stop());
                }
                
                const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                micStream = stream;
                
                if (verifyMicrophone(stream)) {
                    results.mic = true;
                    // Keep the stream active until meeting launches
                }
            } catch (e) {
                console.error("Failed to enable microphone:", e.message);
                enableMicBtn.disabled = false;
                enableMicBtn.textContent = 'Enable Microphone';
                micIndicator.textContent = 'Not Enabled';
                micIndicator.style.color = '#d9534f';
            }
        } else {
            results.mic = true;
        }
        
        // Enable clipboard
        if (!clipboardEnabled) {
            try {
                enableClipboardBtn.disabled = true;
                enableClipboardBtn.textContent = 'Enabling...';
                clipboardIndicator.textContent = 'Enabling...';
                clipboardIndicator.style.color = '#ffa500';
                
                if (!navigator.clipboard) {
                    throw new Error('Clipboard API not available. Please use a modern browser or ensure the page is served over HTTPS.');
                }
                
                await navigator.clipboard.writeText('test');
                
                if (verifyClipboard()) {
                    results.clipboard = true;
                }
            } catch (e) {
                console.error("Failed to enable clipboard:", e.message);
                enableClipboardBtn.disabled = false;
                enableClipboardBtn.textContent = 'Enable Clipboard';
                clipboardIndicator.textContent = 'Not Enabled';
                clipboardIndicator.style.color = '#d9534f';
            }
        } else {
            results.clipboard = true;
        }
        
        // Update "Allow All" button state
        if (results.webcam && results.mic && results.clipboard) {
            enableAllBtn.textContent = 'All Enabled';
            enableAllBtn.style.background = '#5cb85c';
            enableAllBtn.disabled = true;
        } else {
            enableAllBtn.disabled = false;
            enableAllBtn.textContent = 'Allow All';
            const failed = [];
            if (!results.webcam) failed.push('Webcam');
            if (!results.mic) failed.push('Microphone');
            if (!results.clipboard) failed.push('Clipboard');
            if (failed.length > 0) {
                console.warn(`Failed to enable: ${failed.join(', ')}`);
            }
        }
        
        updateStatusCallback();
    };
    
    // Initialize "Allow All" button state
    updateAllowAllButtonState();
    
    // Cleanup function to stop all active streams before launching meeting
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
    
    return {
        container,
        get webcamEnabled() { return webcamEnabled; },
        get micEnabled() { return micEnabled; },
        get clipboardEnabled() { return clipboardEnabled; },
        set onStatusChange(callback) { onStatusChangeCallback = callback; },
        cleanupStreams
    };
}

// Store links globally for later use in join flow
let storedTeacherLink = null;
let storedStudentLink = null;

/**
 * Displays the teacher and student links in copyable input boxes
 */
function displayLinks(teacherLink, studentLink) {
    // Store links for later use
    storedTeacherLink = teacherLink;
    storedStudentLink = studentLink;
    
    // Create container for the links display
    const container = document.createElement('div');
    container.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px 40px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 10000; min-width: 500px; max-width: 700px;';
    
    // Title
    const title = document.createElement('h2');
    title.textContent = 'Meeting Links';
    title.style.cssText = 'margin: 0 0 25px 0; color: #333; font-size: 24px; font-weight: 500; text-align: center;';
    container.appendChild(title);
    
    // Description
    const description = document.createElement('p');
    description.textContent = 'Share these links with the teacher and student. Click the copy button to copy each link.';
    description.style.cssText = 'margin: 0 0 25px 0; color: #666; font-size: 14px; text-align: center;';
    container.appendChild(description);
    
    // Teacher link section
    const teacherSection = createLinkSection('Teacher Link', teacherLink, 'teacher-link');
    container.appendChild(teacherSection);
    
    // Spacer
    const spacer = document.createElement('div');
    spacer.style.cssText = 'height: 20px;';
    container.appendChild(spacer);
    
    // Student link section
    const studentSection = createLinkSection('Student Link', studentLink, 'student-link');
    container.appendChild(studentSection);
    
    document.body.appendChild(container);
}

/**
 * Creates a link section with label, input, and copy button
 */
function createLinkSection(labelText, linkValue, inputId) {
    const section = document.createElement('div');
    section.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    // Label
    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.cssText = 'font-weight: 500; color: #333; font-size: 14px;';
    label.setAttribute('for', inputId);
    section.appendChild(label);
    
    // Input and button container
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'display: flex; gap: 8px; align-items: stretch;';
    
    // Input field
    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.value = linkValue;
    input.readOnly = true;
    input.style.cssText = 'flex: 1; padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit; background: #f9f9f9;';
    inputContainer.appendChild(input);
    
    // Copy button
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.style.cssText = 'padding: 10px 20px; font-size: 14px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; white-space: nowrap; transition: background 0.2s;';
    copyButton.onmouseover = () => {
        if (!copyButton.disabled) {
            copyButton.style.background = '#45a049';
        }
    };
    copyButton.onmouseout = () => {
        if (!copyButton.disabled) {
            copyButton.style.background = '#4CAF50';
        }
    };
    
    // Copy functionality
    copyButton.onclick = async () => {
        try {
            await navigator.clipboard.writeText(linkValue);
            
            // Visual feedback
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            copyButton.style.background = '#5cb85c';
            copyButton.disabled = true;
            
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.style.background = '#4CAF50';
                copyButton.disabled = false;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
            // Fallback: select the text
            input.select();
            input.setSelectionRange(0, 99999); // For mobile devices
            try {
                document.execCommand('copy');
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                }, 2000);
            } catch (fallbackErr) {
                alert('Failed to copy link. Please select and copy manually.');
            }
        }
    };
    
    inputContainer.appendChild(copyButton);
    section.appendChild(inputContainer);
    
    return section;
}

function showLaunchPrompt (meetingId = null, role = null) {
    // Create container for the selection UI
    const container = document.createElement('div');
    container.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px 40px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 10000; text-align: center; min-width: 300px;';
    
    // Title
    const title = document.createElement('h2');
    title.textContent = meetingId && role ? 'Join Meeting' : 'Select Role';
    title.style.cssText = 'margin: 0 0 20px 0; color: #333; font-size: 24px;';
    container.appendChild(title);
    
    // Display meeting ID and role if provided
    if (meetingId && role) {
        // Store globally for later use
        currentMeetingId = meetingId;
        currentRole = role;
        
        const infoContainer = document.createElement('div');
        infoContainer.style.cssText = 'margin-bottom: 25px; padding: 15px; background: #f9f9f9; border-radius: 8px;';
        
        const meetingIdLabel = document.createElement('div');
        meetingIdLabel.style.cssText = 'margin-bottom: 10px; font-size: 14px; color: #666;';
        meetingIdLabel.innerHTML = `<strong>Meeting ID:</strong> ${meetingId}`;
        infoContainer.appendChild(meetingIdLabel);
        
        const roleLabel = document.createElement('div');
        roleLabel.style.cssText = 'font-size: 14px; color: #666;';
        const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
        roleLabel.innerHTML = `<strong>Role:</strong> ${roleDisplay}`;
        infoContainer.appendChild(roleLabel);
        
        container.appendChild(infoContainer);
        
        // Set the config based on role
        selectedConfig = role === 'teacher' ? CONFIGTEACHER : CONFIGSTUDENT;
    } else {
        // Fallback: if no parameters, default to student
        selectedConfig = CONFIGSTUDENT;
    }
    
    // Create media permissions component
    const mediaPermissionsComponent = createMediaPermissionsComponent();
    container.appendChild(mediaPermissionsComponent.container);
    
    // Launch button
    const button = document.createElement('button');
    button.id = 'launch-dcv-button';
    button.textContent = 'Launch my Meeting';
    button.disabled = true;
    button.style.cssText = 'padding: 12px 30px; font-size: 18px; background: #cccccc; color: white; border: none; border-radius: 8px; cursor: not-allowed; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-weight: bold; width: 100%; opacity: 0.6;';
    
    // Update button state based on media permissions
    const updateLaunchButton = () => {
        if (mediaPermissionsComponent.webcamEnabled && mediaPermissionsComponent.micEnabled && mediaPermissionsComponent.clipboardEnabled) {
            button.disabled = false;
            button.style.background = '#4CAF50';
            button.style.cursor = 'pointer';
            button.style.opacity = '1';
            button.onmouseover = () => button.style.background = '#45a049';
            button.onmouseout = () => button.style.background = '#4CAF50';
        } else {
            button.disabled = true;
            button.style.background = '#cccccc';
            button.style.cursor = 'not-allowed';
            button.style.opacity = '0.6';
            button.onmouseover = null;
            button.onmouseout = null;
        }
    };
    
    // Set up callback to update button when media status changes
    mediaPermissionsComponent.onStatusChange = updateLaunchButton;
    
    button.onclick = async () => {
        if (button.disabled) return;
        
        // Disable button and show fetching state
        button.disabled = true;
        button.textContent = 'Fetching...';
        button.style.background = '#6c757d';
        button.style.cursor = 'not-allowed';
        
        try {
            // Only fetch if we have meetingId and role
            if (meetingId && role) {
                // Construct the API URL
                const apiUrl = `${API_CONFIG.API_GATEWAY_JOIN_URL}/${meetingId}/${role}`;
                console.log('Fetching DCV URL from:', apiUrl);
                
                // Fetch the data
                const response = await fetch(apiUrl);
                let data = await response.json();
                
                // Handle Lambda proxy integration format (response might be in data.body)
                if (data.body) {
                    try {
                        data = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                    } catch (parseError) {
                        console.error('Failed to parse response body:', parseError);
                    }
                }
                
                // Log response body to console
                console.log('DCV URL Response:', JSON.stringify(data, null, 2));
                
                // Check response status
                const httpStatus = response.status;
                const lambdaStatusCode = data.statusCode;
                const isSuccess = httpStatus === 200 && (!lambdaStatusCode || lambdaStatusCode === 200);
                
                if (isSuccess && data.dcv_url) {
                    // Success: Store the DCV URL globally
                    fetchedDcvUrl = data.dcv_url;
                    
                    // Show success message and proceed
                    button.textContent = 'Success! Redirecting...';
                    button.style.background = '#5cb85c';
                    
                    // Small delay to show success message
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Cleanup pre-flight streams before DCV takes over
                    mediaPermissionsComponent.cleanupStreams();
                    
                    // Proceed with connection
                    container.remove();
                    showLoadingMessage();
                    enterFullscreen(); 
                    main();
                } else {
                    // Not ready or error
                    const status = data.status || lambdaStatusCode || httpStatus;
                    const errorMessage = data.message || `Server link not ready. Status: ${status}`;
                    alert(errorMessage);
                    
                    // Re-enable button for retry
                    button.disabled = false;
                    button.textContent = 'Launch my Meeting';
                    button.style.background = '#4CAF50';
                    button.style.cursor = 'pointer';
                }
            } else {
                // No meetingId/role, proceed with default config
                // Cleanup pre-flight streams before DCV takes over
                mediaPermissionsComponent.cleanupStreams();
                
                container.remove();
                showLoadingMessage();
                enterFullscreen(); 
                main();
            }
        } catch (error) {
            console.error('Error fetching DCV URL:', error);
            alert(`Error: ${error.message}`);
            
            // Re-enable button for retry
            button.disabled = false;
            button.textContent = 'Launch my Meeting';
            button.style.background = '#4CAF50';
            button.style.cursor = 'pointer';
        }
    };
    
    container.appendChild(button);
    document.body.appendChild(container);
}

function showLoadingMessage() {
    const loading = document.createElement('div');
    loading.id = 'loading';
    loading.textContent = 'Connecting to DCV...';
    loading.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px 40px; font-size: 18px; background: rgba(0,0,0,0.8); color: white; border-radius: 8px; z-index: 10000;';
    document.body.appendChild(loading);
}

function main () {
    console.log("Setting log level to INFO");
    dcv.setLogLevel(dcv.LogLevel.INFO);
    
    // Use selected config (default to student if not set)
    if (!selectedConfig) {
        selectedConfig = CONFIGSTUDENT;
    }
    
    // Use fetched DCV URL if available, otherwise use config (fallback to null)
    if (fetchedDcvUrl) {
        serverUrl = fetchedDcvUrl;
        console.log("Using fetched EC2 DCV URL:", serverUrl);
    } else if (selectedConfig.DCV_SERVER) {
        serverUrl = selectedConfig.DCV_SERVER;
        console.log("Using configured DCV server:", serverUrl);
    } else {
        serverUrl = null;
        console.warn("No DCV server URL available. Using fetched URL or config fallback.");
    }
    
    if (!serverUrl) {
        console.error("Cannot connect: No DCV server URL available");
        removeLoadingMessage();
        alert("Error: No DCV server URL available. Please ensure you're joining a meeting with a valid link.");
        return;
    }
    
    console.log("Starting authentication with", serverUrl);
    
    auth = dcv.authenticate(
        serverUrl,
        {
            promptCredentials: onPromptCredentials,
            error: onError,
            success: onSuccess
        }
    );
}

function challengeHasField(challenge, field) {
    return challenge.requiredCredentials.some(credential => credential.name === field);
}

function onError(auth, error) {
    console.error("Error during the authentication: ", error.message);
    removeLoadingMessage();
    alert(`Error: Failed to connect to DCV server. ${error.message}`);
}

function onSuccess(auth, result) {
    const {sessionId, authToken} = result[0];
    connect(sessionId, authToken);
}

function updateDcvResolution() {
    if (!connection) return;
    
    const elem = document.getElementById("dcv-display");
    if (!elem) return;
    
    const pixelRatio = window.devicePixelRatio || 1;
    let width = Math.floor(elem.clientWidth * pixelRatio);
    let height = Math.floor(elem.clientHeight * pixelRatio);
    
    const originalWidth = width;
    const originalHeight = height;
    
    // --- SMART CAP: Keep aspect ratio, but stay under server limits ---
    const MAX_W = 1920;
    const MAX_H = 1080;

    // If request is too wide, shrink it
    if (width > MAX_W) {
        const scale = MAX_W / width;
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
    }

    // If request is (still) too tall, shrink it further
    if (height > MAX_H) {
        const scale = MAX_H / height;
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
    }
    // ----------------------------------------------------------------

    console.log(`Requesting DCV resolution: ${width}x${height} (Original request would have been: ${originalWidth}x${originalHeight})`);
    
    connection.requestResolution(width, height).catch(e => {
        console.error("Error requesting resolution: ", e.message);
    });
}

function removeLoadingMessage() {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
}

function connect(sessionId, authToken) {
    console.log("Starting DCV connection ...", sessionId);


    dcv.connect({
        url: serverUrl,
        sessionId,
        authToken,
        divId: "dcv-display",
        callbacks: {
            firstFrame: () => {
                console.log("First frame received");
                removeLoadingMessage();
                updateDcvResolution();
            },
            
            featuresUpdate: function (features) {
                console.log("Server Feature Update:", features);
                // Redundancy: If server explicitly says "ready", try to start immediately
                if (features.webcam) {
                    connection.setWebcam(true).catch(e => console.warn("Webcam start retry:", e.message));
                }
                if (features['audio-in']) {
                    connection.setMicrophone(true).catch(e => console.warn("Mic start retry:", e.message));
                }
            },
            
            displayLayout: (l) => console.log("Layout:", l),
            clipboardEvent: (e) => console.log("Clipboard:", e)
        }
    }).then(conn => {
        console.log("Connection established!");
        connection = conn;
        
        // --- BLIND AUTO-START (With "The Kick" Fix) ---
        // Forces devices on after 2s delay. This fixes the issue where 
        // the Audio channel is created silently without a featuresUpdate event.
        // Note: No UI buttons are created since Jitsi handles webcam/mic controls.
        setTimeout(() => {
            console.log("Attempting blind auto-start of devices...");
            
            connection.setMicrophone(true).catch(e => console.warn(e));

            connection.setWebcam(true).then(() => {
                console.log("Webcam Started. Waiting 1s for driver, then kicking Jitsi...");
                
                // Wait 1 second for the virtual driver to mount, then refresh
                setTimeout(() => {
                    // FIX: Create proper KeyboardEvent objects for F5 keypress
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
                    } else {
                        console.warn("Could not send F5: SDK function missing.");
                    }
                }, 1000);
            }).catch(e => console.warn("Webcam start error:", e.message));

        }, 2000);
        
        window.addEventListener('resize', updateDcvResolution);
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange'].forEach(
            event => document.addEventListener(event, updateDcvResolution)
        );
    }).catch(error => {
        console.log("Connection failed with error " + error.message);
        removeLoadingMessage();
    });
}

function enterFullscreen() {
    const elem = document.getElementById("dcv-display");
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    }
}

function onPromptCredentials(authObj, credentialsChallenge) {
    // Always use hardcoded credentials (KioskUser / Elephant_123)
    const username = "KioskUser";
    const password = "Elephant_123";
    
    if (challengeHasField(credentialsChallenge, "username") && challengeHasField(credentialsChallenge, "password")) {
        console.log("Authenticating with hardcoded credentials");
        authObj.sendCredentials({
            username: username,
            password: password
        });
    } else {
        // Unexpected credential challenge - return error
        console.error("Unexpected credential challenge:", credentialsChallenge);
        removeLoadingMessage();
        alert("Error: Unexpected authentication challenge. Cannot connect to DCV server.");
    }
}
