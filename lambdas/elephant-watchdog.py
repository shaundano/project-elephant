import boto3
import json
import os
import urllib3

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

def get_cloudflare_token():
    """Retrieves the API Token securely from AWS Secrets Manager."""
    try:
        resp = secrets.get_secret_value(SecretId=SECRET_ARN)
        return json.loads(resp['SecretString'])['CLOUDFLARE_TOKEN']
    except Exception as e:
        print(f"CRITICAL: Failed to fetch Cloudflare secret: {e}")
        raise e

def update_dns(action, record_name, ip=None):
    """Creates, Updates, or Deletes the DNS record via Cloudflare API."""
    token = get_cloudflare_token()
    url = f"https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/dns_records"
    headers = {
        "Authorization": f"Bearer {token}", 
        "Content-Type": "application/json"
    }

    # 1. Check for existing record with this name
    try:
        search = http.request('GET', url, fields={'name': record_name, 'type': 'A'}, headers=headers)
        data = json.loads(search.data.decode('utf-8'))
        
        if not data.get('success'):
            print(f"Cloudflare API Error: {data.get('errors')}")
            return False

        existing_records = data.get('result', [])
    except Exception as e:
        print(f"Connection Error searching Cloudflare: {e}")
        return False

    # 2. Execute Action
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
        
        if existing_records:
            rec_id = existing_records[0]['id']
            http.request('PUT', f"{url}/{rec_id}", body=json.dumps(payload), headers=headers)
        else:
            http.request('POST', url, body=json.dumps(payload), headers=headers)
        
        return True # DNS creation successful

    elif action == 'DELETE':
        print(f"Cleaning up record: {record_name}")
        if existing_records:
            rec_id = existing_records[0]['id']
            http.request('DELETE', f"{url}/{rec_id}", headers=headers)
            return True
        return True

    return False

# --- NEW FUNCTION TO UPDATE DB STATUS ---
def update_db_on_dns_event(meeting_id, role, action, instance_id=None):
    table = dynamodb.Table(TABLE_NAME)
    
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
            print(f"FATAL DB ERROR on DNS READY SIGNAL: {e}")

    elif action == 'DELETE_SUCCESS':
        # Optional: Mark status as 'TERMINATED' on successful DNS cleanup
        table.update_item(
            Key={'id': meeting_id},
            UpdateExpression="SET #s = :new_status",
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':new_status': 'TERMINATED'
            }
        )
# --- END NEW FUNCTION ---

def lambda_handler(event, context):
    """Triggered by EventBridge when an EC2 state changes."""
    detail = event.get('detail', {})
    instance_id = detail.get('instance-id')
    state = detail.get('state') 

    if not instance_id or not state:
        print("Ignoring event: Missing instance-id or state.")
        return

    print(f"Processing Instance: {instance_id} | State: {state}")

    # 1. Get Instance Details (Tags and IP)
    try:
        resp = ec2.describe_instances(InstanceIds=[instance_id])
        reservations = resp.get('Reservations', [])
        
        if not reservations: return
            
        inst = reservations[0]['Instances'][0]
        tags = {t['Key']: t['Value'] for t in inst.get('Tags', [])}
        public_ip = inst.get('PublicIpAddress')
        
    except Exception as e:
        print(f"Error describing instance: {e}")
        return

    # 2. Filter & Get Metadata
    if tags.get('Project') != 'Elephant': return
    
    meeting_id = tags.get('MeetingID')
    role = tags.get('Role')
    
    if not meeting_id or not role: return

    # 3. Construct Domain Name: [InstanceID].christardy.com
    record_name = f"{instance_id}.{DOMAIN_ROOT}"

    # 4. Route Logic
    if state == 'running':
        if public_ip:
            if update_dns('CREATE', record_name, public_ip):
                # Only update DB if DNS write succeeded
                update_db_on_dns_event(meeting_id, role, 'CREATE_SUCCESS', instance_id)
        else:
            print("Running but no Public IP assigned yet.")
            
    elif state == 'shutting-down':
        if update_dns('DELETE', record_name):
            update_db_on_dns_event(meeting_id, role, 'DELETE_SUCCESS')

    return {'statusCode': 200, 'body': 'Watchdog execution complete'}