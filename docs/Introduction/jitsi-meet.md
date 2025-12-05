# Jitsi Meet

Jitsi itself is an open-source project containing several repositories. The only real important one for the sake of this project is **Jitsi Meet**. This is the main video conferencing application that has been extremely well-maintained and well-documented. It comes in a few forms via their docs, including downloading as a complete docker file that Just Works™. However, you probably don't want that if, like me, you don't really understand Docker and its limitations.

## Setup Advice

**My advice:** before even setting up a Jitsi server, have a purchased domain ready from a major provider like Cloudflare. Also, don't try to run peer-to-peer or locally. I managed to run my own Jitsi server from my own machine, but it requires access to your router so that you can enable port-forwarding ports. I probably spent two weekends trying to use a relay to access my server via STUN/TURN servers. Just skip all that, get AWS free tier, and install it on an EC2.

Holy crap, the handbook actually has [[that exact advice]]. Too bad I didn't listen. But you can, and you should.

