# Gmail API Setup (One Sender -> Many Recipients)

This guide is for sending OTP emails from your Node backend on Render free tier using **Gmail API (HTTPS)**, not SMTP.

## Why this approach
- Render free blocks outbound SMTP ports (`25/465/587`), so app-password SMTP fails.
- Gmail API uses HTTPS and works fine for backend-to-Google calls.

## What you will create
- Google Cloud project
- Gmail API enabled
- OAuth 2.0 credentials (Client ID + Secret)
- Long-lived Refresh Token (offline access)
- Backend env vars for Gmail API sending

## 1) Create Google Cloud project
1. Open Google Cloud Console: `https://console.cloud.google.com/`
2. Create/select a project.
3. Go to `APIs & Services` -> `Library`.
4. Enable `Gmail API`.

Reference:
- https://developers.google.com/workspace/gmail/api/reference/rest

## 2) Configure OAuth consent screen
1. Go to `APIs & Services` -> `OAuth consent screen`.
2. Choose `External` user type.
3. Fill app name + support email.
4. Add scope: `https://www.googleapis.com/auth/gmail.send`
5. Save.

If app is in testing mode:
- Add your sender Gmail account under `Test users`.

## 3) Create OAuth client credentials
1. Go to `APIs & Services` -> `Credentials`.
2. Click `Create Credentials` -> `OAuth client ID`.
3. App type: `Web application` (recommended for backend token flow).
4. Add redirect URI:
   - `https://developers.google.com/oauthplayground`
5. Save and copy:
   - `Client ID`
   - `Client Secret`

## 4) Generate Refresh Token (offline access)
Use OAuth Playground with your own client credentials.

1. Open OAuth Playground:
   - `https://developers.google.com/oauthplayground/`
2. Click gear icon (top-right):
   - Enable `Use your own OAuth credentials`
   - Paste client ID + client secret
3. In Step 1 scope, add:
   - `https://www.googleapis.com/auth/gmail.send`
4. Click `Authorize APIs`.
5. Sign in with the Gmail account you want as sender.
6. Click `Exchange authorization code for tokens`.
7. Copy `Refresh token`.

Important:
- Ensure offline access is used so you actually receive a refresh token.
- If refresh token is missing, revoke app access and repeat with consent prompt.

References:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send

## 5) Add backend env vars (Render + local)
Add these to `question-generation-backend` environment:

```env
GMAIL_CLIENT_ID=your_google_oauth_client_id
GMAIL_CLIENT_SECRET=your_google_oauth_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token
GMAIL_SENDER=your_sender@gmail.com
GMAIL_OAUTH_REDIRECT_URI=https://developers.google.com/oauthplayground
GMAIL_API_TIMEOUT_MS=10000
```

Notes:
- `GMAIL_SENDER` must be the same account used to grant OAuth consent.
- Do not commit real secrets.

## 6) Deploy and verify
1. Redeploy backend on Render.
2. Trigger `/auth/register` or `/auth/request-password-reset`.
3. Confirm email arrives for external recipient addresses.
4. Check backend logs for Gmail API errors (`401`, `403`, `429`).

## 7) Operational limits and expectations
- Free personal Gmail has daily sending limits; high-volume transactional sending is not ideal.
- For production-scale OTP, domain-based provider (SES/Resend/etc.) is better long term.

Google limit reference:
- https://support.google.com/mail/answer/22839

## 8) Common failures
- `invalid_grant`: refresh token revoked/expired; regenerate token.
- `insufficientPermissions`: wrong scope; must include `gmail.send`.
- `unauthorized_client`: OAuth client not configured correctly.
- `redirect_uri_mismatch`: OAuth client redirect URI missing playground URI.

