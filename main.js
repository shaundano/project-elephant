//
// By Ni SP GmbH // www.ni-sp.com // Use at own risk
//
// http://www.ni-sp.com/DCVSDK/

import "./dcvjs/dcv.js"
import { CONFIG } from './config.js'


let auth,
    connection,
    serverUrl;

console.log("Using NICE DCV Web Client SDK version " + dcv.version.versionStr);
// Show launch button on page load
document.addEventListener('DOMContentLoaded', showLaunchPrompt);

function showLaunchPrompt () {
    const button = document.createElement('button');
    button.textContent = 'Launch DCV in Fullscreen';
    button.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px 40px; font-size: 20px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 10000;';
    
    button.onclick = () => {
        button.remove();
        showLoadingMessage();
        enterFullscreen(); 
        main();
    };
    document.body.appendChild(button);
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
    
    serverUrl = CONFIG.DCV_SERVER;
    
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
            }
        }
    }).then(conn => {
        console.log("Connection established!");
        connection = conn;

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
    if (challengeHasField(credentialsChallenge, "username") && challengeHasField(credentialsChallenge, "password")) {
        authObj.sendCredentials({username: CONFIG.DCV_USER, password: CONFIG.DCV_PASSWORD});
    } else {
        createLoginForm();
        credentialsChallenge.requiredCredentials.forEach(challenge => addInput(challenge.name));
    }
}