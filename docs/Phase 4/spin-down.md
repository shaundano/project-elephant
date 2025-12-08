# Spin Down

We just have two more Lambdas at the end that handle termination. One is called `meeting-safety-net`. The next one is called `terminator`. I think the best way to explain it is via a drawing.

!!! info "Note - Logic Flow"
    (logic chart right here via Figma)

## Turning on Streaming in DynamoDB

![DynamoDB Streams](../images/Phase 4/Screenshot 2025-12-07 at 4.36.47 PM.png)

Go to `exports and streams` in your DynamoDB table. Scroll down to stream details, and turn this on. We're gonna come back to it. Basically, DynamoDB can stream event objects to specific Lambda functions, if you set up a trigger. You know how the `lambda_handler` function typically takes an event as a parameter? Well, the event can come from DynamoDB whenever it changes, like an interrupt. The Lambda doesn't even need to poll the table.

![DynamoDB Stream Configuration](../images/Phase 4/Screenshot 2025-12-07 at 4.37.52 PM.png)

## Safety Net

This function was actually part of `schedule-meeting`. Remember in the configuration of the environment variables?

![Safety Net Configuration](../images/Phase 4/Screenshot 2025-12-07 at 4.51.20 PM.png)

The safety net points to the ARN of this Lambda. Here's the chunk of code that schedules it within the `schedule-meeting` Lambda:

```python title="Scheduling the Safety Net"
safety_dt = meet_dt + timedelta(minutes=15)
safety_iso = safety_dt.strftime('%Y-%m-%dT%H:%M:%S')

print(f"Scheduling Safety Net for: {safety_iso}")

scheduler.create_schedule(
    Name=f"safety-{meeting_id}",
    ScheduleExpression=f"at({safety_iso})",
    Target={
        'Arn': safety_net_arn,
        'RoleArn': scheduler_role,
        # Note: Safety Net Lambda expects 'meetingId' (CamelCase)
        'Input': json.dumps({'meetingId': meeting_id}) 
    },
    FlexibleTimeWindow={'Mode': 'OFF'},
    ActionAfterCompletion='DELETE'
)
```

This will automatically trigger ONCE 15 minutes after the meeting time.

### Code Breakdown

```python title="Safety Net Logic"
# Rule A: No Show
if not has_teacher and not has_student:
    # EXCEPTION: If status is IN_PROGRESS, we assume they are talking but haven't uploaded yet.
    if status == 'IN_PROGRESS':
        print(f"Meeting {meeting_id} is IN_PROGRESS with no data. Assuming long meeting. KEEPING ALIVE.")
        return
    else:
        should_kill = True
        reason = "NO_SHOW_TIMEOUT"
    
# Rule B: Partial (One side uploaded, other never showed up or crashed hard)
elif has_teacher != has_student:
    should_kill = True
    reason = "PARTIAL_NO_SHOW_TIMEOUT"
    
# Rule C: Early Success
# If we are here at T+15m and both have data, it means the Stream Terminator didn't kill it
# (likely because it was < 15 mins duration).
elif has_teacher and has_student:
    should_kill = True
    reason = "15_MIN_SUCCESS"
```

!!! info "Note - Safety Net Termination Rules"
    This is basically the entire safety net logic statement. It will kill the EC2 instances in the following situations at the 15-minute mark:
    
    - **No Show:** If both teacher and student data are empty AND the meeting doesn't say `IN_PROGRESS`, then we assume that nobody showed up
    - **Partial No Show:** If only one person has data written, someone showed up and waited for the other person, but they never showed up
    - **Early Success:** Both student and teacher have data written, suggesting a very short meeting.

```python title="Terminating Instances"
if should_kill:
    print(f"SAFETY NET: Terminating {meeting_id}. Reason: {reason}")
    
    # Collect all possible Instance IDs to be safe
    targets = []
    if 'teacher_ec2_id' in item: targets.append(item['teacher_ec2_id'])
    if 'student_ec2_id' in item: targets.append(item['student_ec2_id'])
    
    targets = list(set([t for t in targets]))
    
    if targets:
        try:
            ec2.terminate_instances(InstanceIds=targets)
            print(f"Terminated EC2s: {targets}")
```

If `should_kill` is set to true by any of the logic statements, then we proceed with terminating all instances using their IDs.

!!! warning "Warning - Safety Net Design"
    Note that I came up with this safety net logic as a proposed solution to some user situations. In a perfect situation, if compute and cost wasn't constrained, maybe a solution would be to ask the teacher, "how long will your meeting be"? And give them a number of hours per month. That way, you can just have it on a timer. It's up to you.

### IAM Role

- **AWSLambdaBasicExecutionRole**, pre-built by Amazon
- **MeetingSafetyNetPolicy**, custom inline

```json title="MeetingSafetyNetPolicy"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowDynamoDBAccess",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:UpdateItem"
            ],
            "Resource": "arn:aws:dynamodb:us-west-2:*:table/elephant-meetings"
        },
        {
            "Sid": "AllowEC2Termination",
            "Effect": "Allow",
            "Action": "ec2:TerminateInstances",
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "aws:RequestedRegion": "us-west-2"
                }
            }
        },
        {
            "Sid": "AllowCloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:us-west-2:*:*"
        }
    ]
}
```

This allows read/write in the DynamoDB, EC2 termination and logging in CloudWatch.

## Termination Lambda

This is the Lambda that will kill beyond the 15 minute mark once data is written for both. It is also the Lambda function that will receive the stream from DynamoDB. We'll do that last.

### Code Breakdown

```python title="Stream Processing"
def lambda_handler(event, context):
    print(f"Stream Processor: Received {len(event['Records'])} records.")
    
    table = dynamodb.Table(TABLE_NAME)
    
    for record in event['Records']:
        if record['eventName'] != 'MODIFY':
            continue
            
        new_image = record['dynamodb']['NewImage']
```

!!! info "Note - DynamoDB Stream Events"
    The event received is from DynamoDB. It iterates through the batch and discards anything that isn't a `MODIFY` event (ignoring new inserts or deletions).
    
    It captures `NewImage`, which is the row's data **after** the update occurred, in DynamoDB JSON format.

```python title="Checking for Complete Data"
has_teacher = 'teacher_session_data' in new_image
has_student = 'student_session_data' in new_image

if not (has_teacher and has_student):
    continue

# 2. Extract Meeting ID
meeting_id = new_image['id']['S']

# 3. Safety Gate: Duration Check
# We calculate duration from the scheduled 'meet_time', not 'created_at'
try:
    # Try 'meet_time' first (Correct logic)
    if 'meet_time' in new_image:
        time_str = new_image['meet_time']['S']
    # Fallback to 'created_at' only if meet_time is missing (Legacy support)
    elif 'created_at' in new_image:
        time_str = new_image['created_at']['S']
        print(f"WARNING: 'meet_time' missing for {meeting_id}. Falling back to 'created_at'.")
    else:
        raise ValueError("No timestamp found")

    # Parse ISO string (handle Z or +00:00)
    start_time = datetime.datetime.fromisoformat(time_str.replace('Z', '+00:00'))
    
    # Ensure start_time is timezone-aware (UTC)
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=datetime.timezone.utc)
        
    now = datetime.datetime.now(datetime.timezone.utc)
    duration_minutes = (now - start_time).total_seconds() / 60
```

!!! info "Note - Duration Check Logic"
    This entire chunk basically says, "from the new_image, if more than 15 minutes have gone by since the meeting time, AND both teacher and student have written data, we can kill the process".

```python title="Terminating EC2 Instances"
if 'teacher_ec2_id' in new_image: targets.append(new_image['teacher_ec2_id']['S'])
if 'student_ec2_id' in new_image: targets.append(new_image['student_ec2_id']['S'])

print(f"DEBUG: Targets identified for kill: {targets}")

terminate_ec2s(targets)
```

Here we actually do the termination.

```python title="Updating Status"
try:
    table.update_item(
        Key={'id': meeting_id},
        UpdateExpression="SET #s = :stat, termination_reason = :reason",
        ConditionExpression="#s <> :stat", 
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':stat': 'TERMINATED', 
            ':reason': 'SUCCESS'
        }
    )
```

Finally, we write to DynamoDB that the status is `TERMINATED`, and the reason is `SUCCESS`.

### IAM Role

- **AWSLambdaBasicExecutionRole**
- **AWSLambdaDynamoDBExecutionRole**
- **LaunchTerminateEC2**, custom inline

```json title="LaunchTerminateEC2 Policy"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:RunInstances",
                "ec2:CreateTags",
                "ec2:DescribeVpcs",
                "ec2:DescribeSubnets",
                "ec2:DescribeInstances",
                "ec2:TerminateInstances"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::034489661489:role/EC2-S3-ReadOnly-Role"
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:PutItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/elephant-meetings"
        }
    ]
}
```

!!! info "Note - Termination Strategy"
    These two functions ensure a semi-smart way to terminate instances. But again, I think that it's over-engineered, if you're not too worried about costs, then you should probably just have the safety net terminate the EC2's after a fixed amount of time.

---

**Congratulations!** You've completed the Spin Down section. You now have a complete termination system that safely manages EC2 instances based on meeting activity and duration.

