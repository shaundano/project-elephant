import boto3
import os
import json

# Force us-west-2 to ensure we hit the right Table and EC2 region
ec2 = boto3.client('ec2', region_name='us-west-2')
dynamodb = boto3.resource('dynamodb', region_name='us-west-2')

# DOUBLE CHECK THIS NAME MATCHES YOUR CONSOLE EXACTLY
TABLE_NAME = 'elephant-meetings'
table = dynamodb.Table(TABLE_NAME)

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

    # --- NEW STEP: STATE CHECK (Idempotency Guard) ---
    # We fetch the current state of the meeting before doing anything expensive.
    try:
        print(f"Checking existing state for: {meeting_id}")
        current_state = table.get_item(Key={'id': meeting_id})
        current_item = current_state.get('Item', {})
    except Exception as e:
        # If we can't read the DB, fail safely rather than launching blind
        print(f"CRITICAL: Could not read DB state. Aborting to prevent duplicates. Error: {e}")
        raise e
    # --------------------------------------------------

    # 4. Launch & Update Loop
    roles = ['teacher', 'student']
    launched_ids = {}
    
    try:
        for role in roles:
            instance_name = f"{meeting_id}_{role}"
            column_name = f"{role}_ec2_id"
            
            # --- GUARD CLAUSE ---
            # If the DB already has an ID for this role, we assume it's done.
            existing_id = current_item.get(column_name)
            if existing_id:
                print(f"SKIPPING LAUNCH: {role} already exists as {existing_id}")
                launched_ids[role] = existing_id
                continue 
            # --------------------

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
            
            inst_id = response['Instances'][0]['InstanceId']
            launched_ids[role] = inst_id
            print(f"Launched {role}: {inst_id}")
            
            # B. Update DynamoDB
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
                # Important: If DB write fails, the next retry might launch a duplicate 
                # because the DB check will pass (it's empty).
                # The ClientToken added above protects you in this specific edge case.

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