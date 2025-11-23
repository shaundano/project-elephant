import json
import boto3
import random
import string
import os
from datetime import datetime, timedelta, timezone

# Initialize Clients
dynamodb = boto3.resource('dynamodb')
scheduler = boto3.client('scheduler')

TABLE_NAME = 'elephant-meetings'
table = dynamodb.Table(TABLE_NAME)
JITSI_DOMAIN = 'meet.christardy.com'

def generate_id():
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
    return f"{suffix}"

def lambda_handler(event, context):
    print(f"EVENT RECEIVED: {json.dumps(event)}")

    # 1. Parse Payload 
    payload = {}
    try:
        if 'body' in event and event['body'] is not None:
            payload = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            payload = event
    except Exception as e:
        return { 'statusCode': 400, 'body': json.dumps({'message': 'Invalid JSON'}) }

    frontend_base_url = payload.get('frontend_base_url')
    if not frontend_base_url:
        # Fail the request if we can't construct the return link
        return { 'statusCode': 400, 'body': json.dumps({'message': 'Missing frontend_base_url parameter.'}) }
        
    # 2. Core Logic
    meeting_id = generate_id()
    jitsi_url = f"https://{JITSI_DOMAIN}/{meeting_id}"
    
    # Load Config for Scheduler
    launcher_arn = os.environ.get('LAUNCHER_ARN')
    scheduler_role = os.environ.get('SCHEDULER_ROLE_ARN')

    # 3. Schedule the Launch (CRITICAL SECTION)
    meet_time_str = payload.get('meet_time') 
    
    if meet_time_str and launcher_arn and scheduler_role:
        try:
            # --- TIMEZONE FIX ---
            dt_base = meet_time_str.split('.')[0].replace('Z', '')
            meet_dt = datetime.fromisoformat(dt_base).replace(tzinfo=timezone.utc)
            trigger_dt = meet_dt - timedelta(minutes=5) 
            trigger_iso = trigger_dt.strftime('%Y-%m-%dT%H:%M:%S')
            
            print(f"Calculated trigger time: {trigger_iso}")
            
            scheduler.create_schedule(
                Name=f"launch-{meeting_id}",
                ScheduleExpression=f"at({trigger_iso})",
                Target={
                    'Arn': launcher_arn,
                    'RoleArn': scheduler_role,
                    'Input': json.dumps({'meeting_id': meeting_id})
                },
                FlexibleTimeWindow={'Mode': 'OFF'},
                ActionAfterCompletion='DELETE'
            )
            print("Schedule created successfully.")
            
        except Exception as e:
            print(f"SCHEDULING FAILED CRITICALLY (Database write continues): {e}")

    # 4. Write to DB
    item = {
        'id': meeting_id, 
        'teacher_name': payload.get('teacher_name'),
        'student_name': payload.get('student_name'),
        'meet_time': meet_time_str, 
        'jitsi_url': jitsi_url,
        'status': 'SCHEDULED', 
        'created_at': datetime.now(timezone.utc).isoformat()
    }

    try:
        table.put_item(Item=item)
        print("Database write successful.")
        
        # --- 5. CONSTRUCT DYNAMIC RETURN LINKS ---
        teacher_link = f"{frontend_base_url}?id={meeting_id}&role=teacher"
        student_link = f"{frontend_base_url}?id={meeting_id}&role=student"
        
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
                'teacher_link': teacher_link, # <--- NEW LINK
                'student_link': student_link  # <--- NEW LINK
            })
        }
    except Exception as db_error:
        print(f"DB ERROR: {db_error}")
        return { 'statusCode': 500, 'body': json.dumps({'message': 'DB Write Error'}) }