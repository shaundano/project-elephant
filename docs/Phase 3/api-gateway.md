# API Gateway and Testing

Navigate to API Gateway in AWS, and create a new one. Then select **REST API**.

![API Gateway Selection](../images/Phase 3/Screenshot 2025-12-07 at 9.21.51 AM.png)

## API Configuration

Configure it like this:

- Name it `schedule`
- Go with any recommended security policy
- Keep everything else default

![API Gateway Configuration](../images/Phase 3/Screenshot 2025-12-07 at 9.22.58 AM.png)

## Creating the Resource

Now we need to create the actual endpoint (resource):

1. In your API dashboard, click **Actions** > **Create Resource**.
2. **Resource Name:** Enter `schedule`.
3. **Resource Path:** This should auto-fill as `/schedule`.
4. **Check CORS**.

!!! info "Note - CORS (Cross-Origin Resource Sharing)"
    CORS is a browser security feature that blocks web pages from making API requests to a different domain. You 100% need it if you're calling the API from a frontend.

5. Click **Create Resource**.

## Creating the POST Method

Next, you need to create the POST method with this config:

- **Method type:** POST
- **Integration type:** Lambda
- **Lambda function:** your region, and find the ARN for your Lambda

!!! info "Note - ARN (Amazon Resource Name)"
    ARN is your service's unique ID across AWS services.

Once you've set that up, ensure that you've enabled CORS one more time. Just select the POST method in the menu and enable CORS in the top right. Then deploy the API. You'll have to probably define the environment you're deploying in, just call it `prod`.

## API Gateway URL

Your API Gateway URL will follow this format:

```plaintext
https://{gateway-id}.execute-api.us-west-2.amazonaws.com/prod
```

Now if you replace `API_GATEWAY_URL` with your URL in this way, you'll be able to hit the POST method.

That's it. You should be able to schedule a meeting via the frontend, have it write to the database, and have an EventBridge scheduled task invoke the launch-ec2 Lambda function. Although we haven't set that one up yet, here's how you can test Lambdas.

## Testing with CloudWatch

![CloudWatch Logs](../images/Phase 3/Screenshot 2025-12-07 at 10.09.14 AM.png)

- Go to **Monitor**, and then **View CloudWatch logs**. Every execution of the Lambda should have a log, and any print statements, plus built-in logs will display there.

!!! note "Testing - CloudWatch Logs"
    If successful, you should see a line like:

    ```plaintext
    Scheduling Launch for: 2025-11-30T22:23:00
    ```

---

**Congratulations!** You've completed Phase 3. You should now have a working API Gateway endpoint connected to your Lambda function, and be able to schedule meetings through the frontend.

