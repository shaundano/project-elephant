import boto3
import json
import os

# --- CONFIG FROM ENVIRONMENT VARIABLES ---
TABLE_NAME = 'elephant-meetings' 
AWS_REGION = 'us-west-2'

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)

def lambda_handler(event, context):
    print("Received Event:", json.dumps(event))
    
    path_params = event.get('pathParameters', {})
    meeting_id = path_params.get('meetingId')
    user_role = path_params.get('role') 
    
    if not meeting_id or user_role not in ['teacher', 'student']:
        return {
            'statusCode': 400, 
            'body': json.dumps({'message': 'Invalid meeting ID or role.'}), 
            'headers': {'Access-Control-Allow-Origin': '*'}
        }

    # 1. Fetch Item from DynamoDB
    table = dynamodb.Table(TABLE_NAME)
    response = table.get_item(Key={'id': meeting_id})
    item = response.get('Item')

    if not item:
        return {
            'statusCode': 404, 
            'body': json.dumps({'message': 'Meeting ID not found.'}), 
            'headers': {'Access-Control-Allow-Origin': '*'}
        }

    # 2. Determine the correct link field
    link_field = f"{user_role}_ec2_link" 
    final_dcv_url = item.get(link_field)
    
    # 3. Check Health Status
    current_status = item.get('status', 'PENDING')

    # THE GATE:
    # We allow entry if HEALTHY (Fresh) or IN_PROGRESS (Already started).
    # We BLOCK if PENDING (Booting) or TERMINATED.
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

    # 4. STATE TRANSITION (The new logic)
    # Only perform the write if we are the FIRST one in (Status is HEALTHY).
    # This saves a DB write if the status is already IN_PROGRESS.
    if current_status == 'HEALTHY':
        print(f"First user joining {meeting_id}. Setting status to IN_PROGRESS.")
        try:
            table.update_item(
                Key={'id': meeting_id},
                UpdateExpression="SET #s = :new_status",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':new_status': 'IN_PROGRESS'}
            )
        except Exception as e:
            # Non-fatal error. If DB update fails, we still return the link so the user isn't blocked.
            # But we log it as critical because the Watchdog might kill it later if status stays HEALTHY.
            print(f"CRITICAL: Failed to update status to IN_PROGRESS: {e}")

    # 5. Return the final, live URL
    print(f"Retrieved ready link: {final_dcv_url}")
    
    return {
        'statusCode': 200, 
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'message': 'Link retrieved successfully.',
            'dcv_url': final_dcv_url
        })
    }