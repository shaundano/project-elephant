//
// Environment Configuration
// This file contains sensitive credentials and is gitignored
// Do NOT commit this file to version control
//

export const ENV = {
    // API Gateway endpoint for scheduling meetings
    API_GATEWAY_URL: "https://nh98h8n6ok.execute-api.us-west-2.amazonaws.com/prod",
    
    // API Gateway endpoint for joining meetings (GetDcvUrl)
    API_GATEWAY_JOIN_URL: "https://ip0l8p414e.execute-api.us-west-2.amazonaws.com/prod/join",
    
    // DCV Server Configuration - Teacher
    DCV_TEACHER_SERVER: "https://dcv.christardy.com:8443",
    DCV_TEACHER_USER: "KioskUser",
    DCV_TEACHER_PASSWORD: "Elephant_123",
    
    // DCV Server Configuration - Student
    DCV_STUDENT_SERVER: "https://dcvstudent.christardy.com:8443",
    DCV_STUDENT_USER: "KioskUser",
    DCV_STUDENT_PASSWORD: "Elephant_123",
};

