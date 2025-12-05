# Amazon Web Services

AWS was the cloud provider that I used, and from this point forward, I will not be using brand-agnostic terms. With that in mind, here are a few of the services and their jargon that you should know about:

## EC2

These are Amazon's virtual machines. You pick the OS, the hardware, the storage, the security groups, the IAM roles. It's a computer in the cloud.

## AMI

If you take a snapshot of an EC2, it's like Amazon takes every byte exactly where it is at a given time and freezes it into an AMI. It is super easy to make one and then create new EC2's from it. Think of it as a saved file that you can clone infinitely.

## IAM

These are permissions in AWS. Wanna write to a database? You need IAM permissions for that. Wanna read a database? There's a **SEPARATE** IAM permission for that. If any services will interact with each other (and they will a whole damn lot), they need IAM permissions. Permissions are inside a Policy which is inside a Role.

## S3

Basically Google Drive. You can write to it via a library called `boto3`, which is basically AWS tools that lets you interact with AWS outside of AWS. The basic unit of S3 is a **bucket**.

## DynamoDB

A database service. It's **NoSQL**, meaning that you don't interact with it via a query language like SQL. In my opinion, this just makes it easier to view / interact with than some of AWS's SQL solutions like RDS.

## Lambda

Lambdas are sick. They're basically serverless and stateless chunks of code that you can trigger in various ways (e.g. EventBridge). If you want to upload a new hot dog recipe to your S3 and your DynamoDB, one lambda can do both. They're like spaghetti strands that make sure information flows through your application.

## API Gateway

This is how I called Lambdas from the frontend. You set up an endpoint that your app can hit like `https://aws.gateway123/join/schedule` and when you hit it, you decide what it does. I had it invoke lambdas with whatever payload my frontend sent.

> **Note:** If I was hosting my domain on AWS, I would probably use something like Route 53, but I used Cloudflare. I'll get to that later.

