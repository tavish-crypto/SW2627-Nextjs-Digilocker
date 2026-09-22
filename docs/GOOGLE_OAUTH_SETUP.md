# Google OAuth 2.0 Setup Guide for DigiLocker Vault

This guide provides instructions for configuring Google OAuth authentication using Auth.js (NextAuth.js v5) in DigiLocker Vault.

---

## 1. Google Cloud Console Setup

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing project.
3. Go to **APIs & Services** → **OAuth consent screen**:
   - Choose **External** user type (or **Internal** for Google Workspace organizations).
   - Fill in the required application details:
     - App name: `DigiLocker Vault`
     - User support email: your administrative contact email.
     - Developer contact information.
   - Configure Scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Save and continue.
4. Go to **APIs & Services** → **Credentials**:
   - Click **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `DigiLocker Vault Web Client`.
   - **Authorized JavaScript origins**:
     - Local development: `http://localhost:3000`
     - Production: `https://<your-production-domain>`
   - **Authorized redirect URIs**:
     - Local development: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://<your-production-domain>/api/auth/callback/google`
   - Click **Create**.
5. Copy your **Client ID** and **Client Secret**.

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

Add your Google OAuth credentials to `.env.local`:

```env
# Google OAuth 2.0 Credentials (server-only)
AUTH_GOOGLE_ID=your-google-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-google-client-secret

# NextAuth / Session Secret
AUTH_SECRET=your-random-32-byte-base64-secret
```

> [!CAUTION]
> Never commit `.env` or `.env.local` to version control. Keep `AUTH_GOOGLE_SECRET` and `AUTH_SECRET` strictly on the server. Never prefix them with `NEXT_PUBLIC_`.

---

## 3. Callback URL Reference

Auth.js / NextAuth.js App Router route handler automatically listens at:

```text
/api/auth/[...nextauth]
```

Therefore, the exact Google OAuth redirect callback URL is:

* **Development**: `http://localhost:3000/api/auth/callback/google`
* **Production**: `https://<your-production-domain>/api/auth/callback/google`

---

## 4. Architecture & Security Guarantees

* **JWT Sessions**: Session state is stateless and managed via signed JWT tokens. No database session rows are created or required.
* **Minimal Claims**: Only safe identity claims (`id`, `name`, `email`) are exposed in sessions and tokens. Raw OAuth tokens (access tokens, refresh tokens) are never leaked to the client.
* **Unified User Store**: Authenticated Google users are mapped to the vault's user directory (`usersByEmail`), ensuring seamless access to documents and existing authorization checks (`requireAuth()`).
* **Credentials Coexistence**: Users can still sign in using traditional email/password credentials or Google OAuth.
