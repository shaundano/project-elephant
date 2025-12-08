# Phase 2: OCAP Automation and S3

## Overview

In this section, we're going to write some scripts building off OCAP, plus introduce the python scripts to handle the stopping of OCAP and the upload to S3.

## What You'll Learn

This phase covers automating OCAP and setting up cloud storage:

1. **[S3 Setup](s3-setup.md)** - Create and configure an S3 bucket for storing recordings
2. **[IAM Roles and AWS Tools](iam-aws-tools.md)** - Configure IAM permissions and install AWS tools
3. **[OCAP Scripts](ocap-scripts.md)** - Create scripts for running, stopping, and uploading OCAP recordings
4. **[Task Scheduler](task-scheduler.md)** - Automate OCAP to start on unlock and stop/upload on lock

## Expected Outcome

By the end of this phase, you should have:

- An S3 bucket configured for storing OCAP recordings
- IAM roles configured for EC2 to access S3
- Scripts to run, stop, and upload OCAP recordings
- Task Scheduler automation to trigger OCAP on workstation unlock/lock

---

**Let's get started with [S3 Setup →](s3-setup.md)**

