# Phase 4: Spin Up, DNS and Frontend Redirect

## Overview

At this point, we have our first Lambda where we handle meeting scheduling. Now we're gonna go ballistic on the Lambdas. Things are gonna go pretty quick, but don't worry, wherever we get a bit funky I'll slow down.

!!! warning "Warning - Domain Required"
    BEFORE WE START: you need a domain. If you haven't had any issues with SSL certificates and connectivity yet, you are about to. The moment you start using the DCV SDK, using WebSocket or anything TCP / UDP, you will get screwed.

    You don't need to use Cloudflare like me, but these docs will discuss Cloudflare. The main steps are the same for all DNS providers: you will need to be able to install an origin certificate on the EC2, enable HTTPS / SSL certificates, including locally, and be able to create an A certificate for a specific domain. You can use Route 53 and other DNS management services in AWS if you are more comfortable.

This will probably be the most complex section of this project.

## What We're Building

Here's what we're going to do:

- After `schedule-meeting`, EventBridge scheduler will run `launch-ec2`, which will spin up two EC2 instances from an AMI.
- `ElephantDNSWatchdog` will wait for the state of the EC2 to change from "initializing" to "running". Once it does, it will use the Cloudflare API to create a new A certificate on your domain. It will also write the EC2 URL to the DynamoDB.
- Then `dcv-url` will fetch the URL and redirect the user in the frontend.

Later on, when we configure the spin down, we're going to have a 15 minute safety net where we kill any EC2 instances not being used. Then our actual meeting termination will be handled by the Stream feature with DynamoDB, that will send any modifications as an object to the termination Lambda.

!!! info "Note - Lambda Architecture"
    So yeah, like 6 Lambdas in this section? And honestly, the functions of some of them could be decoupled into more. The moment you need data to move across an architecture, or have one service to talk to another, that's a new Lambda. They're really like spaghetti strands.

## What You'll Learn

This phase covers:

1. **[Certificates in Cloudflare](certificates-cloudflare.md)** - Set up SSL certificates for secure DCV connections
2. **[Getting a Token from Cloudflare](cloudflare-token.md)** - Obtain API token for DNS management
3. **[Launch EC2](launch-ec2.md)** - Create Lambda to programmatically spin up EC2 instances
4. **[ElephantDNSWatchdog](dns-watchdog.md)** - Monitor EC2 state changes and manage DNS records
5. **[Frontend Implementation](frontend-implementation.md)** - Integrate meeting links and redirects
6. **[Get DCV URL](get-dcv-url.md)** - Lambda to fetch and redirect users to their EC2 instances

---

**Let's get started with [Certificates in Cloudflare →](certificates-cloudflare.md)**

