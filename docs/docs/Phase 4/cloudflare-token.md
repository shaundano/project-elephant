# Getting a Token from Cloudflare

This section covers obtaining a Cloudflare API token that will be used by the `ElephantDNSWatchdog` Lambda to manage DNS records programmatically.

## Part 1: Get the Token from Cloudflare

1. Log in to the **Cloudflare Dashboard**.
2. Click the **User Icon** (top right) > **My Profile**.
3. Go to **API Tokens** (left sidebar) > **Create Token**.
4. Use the **Edit Zone DNS** template.
5. Under **Zone Resources**, select:
    * `Include` > `Specific zone` > `your-domain.com` (e.g., *christardy.com*)
6. Click **Continue to summary** > **Create Token**.
7. **Copy the token immediately**. (You won't be able to see it again).

![Cloudflare Token Creation](../images/Phase 4/Screenshot 2025-12-07 at 12.28.36 PM.png)

## Part 2: Store it in AWS Secrets Manager

1. Log in to the **AWS Console** and search for **Secrets Manager**.
2. Click **Store a new secret**.
3. Select **"Other type of secret"**.
4. In the **Key/value pairs** section:
    * **Key:** `CLOUDFLARE_API_TOKEN`
    * **Value:** *(Paste your Cloudflare token here)*
5. Click **Next**.
6. **Secret name:** `ElephantCloudflareToken` (or a name your Lambda expects).
7. Click **Next**, keep defaults, and click **Store**.

![Secrets Manager](../images/Phase 4/Screenshot 2025-12-07 at 12.29.12 PM.png)

!!! info "Note - Token Security"
    Your `ElephantDNSWatchdog` Lambda can now securely retrieve this token to update DNS records.

!!! warning "Warning - Token Storage"
    Make sure to store the token securely. You won't be able to retrieve it again from Cloudflare if you lose it.

---

**This token will be used in the [ElephantDNSWatchdog →](dns-watchdog.md) section.**

