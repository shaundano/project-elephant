# ElephantDNSWatchdog

This is the function that is going to wait for the state of the launched EC2's to change to "Running", and it's going to do this via a service called EventBridge (CloudWatch Events). We are also going to need to get the API token from Cloudflare and stick it in AWS Secrets Manager.

!!! info "Note - Cloudflare Token Reference"
    Refer to the [Getting a Token from Cloudflare](cloudflare-token.md) section for instructions on obtaining and storing the Cloudflare API token.

## EventBridge (CloudWatch Events)

Go to EventBridge. Then go to Rules on the left tab.

![EventBridge Rules](../images/Phase 4/Screenshot 2025-12-07 at 12.50.06 PM.png)

### Step 1: Create the Rule

1. Click **Create rule**.
2. **Name:** `ElephantEC2StateWatch` (or similar).
3. **Rule type:** Select **Rule with an event pattern**.
4. Click **Next**.

### Step 2: Build the Event Pattern

This is the critical part. You want to filter for **EC2 state changes** but *only* for instances tagged for Project Elephant.

1. Scroll down to **Event pattern**.
2. **Event source:** `AWS services`.
3. **AWS service:** `EC2`.
4. **Event type:** `EC2 Instance State-change Notification`.
5. **Event pattern content:** Click **Edit pattern (JSON)** and paste this exactly. This filters for "running" (to create DNS) and "shutting-down" (to delete DNS), but **only** if the instance has the tag `Project: Elephant`.

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

6. Click **Next**.

### Step 3: Select the Target

1. **Target types:** Select **AWS service**.
2. **Select a target:** Choose **Lambda function**.
3. **Function:** Select `ElephantDNSWatchdog`.
4. Click **Next**, skip the tags screen, and click **Create rule**.

!!! tip "Awesome - EventBridge Automation"
    * **Startup:** When your Launcher spins up an EC2 and tags it `Project: Elephant`, the instance enters the `running` state. EventBridge sees this and fires the Lambda. The Lambda sees "running", gets the IP, and **creates** the DNS record.
    * **Shutdown:** When your script runs `shutdown` (or you manually terminate), the instance enters `shutting-down`. EventBridge fires the Lambda. The Lambda sees "shutting-down", looks up the ID, and **deletes** the DNS record.

    Pretty cool, right?

![EventBridge Configuration](../images/Phase 4/Screenshot 2025-12-07 at 12.28.36 PM.png)

## Environment Variables

| **Key** | **Value** |
|---------|-----------|
| **DOMAIN_ROOT** | `your-domain` |
| **SECRET_ARN** | `prod/elephant/cloudflare` |
| **ZONE_ID** | `zone id from Cloudflare` |

!!! info "Note - Environment Variables"
    You should be getting pretty much all of these from Cloudflare or your DNS provider.

## Code Breakdown

```python title="Initial Setup"
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

- Pretty standard at this point. Just variable setup.

```python title="Fetching the Secret"
resp = secrets.get_secret_value(SecretId=SECRET_ARN)
return json.loads(resp['SecretString'])['CLOUDFLARE_TOKEN']
```

- Fetch the secret from AWS Secrets Manager

```python title="Creating DNS Records"
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

!!! info "Note - A Record Explanation"
    Hey look! A payload. Yeah, we're sending to the Cloudflare API endpoint a payload with the certificate that we want to create. In this situation, we want to create an A certificate for the instance_id whose state changed. It'll be like `i-abc123`.
    
    An A certificate is a specific kind of certificate in DNS. It basically just says "all traffic that hits this subdomain, just point it here." So if I create an A certificate for `edmontonoilers.christardy.com`, I can send anyone who hits that URL to `https://www.nhl.com/canucks/`. Sorry, Connor.

```python title="Database Update After DNS Creation"
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

- This updates our DynamoDB after the A certificates have been created. At this point, we have a pretty nifty piece of data: we have a deterministic URL for how we're going to access the EC2 instance in the frontend. The format is basically:

```plaintext
https://ec2-id.domain.com:8443
```

!!! info "Note - DNS Status"
    You'll see that our next Lambda will check to see if this URL is present. "DNS_WRITTEN" is a status that you can use for testing.

```python title="DNS Deletion on Shutdown"
elif state == 'shutting-down':
    if update_dns('DELETE', record_name):
        update_db_on_dns_event(meeting_id, role, 'DELETE_SUCCESS')
```

- This is the last piece that deletes the A certificate. When we terminate an EC2, it first shuts down, which prompts this watchdog function to delete the A certificates in Cloudflare.

!!! tip "Awesome - Stateless Lambda Intelligence"
    As you can see, the Watchdog is a particularly intelligent Lambda, because while Lambdas are serverless and stateless, this Lambda is always ready to receive events.

## IAM Role

- **AWSLambdaBasicExecutionRole**, pre-built by Amazon
- **SecretsManager read**, which allows us to get the API token.

```json
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

- **WatchdogUpdateItem**, allows read/write to DynamoDB

```json
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

---

**Next: [Frontend Implementation →](frontend-implementation.md)**

