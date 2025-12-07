At this point, we have our first lambda where we handle meeting scheduling.

Now we're gonna go ballistic on the lambdas. Things are gonna go pretty quick, but don't worry, wherever we get a bit funky I'll slow down.

BEFORE WE START: you need a domain. If you haven't had any issues with SSL certificates and connectivity yet, you are about to. The moment you start using the DCV SDK, using WebSocket or anything TCP / UDP, you will get screwed.

You don't need to use Cloudflare like me, but these docs will discuss Cloudflare. The main steps are the same for all DNS providers: you will need to be able to install an origin certificate on the ec2, enable HTTPS / SSL certificates, including locally, and be able to create an A certificate for a specific domain. You can use Route 53 and other DNS management services in AWS if you are more comfortable.

This will probably be the most complex section of this project.

(drawing with all the lambdas)

Here's what we're going to do:

- after schedule-meeting, EventBridge scheduler will run launch-ec2, which will spin up two ec2 instances from an AMI.
- ElephantDNSWatchdog will wait for the state of the ec2 to change from "initializing" to "running". Once it does, it will use the Cloudflare API to create a new A certificate on your domain. It will also write the ec2 URL to the dynamoDB.
- Then dcv-url will fetch the url and redirect the user in the frontend.

Later on, when we configure the spin down, we're going to have a 15 minute safety net where we kill any ec2 instances not being used. Then our actual meeting termination will be handled by the Stream feature with dynamoDB, that will send any modifications as an object to the termination lambda. 

So yeah, like 6 lambdas in this section? And honestly, the functions of some of them could be decoupled into more. The moment you need data to move across an architecture, or have one service to talk to another, that's a new lambda. They're really like spaghetti strands.

The first thing you need to do is get your SSL and Origin certificates in order on your EC2. We'll handle this in three parts

### **Part 1: Generate Certificate (Cloudflare)**

1.  Log in to Cloudflare and navigate to **SSL/TLS** > **Origin Server**.
2.  Click **Create Certificate**.
3.  Enter your subdomain (e.g., `dcv.your-domain.com`) in **Hostnames** and click **Create**.
4.  Copy the contents of **Origin Certificate** and **Private Key** separately. Do not close the window yet.
### **Part 2: Install on EC2**

1.  RDP into your EC2 instance as Administrator.
2.  Navigate to: `C:\Windows\System32\config\systemprofile\AppData\Local\NICE\dcv\`
3.  Create two files here using Notepad (save as `All Files`):
    * **`dcv.pem`**: Paste the **Origin Certificate** content.
    * **`dcv.key`**: Paste the **Private Key** content.
4.  Restart the DCV Service:
    * Run `services.msc`.
    * Right-click **DCV Server** > **Restart**.
### **Part 3: Finalize (Cloudflare)**

1.  Go to **SSL/TLS** > **Overview** and set mode to **Full (Strict)**.
2.  Go to **DNS** > **Records**.
3.  Ensure the record for your DCV subdomain is set to **Proxied** (orange cloud).

You can now connect securely via `https://dcv.your-domain.com:8443`.

Now, whatever EC2 you have, it might not be the finished product for this project, but for now you're going to want to create an AMI from it, which is super easy. Go to the EC2 dashboard, select your EC2, and go create an image.

![[Screenshot 2025-12-07 at 11.57.53 AM.png]]

Give it a name, and ensure that the storage size is the same as what you use in your EC2. Note: you can only create an AMI while the EC2 is running or stopped; different resources might claim that it's better when stopped or running, in my experience it really hasn't mattered.

Now that you have that, configure the launch-ec2 lambda.

## Launch EC2 lambda

Since we have a lot of lambdas in this section, it's going to follow a mainly fixed format: environment variables, code breakdown, IAM roles.

### Environment Variables

|**Key**|**Value**|
|---|---|
|**AMI_ID**|`ami-0e7fd79d17e852d18`|
|**IAM_PROFILE**|`EC2-S3-ReadOnly-Role`|
|**INSTANCE_TYPE**|`t3.large`|
|**KEY_NAME**|`shaundano-elephant`|
|**SECURITY_GROUP_IDS**|`sg-0ca7703192305868d,sg-0c0013f4412c040be`|
- Note that the security groups are the ones that you configured for your EC2 back in Phase1, and the key name refers to your public and private keys when creating your EC2 as well. This basically allows you to spin up an EC2 instance programmatically.


### Code breakdown

```python
# Force us-west-2 to ensure we hit the right Table and EC2 region
ec2 = boto3.client('ec2', region_name='us-west-2')
dynamodb = boto3.resource('dynamodb', region_name='us-west-2')

TABLE_NAME = 'elephant-meetings'
table = dynamodb.Table(TABLE_NAME)

ami_id = os.environ['AMI_ID']
instance_type = os.environ['INSTANCE_TYPE']
key_name = os.environ['KEY_NAME']
iam_profile = os.environ['IAM_PROFILE']
sg_ids = os.environ['SECURITY_GROUP_IDS'].split(',')
```

- defining some local and environment variables. Everything with os. uses the `os` library which allows us to use environment variables configured in the Lambda GUI.

``` python
def lambda_handler(event, context):
```

- Remember how we used EventBridge scheduler in schedule-meeting? This is coming back around. That event object in the lambda_handler IS the event we scheduled. This event is the payload of everything this lambda needs.

``` python
    vpcs = ec2.describe_vpcs(Filters=[{'Name': 'isDefault', 'Values': ['true']}])
    default_vpc = vpcs['Vpcs'][0]['VpcId']
    subnets = ec2.describe_subnets(Filters=[{'Name': 'vpc-id', 'Values': [default_vpc]}])
    
    valid_subnet_id = None
    supported_azs = ['us-west-2a', 'us-west-2b', 'us-west-2c']
    
    for subnet in subnets['Subnets']:
        if subnet['AvailabilityZone'] in supported_azs:
            valid_subnet_id = subnet['SubnetId']
            break
```

- This entire chunk is AWS looking for an availability zone to spin up the EC2 instance. This is more relevant for GPU EC2 instances. They are in limited supply, and sometimes your default zone and region won't have any GPUs available, especially from 9-5. Considering that we are now using non-GPU instances, this is less necessary, but it's still good for redundancy.

``` python
try:
        print(f"Checking existing state for: {meeting_id}")
        current_state = table.get_item(Key={'id': meeting_id})
        current_item = current_state.get('Item', {})
    except Exception as e:
        # If we can't read the DB, fail safely rather than launching blind
        print(f"CRITICAL: Could not read DB state. Aborting to prevent duplicates. Error: {e}")
        raise e
```

- The payload gave us the primary key for the dynamoDB, and this is a failsafe in case the id doesn't link to a row in dynamoDB. EC2 costs money, so we don't want to spin up instances for a broken process.

``` python
roles = ['teacher', 'student']
launched_ids = {}
```

- we're going to effectively run the launch function twice for each role.

``` python
response = ec2.run_instances(
                ImageId=ami_id,
                InstanceType=instance_type,
                KeyName=key_name,
                SecurityGroupIds=sg_ids,
                SubnetId=valid_subnet_id,
                IamInstanceProfile={'Name': iam_profile},
                MinCount=1,
                MaxCount=1,
                InstanceInitiatedShutdownBehavior='terminate',
                # OPTIONAL EXTRA SAFETY: AWS ClientToken
                # Even with the DB check, this guarantees AWS itself won't double-provision 
                # if the script runs twice at the exact same millisecond.
                ClientToken=f"{meeting_id}-{role}", 
                BlockDeviceMappings=[{
                    'DeviceName': '/dev/xvda',
                    'Ebs': {'VolumeSize': 60, 'VolumeType': 'gp2', 'DeleteOnTermination': True}
                }],
                TagSpecifications=[{
                    'ResourceType': 'instance',
                    'Tags': [
                        {'Key': 'Name', 'Value': instance_name},
                        {'Key': 'MeetingID', 'Value': meeting_id},
                        {'Key': 'Role', 'Value': role},
                        {'Key': 'Project', 'Value': 'Elephant'}
                    ]
                }]
            )
```

- Ok, this chunk is a bit hefty. We are launching using a bunch of parameters from the environment variables. It will be SUPER easy to switch to a new AMI once you finish working on your EC2, and the same if you decide to change your instance type.
- I found in the past that there would be some sort of race condition or retry logic with this launch function such that it would trigger several times, which is not ideal. The ClientToken is a built-in AWS service that ensures that this whole function will only run once.

``` python
db_resp = table.update_item(
	Key={'id': meeting_id},
	UpdateExpression=f"set {column_name} = :i, #s = :s",
	ExpressionAttributeNames={'#s': 'status'},
	ExpressionAttributeValues={
		':i': inst_id,
		':s': 'LAUNCHED'
	},
	ReturnValues="UPDATED_NEW"
)
```

- This updates the dynamoDB for the given id once the ec2 has been successfully launched. It puts the two instance id's in their necessary place: teacher_ec2_id and student_ec2_id
### IAM Role

- Not for the EC2s, which should use your existing EC2 role.
- Here's my EC2 Launcher Role:

- AWSLambdaBasicExecutionRole, pre-built by AWS
- EC2 Launch custom inline policy

``` JSON
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

## ElephantDNSWatchdog

This is the function that is going to wait for the state of the launched ec2's to change to "Running", and it's going to do this via a service called EventBridge (CloudWatch Events). We are also going to need to get the API token from Cloudflare and stick it in AWS Secrets Manager.

Let's do those things first.

### EventBridge (Cloudwatch Events)

Go to EventBridge. Then go to Rules on the left tab.

![[Screenshot 2025-12-07 at 12.50.06 PM.png]]
### Step 1: Create the Rule

1.  Click **Create rule**.
2.  **Name:** `ElephantEC2StateWatch` (or similar).
3.  **Rule type:** Select **Rule with an event pattern**.
4.  Click **Next**.

### Step 2: Build the Event Pattern

This is the critical part. You want to filter for **EC2 state changes** but *only* for instances tagged for Project Elephant.

1.  Scroll down to **Event pattern**.
2.  **Event source:** `AWS services`.
3.  **AWS service:** `EC2`.
4.  **Event type:** `EC2 Instance State-change Notification`.
5.  **Event pattern content:** Click **Edit pattern (JSON)** and paste this exactly. This filters for "running" (to create DNS) and "shutting-down" (to delete DNS), but **only** if the instance has the tag `Project: Elephant`.

```json
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": {
    "state": ["running", "shutting-down"],
    "tags": {
      "Project": ["Elephant"]
    }
  }
}
```

6.  Click **Next**.

### Step 3: Select the Target

1.  **Target types:** Select **AWS service**.
2.  **Select a target:** Choose **Lambda function**.
3.  **Function:** Select `ElephantDNSWatchdog`.
4.  Click **Next**, skip the tags screen, and click **Create rule**.

* **Startup:** When your Launcher spins up an EC2 and tags it `Project: Elephant`, the instance enters the `running` state. EventBridge sees this and fires the Lambda. The Lambda sees "running", gets the IP, and **creates** the DNS record.
* **Shutdown:** When your script runs `shutdown` (or you manually terminate), the instance enters `shutting-down`. EventBridge fires the Lambda. The Lambda sees "shutting-down", looks up the ID, and **deletes** the DNS record.

Pretty cool, right?

![[Screenshot 2025-12-07 at 12.28.36 PM.png]]
### **Part 1: Get the Token from Cloudflare**

1.  Log in to the **Cloudflare Dashboard**.
2.  Click the **User Icon** (top right) > **My Profile**.
3.  Go to **API Tokens** (left sidebar) > **Create Token**.
4.  Use the **Edit Zone DNS** template.
5.  Under **Zone Resources**, select:
    * `Include` > `Specific zone` > `your-domain.com` (e.g., *christardy.com*)
6.  Click **Continue to summary** > **Create Token**.
7.  **Copy the token immediately**. (You won't be able to see it again).

### **Part 2: Store it in AWS Secrets Manager**

1.  Log in to the **AWS Console** and search for **Secrets Manager**.
2.  Click **Store a new secret**.
3.  Select **"Other type of secret"**.
4.  In the **Key/value pairs** section:
    * **Key:** `CLOUDFLARE_API_TOKEN`
    * **Value:** *(Paste your Cloudflare token here)*
5.  Click **Next**.
6.  **Secret name:** `ElephantCloudflareToken` (or a name your Lambda expects).
7.  Click **Next**, keep defaults, and click **Store**.

![[Screenshot 2025-12-07 at 12.29.12 PM 2.png]]

Your `ElephantDNSWatchdog` Lambda can now securely retrieve this token to update DNS records.

### Environment Variables

| **Key**         | **Value**                  |
| --------------- | -------------------------- |
| **DOMAIN_ROOT** | `your-domain`              |
| **SECRET_ARN**  | `prod/elephant/cloudflare` |
| **ZONE_ID**     | `zone id from Cloudflare`  |

You should be getting pretty much all of these from Cloudflare or your DNS provider.

### Code Breakdown

``` python
# Initialize Clients
ec2 = boto3.client('ec2')
secrets = boto3.client('secretsmanager')
http = urllib3.PoolManager()
dynamodb = boto3.resource('dynamodb', region_name='us-west-2')

# --- CONFIGURATION ---
SECRET_ARN = os.environ['SECRET_ARN'] 
ZONE_ID = os.environ['ZONE_ID'] 
DOMAIN_ROOT = os.environ['DOMAIN_ROOT']
TABLE_NAME = 'elephant-meetings' 
```

- pretty standard at this point. Just variable setup.

``` python
resp = secrets.get_secret_value(SecretId=SECRET_ARN)
return json.loads(resp['SecretString'])['CLOUDFLARE_TOKEN']
```

- fetch the secret from AWS Secrets Manager

``` python
if action == 'CREATE':
	if not ip:
		print("Error: CREATE action requires an IP address.")
		return False
		
	print(f"Pointing {record_name} -> {ip}")
	payload = {
		"type": "A", 
		"name": record_name, 
		"content": ip, 
		"ttl": 120,      
		"proxied": True 
	}
```

- hey look! A payload. Yeah, we're sending to the Cloudflare API endpoint a payload with the certificate that we want to create. In this situation, we want to create an A certificate for the instance_id whose state changed. It'll be like i-abc123.
- An A certificate is a specific kind of certificate in DNS. It basically just says "all traffic that hits this subdomain, just point it here." So if I create an A certificate for edmontonoilers.christardy.com, I can send anyone who hits that URL to https://www.nhl.com/canucks/. Sorry, Connor.

``` python
 if action == 'CREATE_SUCCESS':
        # Status update after DNS record is created
        status = 'DNS_WRITTEN'
        
        # Construct the final DCV URL
        dcv_url = f"https://{instance_id}.{DOMAIN_ROOT}:8443"

        # Dynamically set the key based on the role
        url_field = f"{role}_ec2_link" # teacher_ec2_link or student_ec2_link
        
        print(f"DB WRITE: Setting status to {status} and saving URL {dcv_url}")
        
        try:
            table.update_item(
                Key={'id': meeting_id},
                UpdateExpression=f"SET #s = :new_status, {url_field} = :url",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={
                    ':new_status': status,
                    ':url': dcv_url
                },
                ReturnValues="UPDATED_NEW"
            )
        except Exception as e:
```

- this updates our dynamoDB after the A certificates have been created. At this point, we have a pretty nifty piece of data: we have a deterministic URL for how we're going to access the ec2 instance in the frontend. The format is basically:

``` plaintext
https://ec2-id.domain.com:8443
```

- You'll see that our next lambda will check to see if this url is present. "DNS_WRITTEN" is a status that you can use for testing.

``` python
elif state == 'shutting-down':
        if update_dns('DELETE', record_name):
            update_db_on_dns_event(meeting_id, role, 'DELETE_SUCCESS')
```

- This is the last piece that deletes the A certificate. When we terminate an EC2, it first shuts down, which prompts this watchdog function to delete the A certificates in Cloudflare.

As you can see, the Watchdog is a particularly intelligent Lambda, because while Lambdas are serverless and stateless, this Lambda is always ready to receive events.

### IAM Role

- AWSLambdaBasicExecutionRole, pre-built by Amazon
- SecretsManager read, which allows us to get the API token.

``` JSON
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": "ec2:DescribeInstances",
			"Resource": "*"
		},
		{
			"Effect": "Allow",
			"Action": "secretsmanager:GetSecretValue",
			"Resource": "arn:aws:secretsmanager:us-west-2:*:secret:prod/elephant/cloudflare-*"
		}
	]
}
```

- WatchdogUpdateItem, allows read/write to dynamoDB

```JSON
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"dynamodb:UpdateItem",
				"dynamodb:GetItem"
			],
			"Resource": "arn:aws:dynamodb:us-west-2:034489661489:table/elephant-meetings"
		}
	]
}
```

## Getting this to work in the frontend

Alright, so we're gonna test this whole process. Let's go ahead and schedule a meeting.

![[Screenshot 2025-12-07 at 12.52.28 PM.png]]
([Boonki Goongo](https://www.youtube.com/watch?v=Npxw4Y7w9RE&t=209s) : all my placeholder students are from this video)

If the frontend is working correctly (if not, check the developer console in your browser), you will schedule the meeting, and get to a page like this:

![[Screenshot 2025-12-07 at 12.52.34 PM.png]]

These are the meeting links for both the student and the teacher. The id for the dynamoDB row and their role are passed in as parameters in the header. This will enable the redirect via the get-dcv-url lambda. Copy one, and it will take you here:

![[Screenshot 2025-12-07 at 12.52.42 PM.png]]

Once media permissions are enabled, the "Launch My Meeting" button becomes available. Which is going to trigger a new API Gateway Endpoint and Lambda that we will discuss now.
### Get-dcv-url

The first thing is that we need to define a new API Gateway URL. This one is going to be a bit more complicated than the first one, just follow these steps.

### **1. Create the API**
1.  Navigate to **API Gateway** in the AWS Console.
2.  Click **Create API** > **REST API** > **Build**.
3.  **Settings:**
    * **Protocol:** `REST`
    * **Create new API:** `New API`
    * **API name:** `ElephantJoinAPI`
    * **Endpoint Type:** `Regional`
4.  Click **Create API**.

### **2. Build the Resource Structure**
You need to create a nested path: `/join/{meetingId}/{role}`.

1.  **Create `/join`:**
    * Select the root (`/`) > **Actions** > **Create Resource**.
    * **Resource Name:** `join`
    * Click **Create Resource**.
2.  **Create `/{meetingId}`:**
    * Select `/join` > **Actions** > **Create Resource**.
    * **Resource Name:** `meetingId`
    * **Resource Path:** `{meetingId}` (Ensure curly braces are used).
    * Click **Create Resource**.
3.  **Create `/{role}`:**
    * Select `/{meetingId}` > **Actions** > **Create Resource**.
    * **Resource Name:** `role`
    * **Resource Path:** `{role}`
    * Click **Create Resource**.

### **3. Configure the GET Method**
1.  Select the `/{role}` resource.
2.  Click **Actions** > **Create Method**.
3.  Select **GET** from the dropdown and click the checkmark.
4.  **Setup Integration:**
    * **Integration type:** `Lambda Function`
    * **Use Lambda Proxy integration:** `Check` (Recommended for easy access to path parameters).
    * **Lambda Function:** Enter `GetDcvUrl` (or your specific redirection Lambda name).
    * Click **Save**.

### **4. Deploy**
1.  Click **Actions** > **Deploy API**.
2.  **Deployment stage:** `[New Stage]` (e.g., `prod`).
3.  Click **Deploy**.

Your API should look like this:

![[Screenshot 2025-12-07 at 1.01.53 PM.png]]

- this allows us to pass in headers into the API and still use the GET method. This is ideal because then there's no middle application that needs to store the payload for when the users want to enter their meeting. Think about it, the meeting could be a week away. This link is effectively the storage! Pretty sick.

Now, let's get to the Lambda.
### Environment Variables

None :-)

### Code Breakdown

``` python
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

- The frontend is going to send the primary key from dynamoDB and the role via the header, and the lambda is going to parse those.

``` python
link_field = f"{user_role}_ec2_link" 
final_dcv_url = item.get(link_field)
```

- This either pulls from dynamoDB the column of student_ec2_link or teacher_ec2_link.

``` python

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

- We need a confirmation that the EC2 is ready for the user, which is what this guard is for. "Healthy" comes from the health check which is covered in another Phase.

``` python
try:
	table.update_item(
		Key={'id': meeting_id},
		UpdateExpression="SET #s = :new_status",
		ExpressionAttributeNames={'#s': 'status'},
		ExpressionAttributeValues={':new_status': 'IN_PROGRESS'}
	)
```

- we write to dynamoDB the status of IN_PROGRESS.
- IN_PROGRESS is a signal that the other user is already in the session. We use it as a guard for termination, which we'll get to after this.

### IAM Role

- AWSLambdaBasicExecutionRole, pre-built by AWS
- DynamoRead, custom inline

``` JSON
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

At this point, you should be able to schedule a meeting, and watch the EC2 instances spin up, and then join them via a redirect url. Like, just take a pause. We just provisioned virtual machines and fully redirected users into them, and it only took like 4 python scripts and a few extra services. The internet is lit.


 





