import boto3
import os
from botocore.exceptions import ClientError

# --- CONFIG ---
TABLE_NAME = 'elephant-meetings'
AWS_REGION = 'us-west-2'

ec2 = boto3.client('ec2', region_name=AWS_REGION)
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)

def lambda_handler(event, context):
    print(f"Safety Net Triggered: {event}")
    
    # 1. Robust Input Extraction
    # Handles {'meeting_id': '...'} AND {'meetingId': '...'}
    meeting_id = event.get('meeting_id') or event.get('meetingId')
    
    if not meeting_id:
        print("CRITICAL ERROR: No meeting_id found in payload. Exiting.")
        return

    table = dynamodb.Table(TABLE_NAME)
    response = table.get_item(Key={'id': meeting_id})
    item = response.get('Item')
    
    if not item:
        print(f"Meeting {meeting_id} not found in DB.")
        return

    # 2. Status Check
    status = item.get('status', 'PENDING')
    if status == 'TERMINATED':
        print(f"Meeting {meeting_id} already TERMINATED. Exiting.")
        return

    # 3. Data Check
    has_teacher = bool(item.get('teacher_session_data'))
    has_student = bool(item.get('student_session_data'))
    
    should_kill = False
    reason = ""

    ## Here are following scenarios for early termination:

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

    # Actual execution starts here
    if should_kill:
        print(f"SAFETY NET: Terminating {meeting_id}. Reason: {reason}")
        
        # Collect all possible Instance IDs to be safe
        targets = []
        if 'teacher_ec2_id' in item: targets.append(item['teacher_ec2_id'])
        if 'student_ec2_id' in item: targets.append(item['student_ec2_id'])
        
        targets = list(set([t for t in targets))
        
        if targets:
            try:
                ec2.terminate_instances(InstanceIds=targets)
                print(f"Terminated EC2s: {targets}")
            except ClientError as e:
                print(f"Termination Warning: {e}")
        else:
            print("No active instance IDs found to terminate.")
        
        try:
            table.update_item(
                Key={'id': meeting_id},
                UpdateExpression="SET #s = :stat, termination_reason = :reason",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':stat': 'TERMINATED', ':reason': reason}
            )
            print("DB Status updated to TERMINATED")
        except Exception as e:
            print(f"DB Update Error: {e}")

    return "Safety Check Complete"