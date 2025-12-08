import boto3
import json
import os
import urllib3

# Initialize Clients
ec2 = boto3.client('ec2')
secrets = boto3.client('secretsmanager')
http = urllib3.PoolManager()

# --- CONFIGURATION ---
# These keys must match your Lambda Environment Variables
SECRET_ARN = os.environ['SECRET_ARN'] 
ZONE_ID = os.environ['ZONE_ID'] 
DOMAIN_ROOT = os.environ['DOMAIN_ROOT'] # e.g., "christardy.com"

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
            return

        existing_records = data.get('result', [])
    except Exception as e:
        print(f"Connection Error searching Cloudflare: {e}")
        return

    # 2. Execute Action
    if action == 'CREATE':
        if not ip:
            print("Error: CREATE action requires an IP address.")
            return
            
        print(f"Pointing {record_name} -> {ip}")
        payload = {
            "type": "A", 
            "name": record_name, 
            "content": ip, 
            "ttl": 120,      # 2 minutes TTL (fast propagation)
            "proxied": True # because SDK
        }
        
        if existing_records:
            # Update the old record (in case IP changed)
            rec_id = existing_records[0]['id']
            http.request('PUT', f"{url}/{rec_id}", body=json.dumps(payload), headers=headers)
            print(f"Updated existing record: {rec_id}")
        else:
            # Create new record
            http.request('POST', url, body=json.dumps(payload), headers=headers)
            print("Created new record.")

    elif action == 'DELETE':
        print(f"Cleaning up record: {record_name}")
        if existing_records:
            rec_id = existing_records[0]['id']
            http.request('DELETE', f"{url}/{rec_id}", headers=headers)
            print(f"Deleted record: {rec_id}")
        else:
            print("Record already gone. Nothing to delete.")

def lambda_handler(event, context):
    """Triggered by EventBridge when an EC2 state changes."""
    # Debug: print("Received Event:", json.dumps(event))

    detail = event.get('detail', {})
    instance_id = detail.get('instance-id')
    state = detail.get('state') # Expecting 'running' or 'shutting-down'

    if not instance_id or not state:
        print("Ignoring event: Missing instance-id or state.")
        return

    print(f"Processing Instance: {instance_id} | State: {state}")

    # 1. Get Instance Details (Public IP & Tags)
    try:
        resp = ec2.describe_instances(InstanceIds=[instance_id])
        reservations = resp.get('Reservations', [])
        
        if not reservations:
            print(f"Instance {instance_id} no longer exists in EC2 API.")
            return
            
        inst = reservations[0]['Instances'][0]
        # Convert list of tags [{'Key': 'X', 'Value': 'Y'}] to dict {'X': 'Y'}
        tags = {t['Key']: t['Value'] for t in inst.get('Tags', [])}
        public_ip = inst.get('PublicIpAddress')
        
    except Exception as e:
        print(f"Error describing instance: {e}")
        return

    # 2. Filter: Only act on 'Project Elephant' instances
    # This prevents the Lambda from messing with other servers in your account
    if tags.get('Project') != 'Elephant':
        print("Tag 'Project=Elephant' not found. Ignoring.")
        return

    # 3. Construct Domain Name
    # Format: i-0123456789abcdef0.christardy.com
    record_name = f"{instance_id}.{DOMAIN_ROOT}"

    # 4. Route Logic
    if state == 'running':
        if public_ip:
            update_dns('CREATE', record_name, public_ip)
        else:
            print("Instance is running, but AWS has not assigned a Public IP yet.")
            # Note: If this happens frequently, we might need a short retry logic, 
            # but typically 'running' state guarantees an IP for standard VPCs.
            
    elif state == 'shutting-down':
        # Cleanup immediately when shutdown begins
        update_dns('DELETE', record_name)

    return {'statusCode': 200, 'body': 'Watchdog execution complete'}