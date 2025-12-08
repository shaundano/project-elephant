In this section, we're going to do a few things: set up API gateway for the first time which will establish API endpoints that we can hit from the frontend, which will call some lambda functions that modify our DynamoDB. If this sounds like gibberish to you, go back to the Introduction where I discuss various AWS services present in this project.

## DynamoDB

DynamoDB is super easy to set up, it's about as easy as S3. We're going to have quite a few fields in ours. Go over to DynamoDB and just create a table. The only thing you should know about if you're new to databases is the Primary Key. Primary keys are unique identifiers for a row within the database. If a primary key for a given row is present in another table, this is called a foreign key. This is how relational databases work; if you have a customer table and a payment method table, you would put the primary key for the payment method row in customer table, which guarantees that the payment method in the customer table will have a corresponding item in the primary key table. This is all useless here since we're only using one table, I just like to yap.

The cool thing about dynamoDB is that columns will just show up if you write to a column. Like if we send an object with "first_name and last_name", we will get those columns automatically. Pretty awesome. We don't really need to do anything else.  Before writing the actual function that writes to our database, we're going to switch gears into frontend and look at the actual data we're going to send when we schedule a meeting.
## The frontend

- The first thing you should do is access the frontend wireframe via the repository. The way that I run things locally is using Live Server, which is a really useful plugin for VSCode when running anything static; vanilla JS and HTML are perfect for this.

![[Screenshot 2025-12-07 at 9.05.50 AM.png]]
![[Screenshot 2025-12-07 at 9.05.58 AM.png]]

`index.html` is the entry point for my simple frontend. If you launch with Live Server, you should see this:

![[Screenshot 2025-12-07 at 9.07.50 AM.png]]

- Note that my frontend is super basic and mostly AI-generated. In a production environment, you would probably integrate 3rd party components, would make all the underlying API calls. Therefore the HTTP requests are the most important part.

These are the two most important chunks in scheduleForm.js:

```Javascript
 const payload = {
            teacher_name: teacherName,
            student_name: studentName,
            meet_time: convertToISOString(meetTime, timezone),
            frontend_base_url: frontendBaseUrl
        };
```

- this defines the payload that we're going to send to our API Gateway.

```JavaScript
const response = await fetch(API_GATEWAY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
```

- And this is the actual request. Note that it is a POST request, meaning that it actually has a payload.
- API_GATEWAY_URL is a static variable that I define in my .env file. I think that you should probably keep your API URLs hidden. Normally, you can have a secret key for accessing an API, but I don't have one (lol). I may have defined one in AWS, but if that is the case, I'm not exactly sure how that would vet local traffic. The only thing I can imagine is that with a security group, you can limit which IP addresses get through. Regardless, I'm not gonna share my URL and you should probably be more secure than I was.

At this point, you don't have an API URL, so the frontend won't do anything. We're going to set up API Gateway so that we have an endpoint to hit, but first we need to write our schedule meeting lambda. We're going to write it pretending we already have a way to send this whole payload to it.

### Schedule-meeting Lambda

When you create your first lambda, the only thing you should ensure is that your runtime is Python. I went with Python 3.14.

The most important import for our lambda is `boto3`. This allows us to perform read / write operations with other AWS services.

Here are the critical pieces of this Lambda:

```python
dynamodb = boto3.resource('dynamodb')
scheduler = boto3.client('scheduler')

TABLE_NAME = 'elephant-meetings'
table = dynamodb.Table(TABLE_NAME)
JITSI_DOMAIN = 'meet.christardy.com'
```

- elephant-meetings is the name of my dynamoDB
- scheduler refers to EventBridge scheduler. More on that in a second.
- Jitsi domain refers to the domain that I selected to host my Jitsi server on. 


```python
meeting_id = generate_id()
jitsi_url = f"https://{JITSI_DOMAIN}/{meeting_id}"
```
- Remember that Jitsi provisions meetings on the fly. The way I decided to do this is to just use the random primary key from dynamoDB as the meeting room name. That ensures that there won't be any collisions and I don't need to actually talk to the Jitsi service at all to get a meeting room.

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

This is a good time to talk about EventBridge Scheduler. It's a really intelligent AWS service that you can call directly from boto3. It has a GUI just like any other service in AWS, but we are instead calling it programmatically.

What it does is you can set a timed trigger independent of the lambda, and have it execute specific behaviour. What I use it for is if a lambda should call another lambda, you can use EventBridge. 

In this case, the payload from the frontend has a meeting time, which is when the teacher has scheduled the tutoring session. launch_dt is defined as that meeting time minus 10 minutes (ec2's need time to spin up, and we will be running our own health checks). Here are a few more details about the EventBridge object we're creating:

* **`Name`**: Assigns a unique identifier to this schedule using the `meeting_id`.
* **`ScheduleExpression`**: Sets the exact execution time (`at(...)`) using an ISO timestamp.
* **`Target`**: Defines what to trigger (the `launcher_arn`), the permissions to do so (`RoleArn`), and the JSON payload (`Input`) to send.
* **`FlexibleTimeWindow`**: `OFF` ensures that Amazon executes it at the exact time specified.
* **`ActionAfterCompletion`**: Automatically deletes the schedule entry after it runs once.

Something that is useful for testing: if you schedule a meeting in the past, EventBridge scheduler will trigger right away.

There's another scheduler that handles the meeting safety net, which will be covered later in these docs, but in short, if no one shows up to the scheduled meeting after 15 minutes, it will kill the ec2 instances provisioned so that you don't rack up a huge AWS bill.

here's the payload in schedule-meeting:

```JSON
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

```JSON
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
- The frontend receives that statusCode 200 and will redirect to a modal providing the meeting links. You'll notice that the links follow a specific format:

```plaintext
teacher_link = f"{frontend_base_url}?id={meeting_id}&role=teacher"
```

To test this lambda, there is a test panel in the Lambda service. You can send a mock payload, which will actually write to your DB.

You'll need a special IAM role for this lambda. We previously set up IAM roles in Phase 1 So I'll speed through this.

### Role 1: AWSLambdaBasicExecutionRole

- pre-defined by AWS

### Role 2: SchedulerLogic

```JSON
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

```JSON
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

Also, you're going to need a few environment variables. 

|**Key**|
|---|
|LAUNCHER_ARN|
|SAFETY_NET_ARN|
|SCHEDULER_ROLE_ARN|
You can skip or leave the top two blank since we haven't written them yet. We're going to define a specific IAM role for the EventBridge scheduler within the schedule-meeting lambda. WARNING: they do NOT have the same roles, despite having similar names!

Create a new IAM role, and apply the pre-defined AWS role called `LambdaInvoke.`If you don't see that, this is the policy:

```JSON
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

Copy the ARN in the top right of the IAM role and add it as an environment variable. This is what gives permissions to the scheduler to call another lambda.

And that's the gist of the first lambda, schedule-meeting. Now let's set up API Gateway so that we can hit it.
### API Gateway

Navigate to API Gateway in AWS, and create a new one. Then select REST API.

![[Screenshot 2025-12-07 at 9.21.51 AM.png]]

Configure it like this:

- Name it schedule
- Go with any recommended security policy
- Keep everything else default

![[Screenshot 2025-12-07 at 9.22.58 AM.png]]

Now we need to create the actual endpoint (resource)

- In your API dashboard, click **Actions** > **Create Resource**.
- **Resource Name:** Enter `schedule`.
- **Resource Path:** This should auto-fill as `/schedule`.
- Check CORS.
	- **CORS (Cross-Origin Resource Sharing)** is a browser security feature that blocks web pages from making API requests to a different domain. You 100% need it if you're calling the API from a frontend.
- Click **Create Resource**.

Next, you need to create the POST method with this config:

- Method type: POST
- Integration type: Lambda
- Lambda function: your region, and find the ARN for your lambda
	- Note: ARN (Amazon Resource Name) is your service's unique ID across AWS services.

Once you've set that up, ensure that you've enabled CORS one more time. Just select the POST method in the menu and enable CORS in the top right. Then deploy the API. You'll have to probably define the environment you're deploying in, just call it "prod".

```plaintext
https://{gateway-id}.execute-api.us-west-2.amazonaws.com/prod
```

Now if you replace API_GATEWAY_URL with your url in this way, you'll be able to hit the POST method.

That's it. You should be able to schedule a meeting via the frontend, have it write to the database, and have an EventBridge scheduled task invoke the launch-ec2 lambda function. Although we haven't set that one up yet, here's how you can test Lambdas.

![[Screenshot 2025-12-07 at 10.09.14 AM.png]]

- Go to Monitor, and then View CloudWatch logs. Every execution of the lambda should have a log, and any print statements, plus built-in logs will display there. if successful, you should see a line like:

```plaintext
Scheduling Launch for: 2025-11-30T22:23:00
```

