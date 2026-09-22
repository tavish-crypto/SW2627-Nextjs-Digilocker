# Environment Variables Configuration Guide

## Overview

DigiLocker Vault uses environment variables to configure behavior for different environments (development, staging, production). This guide explains how to set up and manage these variables.

## File Structure

```
project/
├── .env.example              # Template with all variables documented
├── .env.local               # Local development (not committed)
├── .env.production.example  # Production template (for reference)
├── .env.staging             # Staging (if needed)
└── src/lib/env.js          # Environment validation & loading
```

## Key Files

### `.env.example`
Complete template documenting every environment variable with:
- Default values
- Descriptions
- Whether it's public (NEXT_PUBLIC_*) or server-only
- Production checklist

**Usage:** Copy to `.env.local` and fill in values for development.

### `.env.local`
Development environment with sensible defaults:
- Uses local S3-compatible storage (MinIO)
- SQLite database for easy setup
- Authentication disabled
- Debug logging enabled
- **NOT committed to version control** (.gitignore)

### `.env.production.example`
Production environment template showing:
- Required production settings
- Recommended AWS S3 configuration
- PostgreSQL/MySQL database setup
- All security features enabled
- Deployment platform guidance

### `.src/lib/env.js`
Type-safe environment variable access with:
- Validation functions
- Default values
- Error messages
- Helper methods (isProduction, isDevelopment, etc.)

**Usage in code:**
```javascript
import { env } from '@/src/lib/env'

const maxFileSize = env.MAX_FILE_SIZE_MB  // 10
const appUrl = env.NEXT_PUBLIC_APP_URL    // "http://localhost:3000"
```

## Environment Variables by Category

### Application Environment

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `NEXT_PUBLIC_APP_ENV` | ✓ | Environment name | `development`, `production` |
| `NEXT_PUBLIC_APP_NAME` | ✓ | App display name | `DigiLocker Vault` |
| `NEXT_PUBLIC_APP_URL` | ✓ | Application base URL | `http://localhost:3000` |
| `NODE_ENV` | ✗ | Node.js environment | `production` (auto in production) |

### API Configuration

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | ✓ | API endpoint base | `/api` |
| `API_TIMEOUT` | ✗ | Request timeout (ms) | `30000` |
| `API_LOG_ENABLED` | ✗ | Enable API logging | `true` / `false` |

### Cloud Storage (S3)

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `NEXT_PUBLIC_STORAGE_BUCKET` | ✓ | S3 bucket name | `digilocker-vault` |
| `NEXT_PUBLIC_STORAGE_REGION` | ✓ | AWS region | `us-east-1` |
| `NEXT_PUBLIC_STORAGE_ENDPOINT` | ✓ | S3-compatible endpoint | `http://localhost:9000` |
| `STORAGE_ACCESS_KEY_ID` | ✗ | AWS access key | (secret) |
| `STORAGE_SECRET_ACCESS_KEY` | ✗ | AWS secret key | (secret) |
| `PRESIGNED_URL_EXPIRY_SECONDS` | ✗ | URL expiry time | `900` (15 minutes) |
| `STORAGE_ENABLE_ENCRYPTION` | ✗ | Enable S3 encryption | `true` / `false` |
| `STORAGE_KMS_KEY_ID` | ✗ | KMS key ID (optional) | (optional) |

### Database

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `DATABASE_URL` | ✗ | Database connection | `postgresql://...` |
| `DATABASE_POOL_SIZE` | ✗ | Connection pool size | `10` |
| `DATABASE_LOG_ENABLED` | ✗ | Database query logging | `true` / `false` |

**Connection String Examples:**
- PostgreSQL: `postgresql://user:pass@localhost:5432/db`

### Authentication

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `NEXT_PUBLIC_AUTH_ENABLED` | ✓ | Enable authentication | `true` / `false` |
| `AUTH_SECRET` | ✗ | JWT/session secret | (random 32-byte string) |
| `AUTH_SESSION_EXPIRY_SECONDS` | ✗ | Session duration | `86400` (24 hours) |
| `CORS_ALLOWED_ORIGINS` | ✗ | CORS origins | `http://localhost:3000` |

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

### File Upload

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `MAX_FILE_SIZE_MB` | ✗ | Max file size | `10` |
| `MAX_STORAGE_PER_USER_MB` | ✗ | User quota | `100` |
| `ALLOWED_FILE_TYPES` | ✗ | Allowed MIME types | `application/pdf,image/jpeg` |
| `VIRUS_SCAN_ENABLED` | ✗ | Enable scanning | `true` / `false` |
| `VIRUS_SCAN_URL` | ✗ | ClamAV/VirusTotal URL | `https://...` |

### Sharing & Links

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `NEXT_PUBLIC_ENABLE_SHARE_LINKS` | ✓ | Enable sharing | `true` / `false` |
| `NEXT_PUBLIC_DEFAULT_EXPIRY_MINUTES` | ✓ | Default link expiry | `60` |
| `MAX_SHARE_LINK_EXPIRY_MINUTES` | ✗ | Max allowed expiry | `43200` (30 days) |
| `NEXT_PUBLIC_ENABLE_SHARE_PIN` | ✓ | Enable PIN protection | `true` / `false` |
| `NEXT_PUBLIC_ENABLE_SHARE_VIEW_LIMITS` | ✓ | Enable view limits | `true` / `false` |

### Security & Compliance

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `CSP_ENABLED` | ✗ | Content Security Policy | `true` / `false` |
| `CORS_ENABLED` | ✗ | CORS enabled | `true` / `false` |
| `RATE_LIMIT_ENABLED` | ✗ | Rate limiting | `true` / `false` |
| `RATE_LIMIT_WINDOW_SECONDS` | ✗ | Rate limit window | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | ✗ | Max requests per window | `100` |
| `REQUEST_LOG_ENABLED` | ✗ | Request logging | `true` / `false` |

### Monitoring & Logging

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `LOG_LEVEL` | ✗ | Log verbosity | `debug`, `info`, `warn`, `error` |
| `ERROR_REPORTING_ENABLED` | ✗ | Enable error reporting | `true` / `false` |
| `ERROR_REPORTING_DSN` | ✗ | Sentry DSN | `https://key@sentry.io/123` |
| `ANALYTICS_ENABLED` | ✗ | Enable analytics | `true` / `false` |
| `ANALYTICS_TOKEN` | ✗ | Analytics provider token | (provider-specific) |

### Development Tools

| Variable | Public | Description | Example |
|----------|--------|-------------|---------|
| `NEXT_PUBLIC_STRICT_MODE` | ✓ | React strict mode | `true` / `false` |
| `DEBUG` | ✗ | Enable debug logging | `true` / `false` |
| `MOCK_API_ENABLED` | ✗ | Mock API responses | `true` / `false` |

## Deployment Guides

### Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update development values:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   DATABASE_URL=postgresql://user:password@localhost:5432/digilocker
   NEXT_PUBLIC_AUTH_ENABLED=false
   ```

3. Install dependencies and prepare the database client:
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev
   ```

   `migrate dev` is for development databases. Use `prisma migrate deploy` in
   staging and production to apply committed migrations. Once migration history
   is established, do not casually use `prisma db push`.

4. Start MinIO for local S3 (optional):
   ```bash
   docker run -p 9000:9000 -p 9001:9001 minio/minio server /minio
   ```

### Vercel

1. Go to **Project Settings → Environment Variables**

2. Add production variables:
   ```
   NEXT_PUBLIC_APP_ENV=production
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   DATABASE_URL=postgresql://...
   STORAGE_ACCESS_KEY_ID=...
   STORAGE_SECRET_ACCESS_KEY=...
   AUTH_SECRET=...
   ```

3. Set environment per deployment:
   - Production: Add to "Production"
   - Preview: Add to "Preview"
   - Development: Use .env.local

### Azure App Service

1. Go to **Configuration → Application settings**

2. Add each variable as a new setting:
   ```
   Name: NEXT_PUBLIC_APP_ENV
   Value: production
   
   Name: DATABASE_URL
   Value: postgresql://...
   ```

3. Use Key Vault references for secrets:
   ```
   Name: AUTH_SECRET
   Value: @Microsoft.KeyVault(SecretUri=https://vault.azure.net/secrets/auth-secret/123)
   ```

### Docker / Kubernetes

**Dockerfile:**
```dockerfile
FROM node:20
ENV NODE_ENV=production
COPY .env.production .env
# ... rest of Dockerfile
```

**docker-compose.yml:**
```yaml
services:
  app:
    build: .
    environment:
      - NEXT_PUBLIC_APP_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - STORAGE_ACCESS_KEY_ID=${STORAGE_ACCESS_KEY_ID}
```

**Kubernetes Secret:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: digilocker-env
type: Opaque
stringData:
  AUTH_SECRET: "your-secret-value"
  DATABASE_URL: "postgresql://..."
  STORAGE_ACCESS_KEY_ID: "..."
```

## Best Practices

### ✅ Do

- ✓ Use `.env.local` for development (not committed)
- ✓ Use `.env.example` as template
- ✓ Store secrets in secure vaults (Key Vault, Secrets Manager)
- ✓ Use `NEXT_PUBLIC_*` ONLY for non-sensitive values
- ✓ Validate environment on startup
- ✓ Use strong random values for secrets
- ✓ Rotate secrets regularly
- ✓ Document all required variables

### ❌ Don't

- ✗ Commit `.env` files with secrets
- ✗ Hardcode secrets in source code
- ✗ Use same secrets across environments
- ✗ Share secrets via email/chat
- ✗ Use weak/short secrets
- ✗ Store secrets in public repos
- ✗ Expose secrets in client-side code

## Validation

Check environment at startup:

```javascript
// src/app/layout.js or entry point
import { validateEnvironment } from '@/src/lib/env'

validateEnvironment()
```

Or manually validate:

```javascript
import { env } from '@/src/lib/env'

const errors = env.validate()
if (errors.length > 0) {
  console.error('Configuration errors:', errors)
}
```

## Troubleshooting

**"Missing required environment variable"**
- Check `.env.local` exists
- Verify variable name spelling
- For production, check deployment platform's configuration

**"Invalid number for MAX_FILE_SIZE_MB"**
- Ensure numeric variables are numbers, not strings
- Example: `10` not `"10"`

**"CORS_ALLOWED_ORIGINS parsing failed"**
- Use comma-separated list without spaces
- Example: `http://localhost:3000,http://localhost:3001`

**Environment not updating after changes**
- Restart dev server: `npm run dev`
- Clear Next.js cache: `rm -rf .next`
- Vercel: Push to repository to trigger redeploy

## Reference

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Twelve-Factor App Config](https://12factor.net/config)
- [OWASP Secrets Management](https://owasp.org/www-community/Source_Code_Exposure)
