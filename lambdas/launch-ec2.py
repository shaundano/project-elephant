import boto3
import os
import json

# Force us-west-2 to ensure we hit the right Table and EC2 region
ec2 = boto3.client('ec2', region_name='us-west-2')
dynamodb = boto3.resource('dynamodb', region_name='us-west-2')

# DOUBLE CHECK THIS NAME MATCHES YOUR CONSOLE EXACTLY
TABLE_NAME = 'elephant-meetings'

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))

    # 1. Load Config
    ami_id = os.environ['AMI_ID']
    instance_type = os.environ['INSTANCE_TYPE']
    key_name = os.environ['KEY_NAME']
    iam_profile = os.environ['IAM_PROFILE']
    sg_ids = os.environ['SECURITY_GROUP_IDS'].split(',')
    
    # 2. Get ID (Sanitized)
    raw_id = event.get('meeting_id')
    if not raw_id:
        raise ValueError("Error: payload missing 'meeting_id'")
    
    # Strip whitespace to prevent "Ghost Item" creation
    meeting_id = raw_id.strip()
    print(f"Processing Meeting ID: '{meeting_id}'")

    # 3. Network Setup
    vpcs = ec2.describe_vpcs(Filters=[{'Name': 'isDefault', 'Values': ['true']}])
    default_vpc = vpcs['Vpcs'][0]['VpcId']
    subnets = ec2.describe_subnets(Filters=[{'Name': 'vpc-id', 'Values': [default_vpc]}])
    
    valid_subnet_id = None
    supported_azs = ['us-west-2a', 'us-west-2b', 'us-west-2c']
    
    for subnet in subnets['Subnets']:
        if subnet['AvailabilityZone'] in supported_azs:
            valid_subnet_id = subnet['SubnetId']
            break
            
    if not valid_subnet_id:
        raise Exception("No valid subnet found in us-west-2a/b/c")

    # 4. Launch & Update Loop
    roles = ['teacher', 'student']
    launched_ids = {}
    
    table = dynamodb.Table(TABLE_NAME)

    try:
        for role in roles:
            instance_name = f"{meeting_id}_{role}"
            print(f"--- Starting {role} ---")
            
            # A. Launch
            print(f"Launching EC2: {instance_name}")
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
                BlockDeviceMappings=[{
                    'DeviceName': '/dev/xvda',
                    'Ebs': {'VolumeSize': 60, 'VolumeType': 'gp2', 'DeleteOnTermination': True}
                }],
                TagSpecifications=[{
                    'ResourceType': 'instance',
                    'Tags': [
                        {'Key': 'Name', 'Value': instance_name},
                        {'Key': 'MeetingID', 'Value': meeting_id},
                        {'Key': 'Role', 'Value': role}
                    ]
                }]
            )
            
            inst_id = response['Instances'][0]['InstanceId']
            launched_ids[role] = inst_id
            print(f"Launched {role}: {inst_id}")
            
            # B. Update DynamoDB
            column_name = f"{role}_ec2_id"
            print(f"Updating DB Key: {meeting_id} | Col: {column_name} -> {inst_id}")
            
            try:
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
                print(f"DB Update Success: {db_resp}")
            except Exception as db_error:
                print(f"DB WRITE FAILED for {role}: {db_error}")
                # We don't raise here so we ensure the second instance still launches
                # But check CloudWatch if you see this!

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Launched & DB Updated',
                'ids': launched_ids
            })
        }

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        raise e