# Launch EC2

Since we have a lot of Lambdas in this section, it's going to follow a mainly fixed format: environment variables, code breakdown, IAM roles.

## Environment Variables

| **Key** | **Value** |
|---------|-----------|
| **AMI_ID** | `ami-0e7fd79d17e852d18` |
| **IAM_PROFILE** | `EC2-S3-ReadOnly-Role` |
| **INSTANCE_TYPE** | `t3.large` |
| **KEY_NAME** | `shaundano-elephant` |
| **SECURITY_GROUP_IDS** | `sg-0ca7703192305868d,sg-0c0013f4412c040be` |

!!! info "Note - Environment Variables"
    Note that the security groups are the ones that you configured for your EC2 back in Phase 1, and the key name refers to your public and private keys when creating your EC2 as well. This basically allows you to spin up an EC2 instance programmatically.

## Code Breakdown

```python title="Initial Setup"
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

- Defining some local and environment variables. Everything with `os.` uses the `os` library which allows us to use environment variables configured in the Lambda GUI.

```python title="Lambda Handler"
def lambda_handler(event, context):
```

!!! info "Note - EventBridge Event Object"
    Remember how we used EventBridge scheduler in schedule-meeting? This is coming back around. That event object in the lambda_handler IS the event we scheduled. This event is the payload of everything this Lambda needs.

```python title="Availability Zone Selection"
vpcs = ec2.describe_vpcs(Filters=[{'Name': 'isDefault', 'Values': ['true']}])
default_vpc = vpcs['Vpcs'][0]['VpcId']
subnets = ec2.describe_subnets(Filters=[{'Name': 'vpc-id', 'Values': [default_vpc]})

valid_subnet_id = None
supported_azs = ['us-west-2a', 'us-west-2b', 'us-west-2c']

for subnet in subnets['Subnets']:
    if subnet['AvailabilityZone'] in supported_azs:
        valid_subnet_id = subnet['SubnetId']
        break
```

!!! info "Note - Availability Zone Selection"
    This entire chunk is AWS looking for an availability zone to spin up the EC2 instance. This is more relevant for GPU EC2 instances. They are in limited supply, and sometimes your default zone and region won't have any GPUs available, especially from 9-5. Considering that we are now using non-GPU instances, this is less necessary, but it's still good for redundancy.

```python title="Database State Check"
try:
    print(f"Checking existing state for: {meeting_id}")
    current_state = table.get_item(Key={'id': meeting_id})
    current_item = current_state.get('Item', {})
except Exception as e:
    # If we can't read the DB, fail safely rather than launching blind
    print(f"CRITICAL: Could not read DB state. Aborting to prevent duplicates. Error: {e}")
    raise e
```

!!! warning "Warning - Cost Protection"
    The payload gave us the primary key for the DynamoDB, and this is a failsafe in case the id doesn't link to a row in DynamoDB. EC2 costs money, so we don't want to spin up instances for a broken process.

```python title="Instance Launch Loop"
roles = ['teacher', 'student']
launched_ids = {}
```

- We're going to effectively run the launch function twice for each role.

```python title="EC2 Launch Configuration"
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

!!! info "Note - Launch Parameters"
    Ok, this chunk is a bit hefty. We are launching using a bunch of parameters from the environment variables. It will be SUPER easy to switch to a new AMI once you finish working on your EC2, and the same if you decide to change your instance type.

!!! tip "Awesome - ClientToken Protection"
    I found in the past that there would be some sort of race condition or retry logic with this launch function such that it would trigger several times, which is not ideal. The ClientToken is a built-in AWS service that ensures that this whole function will only run once.

```python title="DynamoDB Update"
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

- This updates the DynamoDB for the given id once the EC2 has been successfully launched. It puts the two instance id's in their necessary place: `teacher_ec2_id` and `student_ec2_id`

## IAM Role

Not for the EC2s, which should use your existing EC2 role.

Here's my EC2 Launcher Role:

- **AWSLambdaBasicExecutionRole**, pre-built by AWS
- **EC2 Launch custom inline policy**

```json title="EC2 Launch Policy"
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

---

**Next: [ElephantDNSWatchdog →](dns-watchdog.md)**

