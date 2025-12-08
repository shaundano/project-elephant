import sys
import os
import boto3
import requests

# --- CONFIG ---
TABLE_NAME = "elephant-meetings"
REGION = "us-west-2"
METADATA_PATH = r"C:\scripts\meeting\metadata.env"

def signal_healthy():
    if not os.path.exists(METADATA_PATH): return
    
    sid = None
    with open(METADATA_PATH, 'r') as f:
        for line in f:
            if line.startswith("SESSION_ID="): sid = line.strip().split("=")[1]
            
    iid = "UNKNOWN"
    try:
        token = requests.put("http://169.254.169.254/latest/api/token", headers={"X-aws-ec2-metadata-token-ttl-seconds": "2160"}, timeout=1).text
        iid = requests.get("http://169.254.169.254/latest/meta-data/instance-id", headers={"X-aws-ec2-metadata-token": token}, timeout=1).text
    except: pass

    if sid:
        print(f"Flagging {sid} as HEALTHY on {iid}...")
        try:
            boto3.client('dynamodb', region_name=REGION).update_item(
                TableName=TABLE_NAME, Key={'id': {'S': sid}},
                UpdateExpression="SET #s = :status, instance_id = :inst",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':status': {'S': 'HEALTHY'}, ':inst': {'S': iid}}
            )
            print("DynamoDB update successful.")
        except Exception as e:
            print(f"DB Error: {e}")

if __name__ == "__main__":
    signal_healthy()