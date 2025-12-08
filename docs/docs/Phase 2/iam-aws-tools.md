# IAM Roles and AWS Tools

IAM permissions will allow our EC2 to execute commands affecting our S3 bucket. The issue is that my IAM role does a whole lot, and I don't want to jump the gun, but it's probably best for you to use my full IAM role now. Trust me bro.

## Creating the IAM Role

Go to the IAM AWS service, and create a new role. Follow this config:

- `AWS Service` trusted entity type
- `EC2` Use Case
- Select `AmazonS3FullAccess` as a default service. These are just pre-built policies.
- Create the role.

## Adding Inline Policies

Now in the list of all the roles, click your role. Go to Add permissions and select `Create inline policy`. This allows you to paste in a JSON.

### OcapS3WritePolicy

The first policy is called `OcapS3WritePolicy`. Here it is:

```json title="OcapS3WritePolicy"
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

!!! info "Note - Update Bucket Name"
    Replace `elephant-bucket-ocap-recordings` with your actual bucket name in the policy above.

### DynamoDB Read Policy

This next role is called `all-dynamo-db-read`. It just provides full permissions for an EC2 to read a DynamoDB table. Again, my roles are kind of a mess, if you aren't in a crunch you can probably be a bit more elegant.

```json title="all-dynamo-db-read"
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

![IAM Role Policies](../images/Phase 2/Screenshot 2025-12-06 at 7.32.31 PM.png)

This is my IAM permission. Note that "ReadOnly-Role" is a misnomer. This bad boy can 100% write stuff. Don't blame me, there's no `edit name` button and I can't be bothered to look for one.

## Attaching the Role to EC2

Attach your role to your EC2.

![Attach IAM Role to EC2](../images/Phase 2/Screenshot 2025-12-06 at 7.43.18 PM.png)

Now, AWS will allow your EC2 to read and write to DynamoDB and S3, but it doesn't know it yet. Now we need to enable AWS tools on the EC2 itself.

## Enabling AWS Tools

You need to install AWS tools for PowerShell on the EC2.

```powershell title="Install AWS PowerShell Module"
Install-Module -Name AWSPowerShell -Force -AllowClobber
```

Run this to be sure it worked:

```powershell title="Verify Installation"
Get-Module -ListAvailable -Name AWSPowerShell
```

You should see something like:

```
ModuleType Version    Name
---------- -------    ----
Binary     4.1.892    AWSPowerShell
```

!!! info "Note - AWS Tools vs boto3"
    You might not need these AWS tools, because we're about to use a python library called `boto3` which is extremely standard for python to interact with AWS services. But just in case you're going to be executing AWS commands from PowerShell, this is good to have.

---

**Next: [OCAP Scripts →](ocap-scripts.md)**

