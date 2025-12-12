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
export const CONFIGTEACHER = {
    DCV_SERVER: null,
    DCV_USER: null,
    DCV_PASSWORD: null
};

export const CONFIGSTUDENT = {
    DCV_SERVER: null,
    DCV_USER: null,
    DCV_PASSWORD: null
};
