# Phase 4: First Lambdas, DynamoDB, and Frontend

## Overview

In this phase, we're going to set up API Gateway for the first time, which will establish API endpoints that we can hit from the frontend. These endpoints will call Lambda functions that modify our DynamoDB. If this sounds like gibberish to you, go back to the Introduction where we discuss various AWS services present in this project.

## What You'll Learn

This phase covers setting up the backend infrastructure and frontend integration:

1. **[DynamoDB](dynamodb.md)** - Create and configure the DynamoDB table for storing meeting data
2. **[Frontend](frontend.md)** - Set up the frontend interface and understand the data flow
3. **[Schedule-meeting Lambda](schedule-meeting-lambda.md)** - Create the Lambda function to handle meeting scheduling
4. **[API Gateway and Testing](api-gateway.md)** - Set up API Gateway endpoints and test with CloudWatch

## Expected Outcome

By the end of this phase, you should have:

- A DynamoDB table configured for storing meeting data
- A frontend interface for scheduling meetings
- A Lambda function that processes meeting requests
- API Gateway endpoints connected to your Lambda
- Ability to test and monitor Lambda executions via CloudWatch

---

**Let's get started with [DynamoDB →](dynamodb.md)**

