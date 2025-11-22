# Environment Setup

This project uses environment configuration files to store sensitive credentials and API endpoints.

## Initial Setup

1. **Copy the environment template:**
   ```bash
   cp env.example.js env.js
   ```

2. **Edit `env.js` with your actual values:**
   - API Gateway URL for scheduling meetings
   - DCV server endpoints for teacher and student
   - DCV credentials (username and password)

## File Structure

- `env.example.js` - Template file with placeholder values (committed to git)
- `env.js` - Actual configuration with real values (gitignored, **DO NOT COMMIT**)

## Important Security Notes

- ⚠️ **Never commit `env.js` to version control**
- ⚠️ **Never share `env.js` in public repositories**
- ✅ `env.example.js` is safe to commit as it only contains placeholders
- ✅ `.gitignore` is configured to prevent `env.js` from being committed

## What's Stored in env.js

- `API_GATEWAY_URL` - AWS API Gateway endpoint for the scheduling Lambda
- `DCV_TEACHER_SERVER` - DCV server URL for teacher role
- `DCV_TEACHER_USER` - DCV username for teacher
- `DCV_TEACHER_PASSWORD` - DCV password for teacher
- `DCV_STUDENT_SERVER` - DCV server URL for student role
- `DCV_STUDENT_USER` - DCV username for student
- `DCV_STUDENT_PASSWORD` - DCV password for student

## Verifying Git Ignore

To verify that `env.js` is properly gitignored:
```bash
git check-ignore -v env.js
```

If it's working correctly, this should show the `.gitignore` rule that matches it.

