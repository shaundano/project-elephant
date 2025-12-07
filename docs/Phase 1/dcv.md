# DCV Setup

NICE DCV (Desktop Cloud Visualization) is Amazon's high-performance remote desktop protocol. It's similar to Remote Desktop but optimized for cloud environments with better performance.

## Initial Connection via RDP

Before we can set up DCV, we need to connect to your Windows EC2 instance using Remote Desktop Protocol (RDP). This allows us to access the full Windows GUI and install software.

### Starting Your Instance

Start your EC2 instance from the EC2 dashboard if it's not already running.

![EC2 Instance Running](../images/Phase 1/Screenshot 2025-12-06 at 4.19.50 PM.png)

### Why RDP Instead of SSH?

If you're familiar with SSH for Linux instances, you might wonder why we're using RDP. The key difference is that Windows servers have a full GUI, and we need to install software from the internet using a web browser—something that's much easier with a graphical interface.

Rather than installing packages via `curl` or package managers, we'll use the Windows GUI to download and install everything we need.

### Windows Remote Desktop Client

You'll need the Windows Remote Desktop app to connect. It's available on most operating systems:

- **Mac**: Available in the App Store
- **Windows**: Built-in Remote Desktop Connection
- **Linux**: Various clients available (Remmina, etc.)

![Windows Remote Desktop App](../images/Phase 1/Screenshot 2025-12-06 at 4.21.22 PM.png)

!!! info "Note - Available Everywhere"
    Windows Remote Desktop is available on your OS of choice. This will allow us to remote into our EC2 before we even have DCV installed.

### Getting Your Connection Details

#### Public IPv4 Address

When you launch your EC2 instance, AWS automatically provisions a public IPv4 address. This address is assigned on startup and may change if you stop and start the instance.

![EC2 Public IPv4 Address](../images/Phase 1/Screenshot 2025-12-06 at 4.25.27 PM.png)

!!! info "Note - Dynamic IP Addresses"
    The public IP address is provisioned automatically on startup and is basically random. We'll have a solution for accessing your EC2 via a static link in the future, but for now, grab the current public IP.

#### Getting RDP Connection Details

Within the EC2 console, click the **Connect** button for your instance. Select the **RDP Client** option.

![EC2 Connect Button with RDP Client Option](../images/Phase 1/Screenshot 2025-12-06 at 4.26.43 PM 2.png)

### Logging In

If you're using a default Windows AMI (which you should be), AWS will provide you with a password at the bottom of the Connect screen.

Use these credentials to log in:

- **Username**: `Administrator`
- **Password**: The password provided by AWS (you can change this later in Windows settings)

![Windows Remote Desktop Login Screen](../images/Phase 1/Screenshot 2025-12-06 at 4.26.31 PM 1.png)

### You're Connected!

Once logged in, you should see the Windows desktop.

![Windows Desktop Connected via Remote Desktop](../images/Phase 1/Screenshot 2025-12-06 at 4.29.01 PM.png)

Welcome! You are now in your remote computer.

!!! info "Note - Performance Note"
    If the framerate is poor, don't worry about that yet. You might be connected via TCP, which is slower than UDP for video streaming. We'll cover optimizations later (check Phase 6 - Optimizations).

## Installing DCV Server

Now that you're connected to your Windows instance via RDP, we need to install the DCV Server on your EC2 instance.

### Download DCV Server

1. Open **Microsoft Edge** on your EC2 instance
2. Navigate to: https://www.amazondcv.com/
3. Download the DCV Server for Windows
4. Run the installer with standard settings

![DCV Client Download Page](../images/Phase 1/Screenshot 2025-12-06 at 4.40.43 PM.png)

!!! info "Note - Installation Process"
    The setup process is pretty straightforward—similar to installing any Remote Desktop software. If you've used Remote Desktop before, the client will feel familiar.

### Additional Downloads

!!! info "Note - Optional Component"
    There's an additional component you can download from the DCV site. I'm not exactly sure what it does, and I didn't see a huge change after downloading it, but it could help down the road. Feel free to install it if you want.

## Installing DCV Client (Local Machine)

Download and install the DCV client on your **local machine** (not the EC2 instance). This is the application you'll use to connect to your EC2 instance.

The client is available for:
- Windows
- macOS
- Linux
- Web browser

## Accessing DCV

There are three ways to access DCV:

1. **Browser Client** - Access via web browser (no installation needed)
2. **Native Client** - The desktop application you just downloaded
3. **SDK** - Programmatic access (we'll use this later)

### Browser Access

To access your EC2 via web browser, use your EC2's public DNS address with port 8443:

```
https://ec2-35-88-162-10.us-west-2.compute.amazonaws.com:8443
```

Replace the example DNS with your actual EC2 public DNS (found in the EC2 console).

!!! info "Note - Default Port"
    Port 8443 is the default port for DCV connections, which is why we configured it in the security group.

## What You Should Have Now

At this point, you should have:

- Successfully connected to your EC2 instance via RDP
- DCV Server installed on your EC2 instance
- DCV Client installed on your local machine
- Ability to connect to your EC2 via DCV (browser or native client)

---

**Next: [OCAP Installation →](ocap.md)**

