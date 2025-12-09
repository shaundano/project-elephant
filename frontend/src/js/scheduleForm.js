//
// Meeting Schedule Form Component
//

import { ENV } from './env.js';

// API Gateway URL from environment configuration
const API_GATEWAY_URL = ENV.API_GATEWAY_URL;

// Common timezones for the dropdown
const TIMEZONES = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
    { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'Mumbai/New Delhi (IST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)' },
];

/**
 * Gets the minimum allowed date/time (30 minutes in the past)
 */
function getMinDateTime() {
    const now = new Date();
    const minTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes in the past
    minTime.setSeconds(0);
    minTime.setMilliseconds(0);
    return minTime;
}

/**
 * Formats a date to YYYY-MM-DDTHH:mm format for datetime-local input
 */
function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Validates that the meet time is at least 30 minutes in the past
 */
function validateMeetTime(dateTimeString, timezone) {
    if (!dateTimeString) {
        return { valid: false, message: 'Meet time is required' };
    }

    // Parse the datetime-local value (it's in local time)
    const selectedDate = new Date(dateTimeString);
    
    // Check if it's a valid date
    if (isNaN(selectedDate.getTime())) {
        return { valid: false, message: 'Invalid date/time' };
    }

    // Check if it's at least 30 minutes in the past or later
    const now = new Date();
    const minTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes in the past
    
    if (selectedDate < minTime) {
        return { valid: false, message: 'Meet time must be within the last 30 minutes or later' };
    }

    return { valid: true };
}

/**
 * Converts local datetime to ISO string with timezone consideration
 */
function convertToISOString(dateTimeString, timezone) {
    // datetime-local gives us a date in local time
    // We need to convert it to ISO string
    const date = new Date(dateTimeString);
    return date.toISOString();
}

/**
 * Creates and returns the schedule form component
 */
export function createScheduleForm() {
    const container = document.createElement('div');
    container.id = 'schedule-form-container';
    container.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 40px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 10000; min-width: 400px; max-width: 500px;';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Schedule Meeting';
    title.style.cssText = 'margin: 0 0 25px 0; color: #333; font-size: 24px; font-weight: 500; text-align: center;';
    container.appendChild(title);

    // Form
    const form = document.createElement('form');
    form.id = 'schedule-form';
    form.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

    // Error message container
    const errorContainer = document.createElement('div');
    errorContainer.id = 'form-error';
    errorContainer.style.cssText = 'display: none; padding: 12px; background: #f8d7da; color: #721c24; border-radius: 6px; border: 1px solid #f5c6cb; font-size: 14px;';
    form.appendChild(errorContainer);

    // Success message container
    const successContainer = document.createElement('div');
    successContainer.id = 'form-success';
    successContainer.style.cssText = 'display: none; padding: 12px; background: #d4edda; color: #155724; border-radius: 6px; border: 1px solid #c3e6cb; font-size: 14px;';
    form.appendChild(successContainer);

    // Teacher name field
    const teacherGroup = document.createElement('div');
    teacherGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    const teacherLabel = document.createElement('label');
    teacherLabel.textContent = 'Teacher Name *';
    teacherLabel.style.cssText = 'font-weight: 500; color: #333; font-size: 14px;';
    teacherLabel.setAttribute('for', 'teacher-name');
    
    const teacherInput = document.createElement('input');
    teacherInput.type = 'text';
    teacherInput.id = 'teacher-name';
    teacherInput.name = 'teacher_name';
    teacherInput.required = true;
    teacherInput.style.cssText = 'padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit;';
    teacherInput.placeholder = 'Enter teacher name';
    
    teacherGroup.appendChild(teacherLabel);
    teacherGroup.appendChild(teacherInput);
    form.appendChild(teacherGroup);

    // Student name field
    const studentGroup = document.createElement('div');
    studentGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    const studentLabel = document.createElement('label');
    studentLabel.textContent = 'Student Name *';
    studentLabel.style.cssText = 'font-weight: 500; color: #333; font-size: 14px;';
    studentLabel.setAttribute('for', 'student-name');
    
    const studentInput = document.createElement('input');
    studentInput.type = 'text';
    studentInput.id = 'student-name';
    studentInput.name = 'student_name';
    studentInput.required = true;
    studentInput.style.cssText = 'padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit;';
    studentInput.placeholder = 'Enter student name';
    
    studentGroup.appendChild(studentLabel);
    studentGroup.appendChild(studentInput);
    form.appendChild(studentGroup);

    // Timezone field
    const timezoneGroup = document.createElement('div');
    timezoneGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    const timezoneLabel = document.createElement('label');
    timezoneLabel.textContent = 'Timezone *';
    timezoneLabel.style.cssText = 'font-weight: 500; color: #333; font-size: 14px;';
    timezoneLabel.setAttribute('for', 'timezone');
    
    const timezoneSelect = document.createElement('select');
    timezoneSelect.id = 'timezone';
    timezoneSelect.name = 'timezone';
    timezoneSelect.required = true;
    timezoneSelect.style.cssText = 'padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit; background: white;';
    
    // Add timezone options
    TIMEZONES.forEach(tz => {
        const option = document.createElement('option');
        option.value = tz.value;
        option.textContent = tz.label;
        timezoneSelect.appendChild(option);
    });
    
    timezoneGroup.appendChild(timezoneLabel);
    timezoneGroup.appendChild(timezoneSelect);
    form.appendChild(timezoneGroup);

    // Meet time field
    const meetTimeGroup = document.createElement('div');
    meetTimeGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    const meetTimeLabel = document.createElement('label');
    meetTimeLabel.textContent = 'Meet Time *';
    meetTimeLabel.style.cssText = 'font-weight: 500; color: #333; font-size: 14px;';
    meetTimeLabel.setAttribute('for', 'meet-time');
    
    const meetTimeInput = document.createElement('input');
    meetTimeInput.type = 'datetime-local';
    meetTimeInput.id = 'meet-time';
    meetTimeInput.name = 'meet_time';
    meetTimeInput.required = true;
    meetTimeInput.step = 60; // 1 minute in seconds
    meetTimeInput.style.cssText = 'padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit;';
    
    // Set minimum date/time
    const minDateTime = getMinDateTime();
    meetTimeInput.min = formatDateTimeLocal(minDateTime);
    
    // Set initial value to the minimum
    meetTimeInput.value = formatDateTimeLocal(minDateTime);
    
    // Add change handler to validate
    meetTimeInput.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        if (selectedValue) {
            // Validate
            const validation = validateMeetTime(selectedValue, timezoneSelect.value);
            if (!validation.valid) {
                errorContainer.textContent = validation.message;
                errorContainer.style.display = 'block';
                successContainer.style.display = 'none';
            } else {
                errorContainer.style.display = 'none';
            }
        }
    });
    
    meetTimeGroup.appendChild(meetTimeLabel);
    meetTimeGroup.appendChild(meetTimeInput);
    form.appendChild(meetTimeGroup);

    // Submit button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Schedule Meeting';
    submitButton.style.cssText = 'padding: 12px 30px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; margin-top: 10px; transition: background 0.2s;';
    submitButton.onmouseover = () => {
        if (!submitButton.disabled) {
            submitButton.style.background = '#45a049';
        }
    };
    submitButton.onmouseout = () => {
        if (!submitButton.disabled) {
            submitButton.style.background = '#4CAF50';
        }
    };
    form.appendChild(submitButton);

    // Form submission handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide previous messages
        errorContainer.style.display = 'none';
        successContainer.style.display = 'none';
        
        // Get form values
        const teacherName = teacherInput.value.trim();
        const studentName = studentInput.value.trim();
        const timezone = timezoneSelect.value;
        const meetTime = meetTimeInput.value;
        
        // Validate all fields
        if (!teacherName || !studentName || !timezone || !meetTime) {
            errorContainer.textContent = 'All fields are required';
            errorContainer.style.display = 'block';
            return;
        }
        
        // Validate meet time
        const timeValidation = validateMeetTime(meetTime, timezone);
        if (!timeValidation.valid) {
            errorContainer.textContent = timeValidation.message;
            errorContainer.style.display = 'block';
            return;
        }
        
        // Disable submit button
        submitButton.disabled = true;
        submitButton.textContent = 'Scheduling...';
        submitButton.style.background = '#cccccc';
        submitButton.style.cursor = 'not-allowed';
        
        // Calculate the base URL for the frontend (always point to frontend/meeting.html)
        const frontendBaseUrl = `${window.location.origin}/frontend/meeting.html`;
        
        // Prepare payload
        const payload = {
            teacher_name: teacherName,
            student_name: studentName,
            meet_time: convertToISOString(meetTime, timezone),
            frontend_base_url: frontendBaseUrl
        };
        
        console.log('Submitting schedule form:', payload);
        
        try {
            // If API Gateway URL is not set, just simulate success for now
            if (!API_GATEWAY_URL) {
                console.log('API Gateway URL not configured. Simulating successful submission.');
                console.log('Payload that would be sent:', JSON.stringify(payload, null, 2));
                
                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Show success and navigate to DCV page
                successContainer.textContent = 'Meeting scheduled successfully! Redirecting...';
                successContainer.style.display = 'block';
                
                setTimeout(() => {
                    window.location.href = 'meeting.html';
                }, 1000);
                return;
            }
            
            // Make API call
            const response = await fetch(API_GATEWAY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            // Parse response
            const data = await response.json();
            console.log('Schedule response:', data);
            
            // Check both HTTP status and Lambda response statusCode
            // Lambda proxy integration may return HTTP 200 but statusCode in body indicates error
            const httpStatus = response.status;
            const lambdaStatusCode = data.statusCode;
            const isSuccess = httpStatus === 200 && (!lambdaStatusCode || lambdaStatusCode === 200);
            
            if (isSuccess) {
                // Extract response data (handle Lambda proxy integration format)
                let responseData = data;
                if (data.body) {
                    try {
                        responseData = typeof data.body === 'string' 
                            ? JSON.parse(data.body) 
                            : data.body;
                    } catch (parseError) {
                        console.error('Failed to parse response body:', parseError);
                        responseData = data;
                    }
                }
                
                // Extract teacher and student links from response
                const teacherLink = responseData.teacher_link;
                const studentLink = responseData.student_link;
                
                // Show success message
                successContainer.textContent = 'Meeting scheduled successfully! Redirecting...';
                successContainer.style.display = 'block';
                errorContainer.style.display = 'none';
                
                // Navigate to DCV page with encoded links as URL parameters
                if (teacherLink && studentLink) {
                    const redirectUrl = `meeting.html?tlink=${encodeURIComponent(teacherLink)}&slink=${encodeURIComponent(studentLink)}`;
                    setTimeout(() => {
                        window.location.href = redirectUrl;
                    }, 1000);
                } else {
                    // Fallback if links are missing
                    console.warn('Teacher or student link missing from response');
                    setTimeout(() => {
                        window.location.href = 'meeting.html';
                    }, 1000);
                }
            } else {
                // Handle error response - show error and do NOT redirect
                let errorMessage = `Server error: ${lambdaStatusCode || httpStatus}`;
                
                // Handle Lambda proxy integration response format
                if (data.body) {
                    try {
                        const bodyData = typeof data.body === 'string' 
                            ? JSON.parse(data.body) 
                            : data.body;
                        errorMessage = bodyData.message || errorMessage;
                    } catch (parseError) {
                        // If body is not JSON, use it as-is or fall back
                        errorMessage = data.body || errorMessage;
                    }
                } else if (data.message) {
                    errorMessage = data.message;
                }
                
                // Display error message
                errorContainer.textContent = `Failed to schedule meeting: ${errorMessage}`;
                errorContainer.style.display = 'block';
                successContainer.style.display = 'none';
                
                // Re-enable submit button
                submitButton.disabled = false;
                submitButton.textContent = 'Schedule Meeting';
                submitButton.style.background = '#4CAF50';
                submitButton.style.cursor = 'pointer';
                
                // Do NOT redirect on error
                return;
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            errorContainer.textContent = `Failed to schedule meeting: ${error.message}`;
            errorContainer.style.display = 'block';
            
            // Re-enable submit button
            submitButton.disabled = false;
            submitButton.textContent = 'Schedule Meeting';
            submitButton.style.background = '#4CAF50';
            submitButton.style.cursor = 'pointer';
        }
    });
    
    container.appendChild(form);
    return container;
}

/**
 * Shows the schedule form
 */
export function showScheduleForm() {
    const form = createScheduleForm();
    document.body.appendChild(form);
}

// Auto-show form when this script is loaded (for index.html page)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        showScheduleForm();
    });
} else {
    showScheduleForm();
}

