import boto3
import os
import datetime
from botocore.exceptions import ClientError

# --- CONFIG ---
TABLE_NAME = 'elephant-meetings'
AWS_REGION = 'us-west-2'

ec2 = boto3.client('ec2', region_name=AWS_REGION)
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)

def terminate_ec2s(instance_ids):
    """
    Terminates a unique list of valid EC2 instance IDs.
    """
    targets = list(set([i for i in instance_ids if i and i != 'UNKNOWN']))
    
    if targets:
        print(f"TERMINATING INSTANCES: {targets}")
        try:
            ec2.terminate_instances(InstanceIds=targets)
            print("Termination signal sent successfully.")
        except ClientError as e:
            print(f"EC2 Termination Warning: {e}")
    else:
        print("No valid instance IDs found to kill.")

def lambda_handler(event, context):
    print(f"Stream Processor: Received {len(event['Records'])} records.")
    
    table = dynamodb.Table(TABLE_NAME)
    
    for record in event['Records']:
        if record['eventName'] != 'MODIFY':
            continue
            
        new_image = record['dynamodb']['NewImage']
        
        # 1. Check Data Completeness
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
            
        except Exception as e:
            print(f"Error parsing time for {meeting_id}: {e}. Defaulting to SAFE (no kill).")
            continue

        if duration_minutes < 15:
            print(f"SAFETY GATE: Meeting {meeting_id} duration {duration_minutes:.1f}m < 15m. Keeping alive.")
            continue

        # 4. EXECUTE KILL
        print(f"SUCCESS: Meeting {meeting_id} complete (Duration: {duration_minutes:.1f}m). Terminating resources.")
        
        targets = []
        
        if 'teacher_ec2_id' in new_image: targets.append(new_image['teacher_ec2_id']['S'])
        if 'student_ec2_id' in new_image: targets.append(new_image['student_ec2_id']['S'])
        
        print(f"DEBUG: Targets identified for kill: {targets}")
        
        terminate_ec2s(targets)
        
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
            print(f"Status updated to TERMINATED for {meeting_id}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                print(f"Meeting {meeting_id} was already terminated.")
            else:
                print(f"Error updating DB: {e}")

    return {"status": "Processed"}