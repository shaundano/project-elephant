In this section, we're going to write some scripts building off Ocap, plus introduce the python scripts i wrote to handle the stopping of ocap and the upload to s3. 

The first thing we're going to do is set up the s3 bucket and handle the installation of AWS tools on the ec2 instance. The reason you need to do this is because AWS tools is allows ec2 instances to access AWS services. This is also where we're going to define the IAM role for the EC2.

First, you're going to navigate to the S3 service in AWS. Then, you're going to hit `Create bucket`. And then... you literally just give it a name and hit create. It Just Works <sup>TM</sup>.

![[Screenshot 2025-12-06 at 6.55.52 PM.png]]

(my example)

You now have an S3 bucket that can store files of any type. A bit more on S3: although as an AWS user you have a GUI where you can navigate your files, the public does not. If you want your files accessible by members of the public (including Frank iykyk), go to the Permissions tab, and uncheck ALL the boxes related to `Block public access`.

Then, you're going to write a Bucket policy. If this is your policy, note that pretty much all Permissions policies in AWS are JSON objects. Here's the bucket policy I use for the public to have access to my S3.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObjectAndList",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::elephant-bucket-ocap-recordings",
                "arn:aws:s3:::elephant-bucket-ocap-recordings/*"
            ]
        }
    ]
}
```

This should be enough to make it available. You'll be able to test it later, but the idea is that if you press "Copy URL", you should just be able to copy that into someone's browser and have them download a file, like so:

``` plaintext
https://elephant-bucket-ocap-recordings.s3.us-west-2.amazonaws.com/123_teacher_20251201T051833.zip
```

That's enough on S3. We're now going to set up OCAP such that upon workstation unlock, it will run, and then upon lock (when the user leaves the DCV session), it will stop the OCAP script and upload to your S3 bucket.

Go back to your EC2. And go to the Notepad. You're going to write the following script:

```powershell
# 1. Activate your environment
conda activate ocap-env

# 2. Create the timestamped name
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$baseName = "session_$($timestamp)"

# 3. Create the full path in your required folder
$fullPath = Join-Path -Path "C:\scripts\temp_recordings" -ChildPath $baseName

# 4. Run the ocap command with the full path
ocap $fullPath
```

Then save this as `ocap.ps1`, and ensure that you save as "All files". Save it in your `scripts` folder at the `C:\` level. This is a powershell script, that, when run, will run ocap and write to your temp_recordings folder.

### How to test it

- activate your conda environment, `ocap-env` in Powershell
- navigate to `C:/scripts`
- run ./ocap

This should work.

Now, we're going to write the stop script. The stop_ocap script is a python script that looks for the PID written by the ocap program and sends a SIGINT (if any of this is confusing to you, go back and read Fork Discussion in Phase 1).

I'm not going to provide the full stop script here (it should be in the repo), and I explain it in Fork Discussion. I will just go through some quick points.

``` python
# --- 1. Set the correct path to your PID file ---
PID_FILE = r"C:\scripts\pid\ocap.pid"

# --- 2. Define Windows API functions ---
kernel32 = ctypes.windll.kernel32
CTRL_C_EVENT = 0
```

- Finds the PID file
- Kernel32 is a low-level windows API
- CTRL_C_EVENT is a static local variable

``` python
try:
    with open(PID_FILE, "r") as f:
        pid = int(f.read().strip())
```

- program finds the PID

``` python
kernel32.FreeConsole()
kernel32.AttachConsole(pid)
kernel32.SetConsoleCtrlHandler(None, True)
kernel32.GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0)
kernel32.FreeConsole()
kernel32.SetConsoleCtrlHandler(None, False)
```

- Detach from this program's console
- Attach to the PID's console
- Disable Ctrl + C in this process. Even though we detached, AttachConsole(pid) adds current process to the pid's console which still opens us up 
- Generate Ctrl + C event and send to all processes in the console
- Detach from PID's console
- Re-enable Ctrl + C on this process

## Testing

Put `stop_ocap.py` at the same level as your `ocap.ps1` PowerShell script. Run ocap the same way you did above. You should see the pid file get written in `scripts/pid`. Let OCAP run for a few seconds, and then run:

``` python
python ./stop_ocap.py
```

You should see your OCAP script get terminated gracefully. You'll know that it terminated gracefully if in `temp_recordings`, both your MCAP and MKV videos will not be 0 B large. As a rough rule, whatever MCAP is in KB, MKV will be in MB.

So at this point, you've managed to successfully stop the ocap script from an external program. When we set up task scheduler, we're going to set up the logic that triggers the stop script when a user logs off. But first, we're going to have to configure AWS tools, and the `upload_to_s3` script. Actually, before that, we're going to write our IAM role for the EC2.

### The IAM Role for the EC2

IAM permissions will allow our EC2 to execute commands affecting our S3 bucket. The issue is that my IAM role does a whole lot, and I don't want to jump the gun, but it's probably best for you to use my full IAM role now. Trust me bro.

Go to the IAM AWS service, and create a new role. Follow this config:

- `AWS Service` trusted entity type
- `EC2` Use Case
- Select `AmazonS3FullAccess` for as a default service. These are just pre-built policies.
- Create the role.

Now in the list of all the roles, click your role. Go to Add permissions and select `Create inline policy`. This allows you to paste in a JSON.

The first policy I call `OcapS3WritePolicy`. Here it is:

``` JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowListBucket",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:ListBucketMultipartUploads"
            ],
            "Resource": "arn:aws:s3:::elephant-bucket-ocap-recordings"
        },
        {
            "Sid": "AllowOcapReadWriteToSpecificBucket",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListMultipartUploadParts",
                "s3:AbortMultipartUpload"
            ],
            "Resource": "arn:aws:s3:::elephant-bucket-ocap-recordings/*"
        }
    ]
}
```

This basically allows upload to S3, including multi-part uploading. I'm not exactly sure the use case for that, but I assume that if a file is too big, it will upload it in chunks. I'm not sure the threshold, but it's good to have.

This next role is called 'all-dynamo-db-read'. It just provides full permissions for an ec2 to read a dynamodb table. Again, my roles are kind of a mess, if you aren't in a crunch you can probably be a bit more elegant.

``` JSON
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "VisualEditor0",
			"Effect": "Allow",
			"Action": [
				"dynamodb:DescribeImport",
				"dynamodb:DescribeContributorInsights",
				"dynamodb:ListTagsOfResource",
				"dynamodb:*",
				"dynamodb:GetAbacStatus",
				"dynamodb:DescribeReservedCapacityOfferings",
				"dynamodb:PartiQLSelect",
				"dynamodb:DescribeTable",
				"dynamodb:GetItem",
				"dynamodb:DescribeContinuousBackups",
				"dynamodb:DescribeExport",
				"dynamodb:GetResourcePolicy",
				"dynamodb:DescribeKinesisStreamingDestination",
				"dynamodb:DescribeLimits",
				"dynamodb:BatchGetItem",
				"dynamodb:ConditionCheckItem",
				"dynamodb:Scan",
				"dynamodb:Query",
				"dynamodb:DescribeStream",
				"dynamodb:DescribeTimeToLive",
				"dynamodb:ListStreams",
				"dynamodb:DescribeGlobalTableSettings",
				"dynamodb:GetShardIterator",
				"dynamodb:DescribeGlobalTable",
				"dynamodb:DescribeReservedCapacity",
				"dynamodb:DescribeBackup",
				"dynamodb:DescribeEndpoints",
				"dynamodb:GetRecords",
				"dynamodb:DescribeTableReplicaAutoScaling"
			],
			"Resource": "*"
		}
	]
}
```

Cool. You should have three policies in your role.

![[Screenshot 2025-12-06 at 7.32.31 PM.png]]

This is my IAM permission. Note that "ReadOnly-Role" is a misnomer. This bad boy can 100% write stuff. Don't blame me, there's no `edit name` button and I can't be bothered to look for one.

Attach your role to your EC2.

![[Screenshot 2025-12-06 at 7.43.18 PM.png]]

Now, AWS will allow your EC2 to read and write to dynamoDB and S3, but it doesn't know it yet. Now we need to enable AWS tools on the EC2 itself.
### Enabling AWS tools

You need to install AWS tools for Powershell on the EC2.

``` powershell
Install-Module -Name AWSPowerShell -Force -AllowClobber
```

Run this to be sure it worked:

``` powershell
Get-Module -ListAvailable -Name AWSPowerShell
```

You should see something like:

```plaintext
ModuleType Version    Name
---------- -------    ----
Binary     4.1.892    AWSPowerShell
```

Now, here's the thing. You might not need these AWS tools, because we're about to use a python library called `boto3` which is extremely standard for python to interact with AWS services. But just in case you're going to be executing AWS commands from PowerShell, this is good to have. 

Now. in `C:\scripts`, you're going to add the ./upload_to_s3.py script. Now, again this script is in the repo, but I will describe a few of the lines.

``` python
import boto3
```

You will probably need to install boto3 into your conda environment. Just run:

``` python
pip install boto3
```

``` python
RECORDING_FOLDER = r"C:\scripts\temp_recordings"
S3_BUCKET = "elephant-bucket-ocap-recordings"
AWS_REGION = "us-west-2" # Match the region used in get_meeting_link.py
```

- sets static local variables for where to find the recordings, the s3 bucket name, and the region it's located in.

``` python
mcap_files = glob.glob(os.path.join(RECORDING_FOLDER, "*.mcap"))
mkv_files = glob.glob(os.path.join(RECORDING_FOLDER, "*.mkv"))
files_to_upload = mcap_files + mkv_files

# Construct the public S3 URL (using virtual-hosted style)
s3_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
s3_client.upload_file(archive_path, S3_BUCKET, s3_key)

```

- Finds the files to upload and uploads them

Try all three steps now: run ocap, stop it via `stop_ocap.py` and then upload the data via `upload_to_s3.py`. If this does not work, there are a ton of debug lines within the scripts themselves, hopefully that helps. This part shouldn't be that bad, however.

Keep in mind that the scripts in the repo include steps that we haven't completed yet: we haven't even touched dynamoDB. So if you're getting errors related to stuff we haven't set up yet, just comment out those lines; I tried to make things reasonably modular.

### Automating all of this with task scheduler

**I'm gonna just say this right now**: Task Scheduler is pretty easy to set up, however the settings are quite important. If you are too liberal with how you set this up, there's a strong chance something will not work.

Open Task Scheduler on your EC2. We're going to set up two tasks. The first one is going to Start Ocap. Go to the right hand side in Task Scheduler, and select "Create Task". You should be staring at a screen like this:

![[Screenshot 2025-12-06 at 8.04.33 PM.png]]

First off, go to "Triggers". This will decide how our task will be... triggered. Yeah that might have been obvious. Here's the config for the Trigger:

- Begin the task: On workstation unlock
	- fun fact: there's a whole AWS docs page about Task Scheduler and DCV which as far as I know is WRONG. You might see "connect to user session" as the answer, and if that works for you, mazel tov. This is what I did.
- Any User for now (we haven't configured our KioskUser yet)
- CHECK OFF ENABLED

Now go to Actions. Here's the Config:

- Start a program.
- Program/script: your ocap script. Now, mine is a bit more advanced through this guide, but if I'm not dense it should be: `powershell.exe`
- Arguments: `C:\scripts\ocap.ps1`

**This is important. On the first page, this is the config you need:**

- When running task, use the following user account: Administrator for now
	- Basically, whatever user is meant to run this, select that user.
- Select Run only when user is logged on
- Check Run with highest privileges
- Configure for Windows Server 2022

If you don't do any of this, Windows won't run ocap inside the session; it will run it in a totally separate session. This is not always a bad thing; but basically the user's session is session 1 to Windows, and there is a higher plane of existence called session 0. The issue is that we are trying to capture the user's inputs, and we NEED to run it in this session.

And that's the first task. Now we create the second. I'm gonna speed through this a bit.

### Task 2

name : Stop Ocap

Trigger: On Workstation lock
Any User for now
Enabled

Action: Start a program
Program/script: C:\Users\Administrator\Miniconda3\envs\ocap-env\python.exe
Arguments: C:\scripts\stop_ocap.py

Action: Start a program
Program/script: C:\Users\Administrator\Miniconda3\envs\ocap-env\python.exe
Arguments: C:\scripts\upload_to_s3.py

This one has two actions: first, the stop scripts, then the upload script. Note that these do not necessarily happen synchronously, which is why I put a sleep at the beginning of my upload script.

### Testing

Try this whole setup. You can reboot your ec2 instance if you want things to take effect. Also, if you open `services.msc` in the Run menu, you can find the DCV server and restart it for changes to take effect.

You will know that you were successful if:

1) You log in and you see OCAP boot up
2) Once OCAP is running, you exit out of your DCV viewer, and then you see your s3 bucket get populated by the files

If it's not working, the first thing you should do is enable history in Task Scheduler for your tasks. You will see if there were any errors. Some of the errors are just numbers (8000x), just look those up. Also, on booting up, if it doesn't work, just try logging in again. We'll deal with that later, but I think that the trigger for "first" log in after booting up is treated differently by Windows.











