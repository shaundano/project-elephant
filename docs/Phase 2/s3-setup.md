# S3 Setup

The first thing we're going to do is set up the S3 bucket and handle the installation of AWS tools on the EC2 instance. The reason you need to do this is because AWS tools allows EC2 instances to access AWS services. This is also where we're going to define the IAM role for the EC2.

## Creating an S3 Bucket

First, navigate to the S3 service in AWS. Then, hit **Create bucket**. And then... you literally just give it a name and hit create. It Just Works <sup>TM</sup>.

![S3 Create Bucket](../images/Phase 2/Screenshot 2025-12-06 at 6.55.52 PM.png)

You now have an S3 bucket that can store files of any type.

## Configuring Public Access

Although as an AWS user you have a GUI where you can navigate your files, the public does not. If you want your files accessible by members of the public (including Frank iykyk), go to the Permissions tab, and uncheck ALL the boxes related to `Block public access`.

## Bucket Policy

Then, you're going to write a Bucket policy. Note that pretty much all Permissions policies in AWS are JSON objects. Here's the bucket policy to use for the public to have access to your S3:

```json title="Bucket Policy"
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

!!! info "Note - Update Bucket Name"
    Replace `elephant-bucket-ocap-recordings` with your actual bucket name in the policy above.

This should be enough to make it available. You'll be able to test it later, but the idea is that if you press "Copy URL", you should just be able to copy that into someone's browser and have them download a file, like so:

```
https://elephant-bucket-ocap-recordings.s3.us-west-2.amazonaws.com/123_teacher_20251201T051833.zip
```

---

**Next: [IAM Roles and AWS Tools →](iam-aws-tools.md)**

