//
// By Ni SP GmbH // www.ni-sp.com // Use at own risk
//
// http://www.ni-sp.com/DCVSDK/

import "./dcvjs/dcv.js"
import { CONFIGTEACHER, CONFIGSTUDENT } from './config.js'


let auth,
    connection,
    serverUrl,
    selectedConfig;

console.log("Using NICE DCV Web Client SDK version " + dcv.version.versionStr);
// Show launch button on page load
document.addEventListener('DOMContentLoaded', showLaunchPrompt);

function showLaunchPrompt () {
    // Create container for the selection UI
    const container = document.createElement('div');
    container.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px 40px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 10000; text-align: center; min-width: 300px;';
    
    // Title
    const title = document.createElement('h2');
    title.textContent = 'Select Role';
    title.style.cssText = 'margin: 0 0 20px 0; color: #333; font-size: 24px;';
    container.appendChild(title);
    
    // Radio button container
    const radioContainer = document.createElement('div');
    radioContainer.style.cssText = 'display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px;';
    
    // Student radio
    const studentLabel = document.createElement('label');
    studentLabel.style.cssText = 'display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 18px; padding: 10px; border-radius: 6px; transition: background 0.2s;';
    studentLabel.onmouseover = () => studentLabel.style.background = '#f5f5f5';
    studentLabel.onmouseout = () => studentLabel.style.background = 'transparent';
    
    const studentRadio = document.createElement('input');
    studentRadio.type = 'radio';
    studentRadio.name = 'role';
    studentRadio.value = 'student';
    studentRadio.id = 'role-student';
    studentRadio.checked = true; // Default to student
    studentRadio.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
    
    const studentText = document.createTextNode('Student');
    studentLabel.appendChild(studentRadio);
    studentLabel.appendChild(studentText);
    radioContainer.appendChild(studentLabel);
    
    // Teacher radio
    const teacherLabel = document.createElement('label');
    teacherLabel.style.cssText = 'display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 18px; padding: 10px; border-radius: 6px; transition: background 0.2s;';
    teacherLabel.onmouseover = () => teacherLabel.style.background = '#f5f5f5';
    teacherLabel.onmouseout = () => teacherLabel.style.background = 'transparent';
    
    const teacherRadio = document.createElement('input');
    teacherRadio.type = 'radio';
    teacherRadio.name = 'role';
    teacherRadio.value = 'teacher';
    teacherRadio.id = 'role-teacher';
    teacherRadio.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
    
    const teacherText = document.createTextNode('Teacher');
    teacherLabel.appendChild(teacherRadio);
    teacherLabel.appendChild(teacherText);
    radioContainer.appendChild(teacherLabel);
    
    container.appendChild(radioContainer);
    
    // Launch button
    const button = document.createElement('button');
    button.textContent = 'Launch DCV in Fullscreen';
    button.style.cssText = 'padding: 12px 30px; font-size: 18px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-weight: bold; width: 100%;';
    button.onmouseover = () => button.style.background = '#45a049';
    button.onmouseout = () => button.style.background = '#4CAF50';
    
    button.onclick = () => {
        // Get selected role
        const selectedRole = document.querySelector('input[name="role"]:checked').value;
        selectedConfig = selectedRole === 'teacher' ? CONFIGTEACHER : CONFIGSTUDENT;
        
        container.remove();
        showLoadingMessage();
        enterFullscreen(); 
        main();
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
    
    serverUrl = selectedConfig.DCV_SERVER;
    
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
    console.log("Error during the authentication: ", error.message);
}

function onSuccess(auth, result) {
    const {sessionId, authToken} = result[0];
    connect(sessionId, authToken);
}

function updateDcvResolution() {
    if (!connection) return;
    
    const elem = document.getElementById("dcv-display");
    if (!elem) return;
    
    const width = Math.floor(elem.clientWidth);
    const height = Math.floor(elem.clientHeight);
    console.log(`Requesting DCV resolution: ${width}x${height}`);
    connection.requestResolution(width, height).catch(e => {
        console.error("Error requesting resolution: ", e.message);
    });
}

function removeLoadingMessage() {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
}

function connect(sessionId, authToken) {
    console.log("Starting DCV connection ...", sessionId, authToken);

    setTimeout(() => {
        ['form2', 'fs2', 'butt1'].forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.style.display = 'none';
        });
    }, 4500);

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
                // Show modal after first frame is rendered - ensures everything is ready
                if (connection && connection._showModal) {
                    // Small delay to ensure rendering is complete
                    setTimeout(() => {
                        connection._showModal();
                    }, 100);
                }
            }
        }
    }).then(conn => {
        console.log("Connection established!");
        connection = conn;

        // Store the modalShown flag and timeout on connection object
        connection._modalShown = false;
        
        // Fallback: show modal after 2 seconds if firstFrame hasn't fired yet
        connection._fallbackTimeout = setTimeout(() => {
            if (!connection._modalShown && connection) {
                console.log("Showing modal via fallback timeout");
                showMediaPermissionsModal(connection);
                connection._modalShown = true;
            }
        }, 2000);

        // Method to show modal (prevents duplicate shows)
        connection._showModal = () => {
            if (!connection._modalShown) {
                if (connection._fallbackTimeout) {
                    clearTimeout(connection._fallbackTimeout);
                }
                showMediaPermissionsModal(connection);
                connection._modalShown = true;
            }
        };

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

let fieldSet;

function submitCredentials(e) {
    e.preventDefault();
    const credentials = {};
    fieldSet.childNodes.forEach(input => credentials[input.id] = input.value);
    auth.sendCredentials(credentials);
}

function createLoginForm() {
    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.textContent = "Login";
    submitButton.id = "butt1";
    submitButton.style.cssText = 'width: 90px; margin: 6px; box-shadow: grey 1px 1px 6px; font-size: 150%; margin-top: 21px;';

    const form = document.createElement("form");
    fieldSet = document.createElement("fieldset");
    fieldSet.id = "fs2";
    fieldSet.style.cssText = 'width: 300px; box-shadow: grey 5px 5px 9px;';
    
    form.onsubmit = submitCredentials;
    form.appendChild(fieldSet);
    form.appendChild(submitButton);
    document.body.appendChild(form);
}

function addInput(name) {
    const inputField = document.createElement("input");
    inputField.name = name;
    inputField.id = name;
    inputField.placeholder = name;
    inputField.type = name === "password" ? "password" : "text";
    inputField.style.cssText = 'width: 90px; margin: 6px; box-shadow: grey 1px 1px 6px; font-size: 120%; padding: 3px;';
    fieldSet.appendChild(inputField);
} 

function onPromptCredentials(authObj, credentialsChallenge) {
    // Use selected config (default to student if not set)
    if (!selectedConfig) {
        selectedConfig = CONFIGSTUDENT;
    }
    
    if (challengeHasField(credentialsChallenge, "username") && challengeHasField(credentialsChallenge, "password")) {
        authObj.sendCredentials({username: selectedConfig.DCV_USER, password: selectedConfig.DCV_PASSWORD});
    } else {
        createLoginForm();
        credentialsChallenge.requiredCredentials.forEach(challenge => addInput(challenge.name));
    }
}

// -----------------------------------------------------------------
// MEDIA PERMISSIONS MODAL
// -----------------------------------------------------------------

function showMediaPermissionsModal(connection) {
    // Remove any existing modal
    const existingModal = document.getElementById('media-permissions-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Get the DCV display element - append to it so it's visible in fullscreen
    const dcvDisplay = document.getElementById('dcv-display');
    if (!dcvDisplay) {
        console.error("DCV display element not found");
        return;
    }

    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'media-permissions-modal';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.85);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Arial, sans-serif;
        pointer-events: auto;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        text-align: center;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Media Permissions Required';
    title.style.cssText = 'margin: 0 0 20px 0; color: #333; font-size: 24px;';

    const description = document.createElement('p');
    description.textContent = 'Please enable your microphone and webcam to continue.';
    description.style.cssText = 'margin: 0 0 30px 0; color: #666; font-size: 16px;';

    // Status indicators
    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = 'margin: 20px 0; display: flex; flex-direction: column; gap: 15px;';

    const webcamStatus = document.createElement('div');
    webcamStatus.id = 'webcam-status';
    webcamStatus.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f5f5f5; border-radius: 6px;';

    const micStatus = document.createElement('div');
    micStatus.id = 'mic-status';
    micStatus.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f5f5f5; border-radius: 6px;';

    // Webcam status
    const webcamLabel = document.createElement('span');
    webcamLabel.textContent = 'Webcam:';
    webcamLabel.style.cssText = 'font-weight: bold; color: #333;';

    const webcamIndicator = document.createElement('span');
    webcamIndicator.id = 'webcam-indicator';
    webcamIndicator.textContent = 'Not Enabled';
    webcamIndicator.style.cssText = 'color: #d9534f; font-weight: bold;';

    webcamStatus.appendChild(webcamLabel);
    webcamStatus.appendChild(webcamIndicator);

    // Mic status
    const micLabel = document.createElement('span');
    micLabel.textContent = 'Microphone:';
    micLabel.style.cssText = 'font-weight: bold; color: #333;';

    const micIndicator = document.createElement('span');
    micIndicator.id = 'mic-indicator';
    micIndicator.textContent = 'Not Enabled';
    micIndicator.style.cssText = 'color: #d9534f; font-weight: bold;';

    micStatus.appendChild(micLabel);
    micStatus.appendChild(micIndicator);

    statusContainer.appendChild(webcamStatus);
    statusContainer.appendChild(micStatus);

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-top: 30px;';

    const enableWebcamBtn = document.createElement('button');
    enableWebcamBtn.id = 'modal-enable-webcam';
    enableWebcamBtn.textContent = 'Enable Webcam';
    enableWebcamBtn.style.cssText = `
        padding: 12px 24px;
        font-size: 16px;
        background: #5cb85c;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
    `;

    const enableMicBtn = document.createElement('button');
    enableMicBtn.id = 'modal-enable-mic';
    enableMicBtn.textContent = 'Enable Microphone';
    enableMicBtn.style.cssText = `
        padding: 12px 24px;
        font-size: 16px;
        background: #5cb85c;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
    `;

    buttonsContainer.appendChild(enableWebcamBtn);
    buttonsContainer.appendChild(enableMicBtn);

    // Continue button (disabled until both enabled)
    const continueBtn = document.createElement('button');
    continueBtn.id = 'modal-continue';
    continueBtn.textContent = 'Continue';
    continueBtn.disabled = true;
    continueBtn.style.cssText = `
        padding: 14px 40px;
        font-size: 18px;
        background: #5cb85c;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        margin-top: 20px;
        width: 100%;
        opacity: 0.5;
        cursor: not-allowed;
    `;

    // State tracking
    let webcamEnabled = false;
    let micEnabled = false;

    function updateContinueButton() {
        if (webcamEnabled && micEnabled) {
            continueBtn.disabled = false;
            continueBtn.style.opacity = '1';
            continueBtn.style.cursor = 'pointer';
            continueBtn.style.background = '#5cb85c';
        } else {
            continueBtn.disabled = true;
            continueBtn.style.opacity = '0.5';
            continueBtn.style.cursor = 'not-allowed';
        }
    }

    // Enable webcam handler
    enableWebcamBtn.onclick = () => {
        enableWebcamBtn.disabled = true;
        enableWebcamBtn.textContent = 'Enabling...';
        connection.setWebcam(true)
            .then(() => {
                webcamEnabled = true;
                webcamIndicator.textContent = 'Enabled';
                webcamIndicator.style.color = '#5cb85c';
                enableWebcamBtn.textContent = 'Webcam Enabled';
                enableWebcamBtn.style.background = '#5cb85c';
                enableWebcamBtn.disabled = true;
                updateContinueButton();
                setupWebcamButton(connection, true);
            })
            .catch(e => {
                console.error("Failed to enable webcam:", e.message);
                enableWebcamBtn.disabled = false;
                enableWebcamBtn.textContent = 'Enable Webcam';
                alert('Failed to enable webcam. Please check your browser permissions.');
            });
    };

    // Enable mic handler
    enableMicBtn.onclick = () => {
        enableMicBtn.disabled = true;
        enableMicBtn.textContent = 'Enabling...';
        connection.setMicrophone(true)
            .then(() => {
                micEnabled = true;
                micIndicator.textContent = 'Enabled';
                micIndicator.style.color = '#5cb85c';
                enableMicBtn.textContent = 'Microphone Enabled';
                enableMicBtn.style.background = '#5cb85c';
                enableMicBtn.disabled = true;
                updateContinueButton();
                setupMicButton(connection, true);
            })
            .catch(e => {
                console.error("Failed to enable microphone:", e.message);
                enableMicBtn.disabled = false;
                enableMicBtn.textContent = 'Enable Microphone';
                alert('Failed to enable microphone. Please check your browser permissions.');
            });
    };

    // Continue handler
    continueBtn.onclick = () => {
        if (webcamEnabled && micEnabled) {
            modalOverlay.remove();
            // Buttons are already visible from when modal appeared
        }
    };

    // Assemble modal
    modalContent.appendChild(title);
    modalContent.appendChild(description);
    modalContent.appendChild(statusContainer);
    modalContent.appendChild(buttonsContainer);
    modalContent.appendChild(continueBtn);
    modalOverlay.appendChild(modalContent);
    
    // Append to DCV display element so it's visible in fullscreen mode
    dcvDisplay.appendChild(modalOverlay);
    
    // Create buttons when modal appears (if they don't exist)
    createMediaButtons();
    
    // Force a reflow to ensure the modal is rendered
    void modalOverlay.offsetHeight;
    
    console.log("Media permissions modal displayed");
}

// -----------------------------------------------------------------
// BUTTON FUNCTIONS FOR WEBCAM AND MICROPHONE
// -----------------------------------------------------------------

function createMediaButtons() {
    // Get the DCV display element
    const dcvDisplay = document.getElementById('dcv-display');
    if (!dcvDisplay) {
        console.error("DCV display element not found");
        return;
    }

    // Create webcam button if it doesn't exist
    if (!document.getElementById('webcam-button')) {
        const webcamButton = document.createElement('button');
        webcamButton.id = 'webcam-button';
        webcamButton.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 10001;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 2px solid #333;
            background: white;
            cursor: pointer;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
        `;
        webcamButton.onmouseover = () => {
            webcamButton.style.transform = 'scale(1.1)';
            webcamButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
        };
        webcamButton.onmouseout = () => {
            webcamButton.style.transform = 'scale(1)';
            webcamButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
        };
        
        const webcamImg = document.createElement('img');
        webcamImg.src = 'webcam.png';
        webcamImg.alt = 'Webcam';
        webcamImg.style.cssText = 'width: 30px; height: 30px; object-fit: contain;';
        webcamButton.appendChild(webcamImg);
        dcvDisplay.appendChild(webcamButton);
    }

    // Create mic button if it doesn't exist
    if (!document.getElementById('mic-button')) {
        const micButton = document.createElement('button');
        micButton.id = 'mic-button';
        micButton.style.cssText = `
            position: fixed;
            top: 20px;
            left: 80px;
            z-index: 10001;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 2px solid #333;
            background: white;
            cursor: pointer;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
        `;
        micButton.onmouseover = () => {
            micButton.style.transform = 'scale(1.1)';
            micButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
        };
        micButton.onmouseout = () => {
            micButton.style.transform = 'scale(1)';
            micButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
        };
        
        const micImg = document.createElement('img');
        micImg.src = 'mic.png';
        micImg.alt = 'Microphone';
        micImg.style.cssText = 'width: 30px; height: 30px; object-fit: contain;';
        micButton.appendChild(micImg);
        dcvDisplay.appendChild(micButton);
    }
}

function setupWebcamButton(connection, initialIsOn) {
    // Get or create the button
    let webcamButton = document.getElementById('webcam-button');
    if (!webcamButton) {
        createMediaButtons();
        webcamButton = document.getElementById('webcam-button');
    }
    if (!webcamButton) {
        console.error("Webcam button not found");
        return;
    }

    // Use the passed-in initial state
    let isWebcamOn = initialIsOn;

    // Update button style based on state
    if (isWebcamOn) {
        webcamButton.style.background = '#D9534F';
        webcamButton.style.borderColor = '#D9534F';
        webcamButton.style.opacity = '1';
    } else {
        webcamButton.style.background = 'white';
        webcamButton.style.borderColor = '#333';
        webcamButton.style.opacity = '0.6';
    }
    
    webcamButton.onclick = () => {
        isWebcamOn = !isWebcamOn; // Toggle the state
        console.log(`Setting webcam to: ${isWebcamOn}`);
        
        connection.setWebcam(isWebcamOn)
            .then(() => {
                console.log(`Webcam ${isWebcamOn ? 'enabled' : 'disabled'}`);
                if (isWebcamOn) {
                    webcamButton.style.background = '#D9534F';
                    webcamButton.style.borderColor = '#D9534F';
                    webcamButton.style.opacity = '1';
                } else {
                    webcamButton.style.background = 'white';
                    webcamButton.style.borderColor = '#333';
                    webcamButton.style.opacity = '0.6';
                }
            })
            .catch(e => {
                console.error("Failed to toggle webcam:", e.message);
                isWebcamOn = !isWebcamOn; // Revert state on failure
            });
    };
}

function setupMicButton(connection, initialIsOn) {
    // Get or create the button
    let micButton = document.getElementById('mic-button');
    if (!micButton) {
        createMediaButtons();
        micButton = document.getElementById('mic-button');
    }
    if (!micButton) {
        console.error("Mic button not found");
        return;
    }

    // Use the passed-in initial state
    let isMicOn = initialIsOn;

    // Update button style based on state
    if (isMicOn) {
        micButton.style.background = '#D9534F';
        micButton.style.borderColor = '#D9534F';
        micButton.style.opacity = '1';
    } else {
        micButton.style.background = 'white';
        micButton.style.borderColor = '#333';
        micButton.style.opacity = '0.6';
    }

    micButton.onclick = () => {
        isMicOn = !isMicOn; // Toggle the state
        console.log(`Setting microphone to: ${isMicOn}`);
        
        connection.setMicrophone(isMicOn)
            .then(() => {
                console.log(`Microphone ${isMicOn ? 'enabled' : 'disabled'}`);
                if (isMicOn) {
                    micButton.style.background = '#D9534F';
                    micButton.style.borderColor = '#D9534F';
                    micButton.style.opacity = '1';
                } else {
                    micButton.style.background = 'white';
                    micButton.style.borderColor = '#333';
                    micButton.style.opacity = '0.6';
                }
            })
            .catch(e => {
                console.error("Failed to toggle microphone:", e.message);
                isMicOn = !isMicOn; // Revert state on failure
            });
    };
}