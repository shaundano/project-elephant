import boto3
import json
import os

# --- CONFIG FROM ENVIRONMENT VARIABLES ---
# We ONLY need the TABLE NAME for the lookup. Credentials are unnecessary here.
TABLE_NAME = 'elephant-meetings' 
AWS_REGION = 'us-west-2'

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)

def lambda_handler(event, context):
    print("Received Event:", json.dumps(event))
    
    # API Gateway passes path parameters in the 'pathParameters' key
    path_params = event.get('pathParameters', {})
    meeting_id = path_params.get('meetingId')
    user_role = path_params.get('role') # Will be 'teacher' or 'student'
    
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
    # If role=teacher, we look for 'teacher_ec2_link'
    link_field = f"{user_role}_ec2_link" 
    
    final_dcv_url = item.get(link_field) 
    
    if not final_dcv_url:
        # This means the Watchdog hasn't fired yet OR the EC2 launch failed.
        return {
            'statusCode': 202, # Signal to Frontend: "Accepted, still processing."
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'message': 'Server link not ready. Please wait.', 
                'status': item.get('status', 'PENDING')
            })
        }

    # 3. Return the final, live URL
    print(f"Retrieved final link: {final_dcv_url}")
    
    return {
        'statusCode': 200, 
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'message': 'Link retrieved successfully.',
            'dcv_url': final_dcv_url
        })
    }