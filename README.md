# Project elephant

## Overview

`Project elephant` is a focused reference implementation that wraps the NICE DCV Web Client SDK with a lightweight UI tailored for remote classroom and lab scenarios. The application presents role-specific connection presets (teacher vs. student), negotiates media permissions, and launches NICE DCV sessions in fullscreen with minimal user interaction.

![Architecture overview](architecture.jpg)

## Key Capabilities

- Role picker that maps to predefined NICE DCV servers and credentials.
- Automated authentication flow with configurable fallbacks for manual credential entry.
- Fullscreen session launch with dynamic resolution requests on resize events.
- Media permissions modal that guides users through enabling webcam and microphone access.
- Vendor SDK packages (`dcvjs`, `nice-dcv-web-client-sdk`) pinned in-repo for deterministic builds.

## Repository Structure

- `index.html` – Static entry point that loads the module bundle.
- `main.js` – Application logic for authentication, connection management, and UI overlays.
- `config.js` – Active environment configuration; copy or adapt from `configexample.js`.
- `dcvjs/` – UMD build of the NICE DCV Web Client SDK and its workers.
- `nice-dcv-web-client-sdk/` – Vendor drop containing ESM/UMD variants and license references.
- `index.css`, `webcam.png`, `mic.png` – Presentation assets used by the modal flows.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Provide configuration**
   - Update `config.js` with the DCV server endpoints, usernames, and passwords appropriate for each role.
   - To avoid committing secrets, keep sensitive values in environment-specific copies (e.g., `config.local.js`) and ignore them in version control.
3. **Serve the application**
   - The project is a static site; use your preferred HTTP server (for example: `npx http-server . -p 8080`) and open the served URL in a Chromium-based browser.
4. **Select a role**
   - Choose “Frank” (student) or “Chris” (teacher) from the launch dialog to connect with the associated preset.

## Development Notes

- The project relies on the NICE DCV Web Client SDK v1.0.0-81 (bundled under `nice-dcv-web-client-sdk-1.0.0-81.zip` for reference).
- When upgrading the SDK, replace the contents of `dcvjs/` (and optionally `nice-dcv-web-client-sdk/`) and verify compatibility with the custom authentication and modal logic in `main.js`.
- Media assets and Cloudscape Design System dependencies are already included; additional UI work can be done directly in `index.css` or by introducing a bundler if React-based components become necessary.

## Additional Resources

- NICE DCV Web Client SDK documentation: https://docs.aws.amazon.com/dcv/latest/adminguide/client-sdk.html
- NICE DCV product page: https://aws.amazon.com/hpc/dcv/
