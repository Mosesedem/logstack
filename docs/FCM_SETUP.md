# Firebase Cloud Messaging (FCM) Setup Guide

## Migration from Legacy API to HTTP v1 API

LogStack now uses Firebase Cloud Messaging HTTP v1 API, which provides enhanced security through OAuth 2.0 authentication instead of the deprecated server key method.

## What Changed?

### Old Setup (Legacy API - Deprecated)

- Used a simple server key string
- Header: `Authorization: key=YOUR_SERVER_KEY`
- Endpoint: `https://fcm.googleapis.com/fcm/send`
- ⚠️ **This method is deprecated and will be removed**

### New Setup (HTTP v1 API - Current)

- Uses a JSON Service Account file
- Header: `Authorization: Bearer <ACCESS_TOKEN>` (auto-generated)
- Endpoint: `https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send`
- ✅ **More secure with short-lived OAuth 2.0 tokens**

## Setup Instructions

### Step 1: Generate Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the ⚙️ (Settings) icon → **Project Settings**
4. Navigate to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. A JSON file will be downloaded (e.g., `your-project-firebase-adminsdk-xxxxx.json`)

⚠️ **IMPORTANT**: Keep this file secret! Never commit it to version control.

### Step 2: Store the Service Account File Securely

```bash
# Create a secure directory for secrets (example for production)
sudo mkdir -p /etc/logstack/secrets
sudo mv ~/Downloads/your-project-firebase-adminsdk-xxxxx.json /etc/logstack/secrets/firebase-service-account.json
sudo chmod 600 /etc/logstack/secrets/firebase-service-account.json
```

For development, you can store it in your project root (but add to `.gitignore`):

```bash
# In your logstack-go directory
mkdir -p secrets
mv ~/Downloads/your-project-firebase-adminsdk-xxxxx.json secrets/firebase-service-account.json
```

### Step 3: Configure Environment Variables

Update your `.env` file or environment variables:

```env
# Path to your Firebase service account JSON file
FCM_SERVICE_ACCOUNT_PATH=/etc/logstack/secrets/firebase-service-account.json

# Your Firebase Project ID (optional - can be inferred from service account)
FCM_PROJECT_ID=your-firebase-project-id
```

For development:

```env
FCM_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
FCM_PROJECT_ID=your-firebase-project-id
```

### Step 4: Update .gitignore

Make sure your `.gitignore` includes:

```
secrets/
*.json
!package.json
!tsconfig.json
.env
.env.local
```

### Step 5: Run Your Server

```bash
go run cmd/server/main.go
```

If configured correctly, you should see:

```
Firebase Cloud Messaging initialized with HTTP v1 API
```

## How It Works

The Firebase Admin SDK automatically:

1. Reads the service account JSON file
2. Generates short-lived OAuth 2.0 access tokens (valid for ~1 hour)
3. Refreshes tokens automatically when they expire
4. Uses the v1 API endpoint for sending messages

No manual token management required!

## Message Format

### Push Notification Structure

```go
{
  "message": {
    "token": "device_fcm_token",
    "notification": {
      "title": "LogStack Alert: Critical Error",
      "body": "[ERROR] Database connection failed"
    },
    "data": {
      "logId": "12345",
      "projectId": "uuid-here",
      "ruleId": "67890",
      "level": "error"
    },
    "android": {
      "priority": "high"
    },
    "apns": {
      "headers": {
        "apns-priority": "10"
      }
    }
  }
}
```

## Troubleshooting

### Error: "failed to initialize Firebase app"

- Check that `FCM_SERVICE_ACCOUNT_PATH` points to a valid JSON file
- Verify the file has correct permissions (readable by the application)
- Ensure the JSON file is a valid Firebase service account file

### Error: "FCM client not initialized"

- Verify `FCM_SERVICE_ACCOUNT_PATH` is set in your environment
- Check server logs for initialization errors

### Error: "no push tokens found for user"

- User hasn't registered their device yet
- Check the `push_tokens` table in your database

### Messages Not Receiving on Device

1. Verify the device token is valid and registered
2. Check Firebase Console → Cloud Messaging for delivery reports
3. Ensure your mobile app is properly configured with Firebase
4. Check device logs for FCM errors

## Production Deployment

### Using Docker Secrets

```dockerfile
# Dockerfile
COPY --chown=app:app secrets/firebase-service-account.json /etc/logstack/secrets/

# docker-compose.yml
environment:
  - FCM_SERVICE_ACCOUNT_PATH=/etc/logstack/secrets/firebase-service-account.json
```

### Using Kubernetes Secrets

```bash
# Create secret
kubectl create secret generic firebase-secret \
  --from-file=service-account.json=./firebase-service-account.json

# Reference in deployment
env:
  - name: FCM_SERVICE_ACCOUNT_PATH
    value: /var/secrets/firebase/service-account.json
volumeMounts:
  - name: firebase-secret
    mountPath: /var/secrets/firebase
    readOnly: true
volumes:
  - name: firebase-secret
    secret:
      secretName: firebase-secret
```

### Using Cloud Provider Secret Managers

**AWS Secrets Manager:**

```go
// Fetch secret at runtime
secret := getSecretFromAWS("firebase-service-account")
// Write to temporary file and set FCM_SERVICE_ACCOUNT_PATH
```

**Google Cloud Secret Manager:**

```bash
gcloud secrets create firebase-service-account \
  --data-file=firebase-service-account.json
```

## Security Best Practices

1. ✅ Never commit service account JSON files to version control
2. ✅ Use environment-specific service accounts (dev, staging, prod)
3. ✅ Rotate service accounts periodically
4. ✅ Use secret management tools in production
5. ✅ Set minimal IAM permissions on service accounts
6. ✅ Monitor FCM usage in Firebase Console

## Testing Push Notifications

```bash
# Send a test alert (assuming you have user with push tokens)
curl -X POST http://localhost:8080/v1/logs \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test error message",
    "level": "error",
    "projectId": "your-project-id"
  }'
```

## API Reference

- [Firebase Admin SDK for Go](https://firebase.google.com/docs/admin/setup)
- [FCM HTTP v1 API](https://firebase.google.com/docs/cloud-messaging/migrate-v1)
- [Send Messages with Admin SDK](https://firebase.google.com/docs/cloud-messaging/send-message)

## Support

For issues or questions:

- Check Firebase Console logs
- Review server logs for detailed error messages
- Consult [Firebase Documentation](https://firebase.google.com/docs/cloud-messaging)
