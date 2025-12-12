// API Gateway Configuration
// This file is generated from .env by running: npm run build:config
// Edit .env file and run the build script to update these values
export const API_CONFIG = {
    // API Gateway endpoint for scheduling meetings
    API_GATEWAY_URL: "https://nh98h8n6ok.execute-api.us-west-2.amazonaws.com/prod",
    
    // API Gateway endpoint for joining meetings (GetDcvUrl)
    API_GATEWAY_JOIN_URL: "https://ip0l8p414e.execute-api.us-west-2.amazonaws.com/prod/join",
};

// DCV Configuration
// Note: These credentials are hardcoded to the EC2 instance
const DCV_USERNAME = "KioskUser";
const DCV_PASSWORD = "Elephant_123";

export const CONFIGTEACHER = {
    DCV_SERVER: null,
    DCV_USER: DCV_USERNAME,
    DCV_PASSWORD: DCV_PASSWORD
};

export const CONFIGSTUDENT = {
    DCV_SERVER: null,
    DCV_USER: DCV_USERNAME,
    DCV_PASSWORD: DCV_PASSWORD
};
