# Schedule-meeting Lambda

When you create your first Lambda, the only thing you should ensure is that your runtime is Python. I went with Python 3.14.

## Key Imports

The most important import for our Lambda is `boto3`. This allows us to perform read / write operations with other AWS services.

## Critical Code Components

Here are the critical pieces of this Lambda:

### Initial Setup

```python
dynamodb = boto3.resource('dynamodb')
scheduler = boto3.client('scheduler')

TABLE_NAME = 'elephant-meetings'
table = dynamodb.Table(TABLE_NAME)
JITSI_DOMAIN = 'meet.christardy.com'
```

- `elephant-meetings` is the name of my DynamoDB table
- `scheduler` refers to EventBridge Scheduler. More on that in a second.
- `JITSI_DOMAIN` refers to the domain that I selected to host my Jitsi server on.

### Meeting ID and Jitsi URL Generation

```python
meeting_id = generate_id()
jitsi_url = f"https://{JITSI_DOMAIN}/{meeting_id}"
```

!!! tip "Awesome - Jitsi Meeting Provisioning"
    Remember that Jitsi provisions meetings on the fly. The way I decided to do this is to just use the random primary key from DynamoDB as the meeting room name. That ensures that there won't be any collisions and I don't need to actually talk to the Jitsi service at all to get a meeting room.

### EventBridge Scheduler

```python
launch_dt = meet_dt - timedelta(minutes=10) 
launch_iso = launch_dt.strftime('%Y-%m-%dT%H:%M:%S')

print(f"Scheduling Launch for: {launch_iso}")

scheduler.create_schedule(
    Name=f"launch-{meeting_id}",
    ScheduleExpression=f"at({launch_iso})",
    Target={
        'Arn': launcher_arn,
        'RoleArn': scheduler_role,
        'Input': json.dumps({'meeting_id': meeting_id})
    },
    FlexibleTimeWindow={'Mode': 'OFF'},
    ActionAfterCompletion='DELETE'
)
```

!!! info "Note - EventBridge Scheduler"
    This is a good time to talk about EventBridge Scheduler. It's a really intelligent AWS service that you can call directly from boto3. It has a GUI just like any other service in AWS, but we are instead calling it programmatically.

    What it does is you can set a timed trigger independent of the Lambda, and have it execute specific behaviour. What I use it for is if a Lambda should call another Lambda, you can use EventBridge.

In this case, the payload from the frontend has a meeting time, which is when the teacher has scheduled the tutoring session. `launch_dt` is defined as that meeting time minus 10 minutes (EC2's need time to spin up, and we will be running our own health checks).

Here are a few more details about the EventBridge object we're creating:

* **`Name`**: Assigns a unique identifier to this schedule using the `meeting_id`.
* **`ScheduleExpression`**: Sets the exact execution time (`at(...)`) using an ISO timestamp.
* **`Target`**: Defines what to trigger (the `launcher_arn`), the permissions to do so (`RoleArn`), and the JSON payload (`Input`) to send.
* **`FlexibleTimeWindow`**: `OFF` ensures that Amazon executes it at the exact time specified.
* **`ActionAfterCompletion`**: Automatically deletes the schedule entry after it runs once.

!!! note "Testing - EventBridge Scheduler"
    Something that is useful for testing: if you schedule a meeting in the past, EventBridge scheduler will trigger right away.

!!! info "Note - Safety Net Scheduler"
    There's another scheduler that handles the meeting safety net, which will be covered later in these docs, but in short, if no one shows up to the scheduled meeting after 15 minutes, it will kill the EC2 instances provisioned so that you don't rack up a huge AWS bill.

### DynamoDB Payload

Here's the payload in `schedule-meeting`:

```json
item = {
    'id': meeting_id, 
    'teacher_name': payload.get('teacher_name'),
    'student_name': payload.get('student_name'),
    'meet_time': meet_time_str, 
    'jitsi_url': jitsi_url,
    'status': 'SCHEDULED', 
    'created_at': datetime.now(timezone.utc).isoformat()
}
```

- Note that this is the payload from the frontend, plus a few more params created in this function.

### Lambda Response

```json
return {
    'statusCode': 200,
    'headers': {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST'
    },
    'body': json.dumps({
        'message': 'Session scheduled!', 
        'id': meeting_id,
        'jitsi_url': jitsi_url,
        'teacher_link': teacher_link, 
        'student_link': student_link 
    })
}
```

- Once this function is successful, it's not just gonna send back "success" to the frontend. It's going to create the links for both the teacher and student to join their provisioned EC2 instances.
- The frontend receives that `statusCode` 200 and will redirect to a modal providing the meeting links.

You'll notice that the links follow a specific format:

```plaintext
teacher_link = f"{frontend_base_url}?id={meeting_id}&role=teacher"
```

!!! note "Testing - Lambda Function"
    To test this Lambda, there is a test panel in the Lambda service. You can send a mock payload, which will actually write to your DB.

## IAM Roles

You'll need a special IAM role for this Lambda. We previously set up IAM roles in Phase 2, so I'll speed through this.

### Role 1: AWSLambdaBasicExecutionRole

- Pre-defined by AWS

### Role 2: SchedulerLogic

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DatabaseWrite",
            "Effect": "Allow",
            "Action": "dynamodb:PutItem",
            "Resource": "arn:aws:dynamodb:*:*:table/elephant-meetings"
        },
        {
            "Sid": "CreateTimer",
            "Effect": "Allow",
            "Action": "scheduler:CreateSchedule",
            "Resource": "*"
        },
        {
            "Sid": "HandOverKeyCard",
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::034489661489:role/ElephantSchedulerRole"
        }
    ]
}
```

### Role 3: Write Meetings

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "dynamodb:PutItem",
            "Resource": "arn:aws:dynamodb:*:034489661489:table/*"
        }
    ]
}
```

## Environment Variables

Also, you're going to need a few environment variables:

| **Key** |
|---------|
| `LAUNCHER_ARN` |
| `SAFETY_NET_ARN` |
| `SCHEDULER_ROLE_ARN` |

!!! info "Note - Environment Variables"
    You can skip or leave the top two blank since we haven't written them yet. We're going to define a specific IAM role for the EventBridge scheduler within the schedule-meeting Lambda.

!!! warning "Warning - IAM Role Names"
    WARNING: they do NOT have the same roles, despite having similar names!

## EventBridge Scheduler Role

Create a new IAM role, and apply the pre-defined AWS role called `LambdaInvoke`. If you don't see that, this is the policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "lambda:InvokeFunction",
            "Resource": "*"
        }
    ]
}
```

Copy the ARN in the top right of the IAM role and add it as an environment variable. This is what gives permissions to the scheduler to call another Lambda.

And that's the gist of the first Lambda, `schedule-meeting`. Now let's set up API Gateway so that we can hit it.

---

**Next: [API Gateway and Testing →](api-gateway.md)**

