import json
import boto3
import sys
import os
from urllib import request, error

# --- Configuration ---
METADATA_URL = "http://169.254.169.254/latest/meta-data/instance-id"
TABLE_NAME = "elephant-meetings"
AWS_REGION = "us-west-2"

# --- Set the output file path ---
OUTPUT_DIR = r"C:\scripts\meeting"
OUTPUT_METADATA_PATH = os.path.join(OUTPUT_DIR, "metadata.env")
# --- End Configuration ---

def get_own_instance_id():
    """Fetches the EC2 instance ID from the metadata service."""
    print("Fetching EC2 instance ID...")
    try:
        # Set a short timeout (3 seconds)
        with request.urlopen(METADATA_URL, timeout=3) as response:
            if response.status == 200:
                instance_id = response.read().decode('utf-8')
                print(f"Successfully found Instance ID: {instance_id}")
                return instance_id
            else:
                print(f"Failed to fetch Instance ID. Status: {response.status}")
                return None
    except error.URLError as e:
        print(f"Error connecting to metadata service (is this an EC2?): {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None

def find_meeting_data(instance_id):
    """
    Queries DynamoDB to find all meeting metadata.
    Also determines the user's role (teacher or student).
    """
    if not instance_id:
        print("Cannot find meeting, Instance ID is unknown.")
        return None

    print(f"Querying DynamoDB ({TABLE_NAME}) in region {AWS_REGION} for ID: {instance_id}")
    
    try:
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(TABLE_NAME)
        
        # Scan for the EC2 ID in either teacher or student field
        response = table.scan(
            FilterExpression=(
                boto3.dynamodb.conditions.Attr('teacher_ec2_id').eq(instance_id) |
                boto3.dynamodb.conditions.Attr('student_ec2_id').eq(instance_id)
            )
        )
        
        items = response.get('Items', [])
        
        if items:
            item = items[0] # Grab the first match
            
            # 1. Determine the Role
            role = None
            if item.get('teacher_ec2_id') == instance_id:
                role = 'teacher'
            elif item.get('student_ec2_id') == instance_id:
                role = 'student'
                
            # 2. Extract Data (Use safe defaults if keys are missing)
            metadata = {
                "MEETING_URL": item.get('jitsi_url', 'URL_NOT_FOUND'),
                "USER_ROLE": role,
                # *** FIX: Use 'id' (Primary Key) instead of 'session_id' ***
                "SESSION_ID": item.get('id', 'ID_NOT_FOUND'),
                "TEACHER_NAME": item.get('teacher_name', 'UnknownTeacher'),
                "STUDENT_NAME": item.get('student_name', 'UnknownStudent'),
            }
            
            print(f"Found metadata for role: {metadata['USER_ROLE']}")
            return metadata
        else:
            print("No meeting found in DynamoDB for this Instance ID.")
            return None
            
    except Exception as e:
        print(f"Error querying DynamoDB: {e}")
        return None

def write_metadata_file(metadata):
    """Saves the metadata dictionary to a local .env key=value file."""
    if not metadata or not metadata.get('MEETING_URL'):
        print("No valid metadata to write.")
        return False

    try:
        # Ensure the directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Write the new .env file
        with open(OUTPUT_METADATA_PATH, 'w') as f:
            for key, value in metadata.items():
                # Write in strict KEY=VALUE format (no spaces)
                f.write(f"{key}={value}\n")
                
        print(f"Successfully wrote metadata to: {OUTPUT_METADATA_PATH}")
        return True
    except Exception as e:
        print(f"Error writing to file {OUTPUT_METADATA_PATH}: {e}")
        return False

# --- Main execution ---
if __name__ == "__main__":
    instance_id = get_own_instance_id()
    if instance_id:
        meeting_data = find_meeting_data(instance_id)
        if meeting_data:
            write_metadata_file(meeting_data)
        else:
            print("Could not retrieve meeting data.")
    else:
        print("Could not determine EC2 Instance ID.")

    print("Get meeting link script finished.")