//
// Environment Configuration Template
// Copy this file to env.js and fill in your actual values
// env.js is gitignored and will not be committed
//

export const ENV = {
    // API Gateway endpoint for scheduling meetings
    API_GATEWAY_URL: "https://your-api-id.execute-api.us-west-2.amazonaws.com/your-stage/schedule",
    
    // DCV Server Configuration - Teacher
    DCV_TEACHER_SERVER: "https://your-dcv-server.com:8443",
    DCV_TEACHER_USER: "your-username",
    DCV_TEACHER_PASSWORD: "your-password",
    
    // DCV Server Configuration - Student
    DCV_STUDENT_SERVER: "https://your-dcv-student-server.com:8443",
    DCV_STUDENT_USER: "your-username",
    DCV_STUDENT_PASSWORD: "your-password",
};

