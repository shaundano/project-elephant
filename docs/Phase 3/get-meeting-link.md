# Get Meeting Link

We need `get_meeting_link.py` in our `scripts` folder. This script will fetch a meeting link from DynamoDB based on which row contains the EC2's instance ID.

Here are a few important pieces:

```python
METADATA_URL = "http://169.254.169.254/latest/meta-data/instance-id"
TABLE_NAME = "elephant-meetings"
AWS_REGION = "us-west-2"

# --- Set the output file path ---
OUTPUT_DIR = r"C:\scripts\meeting"
OUTPUT_METADATA_PATH = os.path.join(OUTPUT_DIR, "metadata.env")
```

- Static local variables defining where the metadata is, the name of the DynamoDB table, and the region
- `169.254.169.254` is the **Instance Metadata Service (IMDS)**
	- EC2 instances can call it to find out information about themselves from AWS (cool as heck)

```python
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
```

- This is where we scan for the instance id within DynamoDB

```python
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
```

- In the case that there's a match (there should be), we initialize the "role" variable
- Assign the role to either "teacher" or "student"
- Then write the `metadata.env` file
- By knowing the `session_id` and the role, we know exactly where to store the link to the uploaded data

!!! tip "Awesome - Jitsi Meeting Provisioning"
    The meeting URL will be used to dynamically determine our Jitsi meeting room. Fun fact about Jitsi: meetings are provisioned on the fly, meaning that we don't need to send any HTTP request saying "hey Jitsi, spin me up a meeting". You can go to `meet.jitsi.com/vancouveriscool` and it will just be there. Kinda sick.

```python
try:
    # Ensure the directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Write the new .env file
    with open(OUTPUT_METADATA_PATH, 'w') as f:
        for key, value in metadata.items():
            # Write in strict KEY=VALUE format (no spaces)
            f.write(f"{key}={value}\n")
```

- `os` is the library that allows the function to interact with the environment it is running in. We're creating the `metadata.env` file in the location we defined above and writing all the items.

!!! note "Testing - Script Requirements"
    Test this script. The only requirement is that you need a row in DynamoDB with a `session_id` and the EC2's ID in either the `teacher_ec2_id` or `student_ec2_id` column. You can manually put this in easily, which is the upside to DynamoDB.

