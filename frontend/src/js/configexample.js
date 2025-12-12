// API Gateway Configuration
export const API_CONFIG = {
    // API Gateway endpoint for scheduling meetings
    API_GATEWAY_URL: "https://your-api-id.execute-api.us-west-2.amazonaws.com/your-stage/schedule",
    
    // API Gateway endpoint for joining meetings (GetDcvUrl)
    API_GATEWAY_JOIN_URL: "https://your-api-id.execute-api.us-west-2.amazonaws.com/prod/join",
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

