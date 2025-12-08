# Project elephant

## Documentation

📚 **Full documentation is available at:** [https://shaundano.github.io/project-elephant/](https://shaundano.github.io/project-elephant/)

## Overview

`Project elephant` is a focused reference implementation that wraps the NICE DCV Web Client SDK with a lightweight UI tailored for remote classroom and lab scenarios. The application presents role-specific connection presets (teacher vs. student), negotiates media permissions, and launches NICE DCV sessions in fullscreen with minimal user interaction.

![Architecture overview](frontend/src/assets/architecture.jpg)

## Key Capabilities

- Role picker that maps to predefined NICE DCV servers and credentials.
- Automated authentication flow with configurable fallbacks for manual credential entry.
- Fullscreen session launch with dynamic resolution requests on resize events.
- Media permissions modal that guides users through enabling webcam and microphone access.
- Vendor SDK packages (`dcvjs`, `nice-dcv-web-client-sdk`) pinned in-repo for deterministic builds.

## Repository Structure

- `frontend/` – Frontend application directory
  - `index.html` – Entry point for scheduling meetings.
  - `meeting.html` – Static entry point that loads the DCV connection module bundle.
  - `src/` – Source files directory
    - `src/js/` – JavaScript source files
      - `main.js` – Application logic for authentication, connection management, and UI overlays.
      - `scheduleForm.js` – Meeting scheduling form component.
      - `config.js` – Active environment configuration; copy or adapt from `configexample.js`.
      - `env.example.js` – Environment configuration template.
    - `src/css/` – Stylesheets
      - `index.css` – Main stylesheet.
    - `src/assets/` – Static assets
      - `webcam.png`, `mic.png` – Media control icons.
      - `architecture.jpg` – Architecture diagram.
  - `lib/` – Third-party libraries
    - `lib/dcvjs/` – UMD build of the NICE DCV Web Client SDK and its workers.
    - `lib/nice-dcv-web-client-sdk/` – Vendor drop containing ESM/UMD variants and license references.
  - `lambdas/` – Lambda function source code (for reference/deployment).
- `docs/` – Project documentation
- `scripts/` – Utility scripts

## Getting Started

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```
2. **Provide configuration**
   - Copy `frontend/src/js/env.example.js` to `frontend/src/js/env.js` and fill in your actual values.
   - Update `frontend/src/js/config.js` with the DCV server endpoints, usernames, and passwords appropriate for each role.
   - To avoid committing secrets, keep sensitive values in environment-specific copies (e.g., `env.local.js`) and ignore them in version control.
3. **Serve the application**
   - The project is a static site; navigate to the `frontend/` directory and use your preferred HTTP server (for example: `npx http-server . -p 8080`) and open the served URL in a Chromium-based browser.
4. **Select a role**
   - Choose “Frank” (student) or “Chris” (teacher) from the launch dialog to connect with the associated preset.

## Development Notes

- The project relies on the NICE DCV Web Client SDK v1.0.0-81 (bundled under `nice-dcv-web-client-sdk-1.0.0-81.zip` for reference).
- When upgrading the SDK, replace the contents of `frontend/lib/dcvjs/` (and optionally `frontend/lib/nice-dcv-web-client-sdk/`) and verify compatibility with the custom authentication and modal logic in `frontend/src/js/main.js`.
- Media assets and Cloudscape Design System dependencies are already included; additional UI work can be done directly in `frontend/src/css/index.css` or by introducing a bundler if React-based components become necessary.

## Additional Resources

- NICE DCV Web Client SDK documentation: https://docs.aws.amazon.com/dcv/latest/adminguide/client-sdk.html
- NICE DCV product page: https://aws.amazon.com/hpc/dcv/
