# Phase 3: KioskUser and Health Check

## Overview

In this phase, we'll set up a dedicated KioskUser account that will only be able to access the Jitsi server (or whatever app), while OCAP runs in the background and captures desktop inputs. We'll also implement robust health check logic to ensure everything is ready when the user logs in.

## What You'll Learn

This phase covers creating a kiosk user and implementing health checks:

1. **[Creating KioskUser and Task Scheduler](kioskuser-task-scheduler.md)** - Create the KioskUser account and configure Task Scheduler
2. **[Get Meeting Link](get-meeting-link.md)** - Script to fetch meeting link from DynamoDB
3. **[Health Check](health-check.md)** - Implement health check logic to warm up the EC2
4. **[Master Launch, Invisible Shell, and Fallback](master-launch.md)** - Create launch scripts and invisible shell wrapper
5. **[Autologon](autologon.md)** - Configure automatic login for KioskUser

## Expected Outcome

By the end of this phase, you should have:

- A KioskUser account configured with proper permissions
- Task Scheduler configured for KioskUser
- Scripts to fetch meeting links from DynamoDB
- Health check system to ensure EC2 is ready
- Master launch script with invisible shell wrapper
- Fallback launch script for workstation unlock
- Autologon configured for automatic KioskUser login

---

**Let's get started with [Creating KioskUser and Task Scheduler →](kioskuser-task-scheduler.md)**

