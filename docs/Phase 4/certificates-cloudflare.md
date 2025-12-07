# Certificates in Cloudflare

The first thing you need to do is get your SSL and Origin certificates in order on your EC2. We'll handle this in three parts.

## Part 1: Generate Certificate (Cloudflare)

1. Log in to Cloudflare and navigate to **SSL/TLS** > **Origin Server**.
2. Click **Create Certificate**.
3. Enter your subdomain (e.g., `dcv.your-domain.com`) in **Hostnames** and click **Create**.
4. Copy the contents of **Origin Certificate** and **Private Key** separately. Do not close the window yet.

## Part 2: Install on EC2

1. RDP into your EC2 instance as Administrator.
2. Navigate to: `C:\Windows\System32\config\systemprofile\AppData\Local\NICE\dcv\`
3. Create two files here using Notepad (save as `All Files`):
    * **`dcv.pem`**: Paste the **Origin Certificate** content.
    * **`dcv.key`**: Paste the **Private Key** content.
4. Restart the DCV Service:
    * Run `services.msc`.
    * Right-click **DCV Server** > **Restart**.

## Part 3: Finalize (Cloudflare)

1. Go to **SSL/TLS** > **Overview** and set mode to **Full (Strict)**.
2. Go to **DNS** > **Records**.
3. Ensure the record for your DCV subdomain is set to **Proxied** (orange cloud).

!!! note "Testing - Secure Connection"
    You can now connect securely via `https://dcv.your-domain.com:8443`.

## Creating an AMI

Now, whatever EC2 you have, it might not be the finished product for this project, but for now you're going to want to create an AMI from it, which is super easy. Go to the EC2 dashboard, select your EC2, and go create an image.

![Create AMI](../images/Phase 4/Screenshot 2025-12-07 at 11.57.53 AM.png)

Give it a name, and ensure that the storage size is the same as what you use in your EC2.

!!! info "Note - AMI Creation State"
    Note: you can only create an AMI while the EC2 is running or stopped; different resources might claim that it's better when stopped or running, in my experience it really hasn't mattered.

Now that you have that, configure the launch-ec2 Lambda.

---

**Next: [Launch EC2 →](launch-ec2.md)**

