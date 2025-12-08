# Get DCV URL

The first thing is that we need to define a new API Gateway URL. This one is going to be a bit more complicated than the first one, just follow these steps.

## API Gateway Setup

### 1. Create the API

1. Navigate to **API Gateway** in the AWS Console.
2. Click **Create API** > **REST API** > **Build**.
3. **Settings:**
    * **Protocol:** `REST`
    * **Create new API:** `New API`
    * **API name:** `ElephantJoinAPI`
    * **Endpoint Type:** `Regional`
4. Click **Create API**.

### 2. Build the Resource Structure

You need to create a nested path: `/join/{meetingId}/{role}`.

1. **Create `/join`:**
    * Select the root (`/`) > **Actions** > **Create Resource**.
    * **Resource Name:** `join`
    * Click **Create Resource**.
2. **Create `/{meetingId}`:**
    * Select `/join` > **Actions** > **Create Resource**.
    * **Resource Name:** `meetingId`
    * **Resource Path:** `{meetingId}` (Ensure curly braces are used).
    * Click **Create Resource**.
3. **Create `/{role}`:**
    * Select `/{meetingId}` > **Actions** > **Create Resource**.
    * **Resource Name:** `role`
    * **Resource Path:** `{role}`
    * Click **Create Resource**.

### 3. Configure the GET Method

1. Select the `/{role}` resource.
2. Click **Actions** > **Create Method**.
3. Select **GET** from the dropdown and click the checkmark.
4. **Setup Integration:**
    * **Integration type:** `Lambda Function`
    * **Use Lambda Proxy integration:** `Check` (Recommended for easy access to path parameters).
    * **Lambda Function:** Enter `GetDcvUrl` (or your specific redirection Lambda name).
    * Click **Save**.

### 4. Deploy

1. Click **Actions** > **Deploy API**.
2. **Deployment stage:** `[New Stage]` (e.g., `prod`).
3. Click **Deploy**.

Your API should look like this:

![API Gateway Structure](../images/Phase 4/Screenshot 2025-12-07 at 1.01.53 PM.png)

!!! tip "Awesome - Link as Storage"
    This allows us to pass in headers into the API and still use the GET method. This is ideal because then there's no middle application that needs to store the payload for when the users want to enter their meeting. Think about it, the meeting could be a week away. This link is effectively the storage! Pretty sick.

Now, let's get to the Lambda.

## Environment Variables

None :-)

## Code Breakdown

```python title="Path Parameter Parsing"
path_params = event.get('pathParameters', {})
meeting_id = path_params.get('meetingId')
user_role = path_params.get('role') 

if not meeting_id or user_role not in ['teacher', 'student']:
    return {
        'statusCode': 400, 
        'body': json.dumps({'message': 'Invalid meeting ID or role.'}), 
        'headers': {'Access-Control-Allow-Origin': '*'}
    }
```

- The frontend is going to send the primary key from DynamoDB and the role via the header, and the Lambda is going to parse those.

```python title="Fetching the DCV URL"
link_field = f"{user_role}_ec2_link" 
final_dcv_url = item.get(link_field)
```

- This either pulls from DynamoDB the column of `student_ec2_link` or `teacher_ec2_link`.

```python title="Status Check Guard"
if not final_dcv_url or current_status not in ['HEALTHY', 'IN_PROGRESS']:
    print(f"Waiting for ready state. Link: {bool(final_dcv_url)}, Status: {current_status}")
    return {
        'statusCode': 202, # Signal to Frontend: "Accepted, keep polling."
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'message': 'Instance is warming up. Please wait.', 
            'status': current_status 
        })
    }
```

!!! info "Note - Health Check Status"
    We need a confirmation that the EC2 is ready for the user, which is what this guard is for. "Healthy" comes from the health check which is covered in another Phase.

```python title="Status Update"
try:
    table.update_item(
        Key={'id': meeting_id},
        UpdateExpression="SET #s = :new_status",
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':new_status': 'IN_PROGRESS'}
    )
```

- We write to DynamoDB the status of `IN_PROGRESS`.
- `IN_PROGRESS` is a signal that the other user is already in the session. We use it as a guard for termination, which we'll get to after this.

## IAM Role

- **AWSLambdaBasicExecutionRole**, pre-built by AWS
- **DynamoRead**, custom inline

```json title="DynamoRead Policy"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "dynamodb:GetItem",
            "Resource": "arn:aws:dynamodb:us-west-2:034489661489:table/elephant-meetings"
        }
    ]
}
```

!!! tip "Awesome - Complete Flow"
    At this point, you should be able to schedule a meeting, and watch the EC2 instances spin up, and then join them via a redirect URL. Like, just take a pause. We just provisioned virtual machines and fully redirected users into them, and it only took like 4 python scripts and a few extra services. The internet is lit.

---

**Congratulations!** You've completed Phase 4. You should now have a complete flow from scheduling a meeting to launching EC2 instances and redirecting users to their dedicated virtual machines.

