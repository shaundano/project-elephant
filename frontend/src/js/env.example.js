//
// Environment Configuration Template
// Copy this file to env.js and fill in your actual values
// env.js is gitignored and will not be committed
//

export const ENV = {
    // API Gateway endpoint for scheduling meetings
    API_GATEWAY_URL: "https://your-api-id.execute-api.us-west-2.amazonaws.com/your-stage/schedule",

    // API Gateway endpoint for joining meetings (GetDcvUrl)
    API_GATEWAY_JOIN_URL: "https://your-api-id.execute-api.us-west-2.amazonaws.com/prod/join",

};

