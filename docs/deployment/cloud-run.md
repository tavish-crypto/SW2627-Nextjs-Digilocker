# Cloud Run Deployment

This guide builds the existing Next.js application as a standalone container,
pushes it to Google Artifact Registry, and deploys it to Cloud Run.

## Architecture

```text
Developer or CI
  -> Docker build
  -> Artifact Registry
  -> Cloud Run service
       -> Secret Manager for private values
       -> PostgreSQL and object storage configured by the application
```

The Docker image uses Next.js standalone output and starts with `node
server.js`. Cloud Run supplies the runtime `PORT`; the image defaults to `8080`
and uses `HOSTNAME=0.0.0.0`.

## Current Application Prerequisites

This repository is not yet production-ready for PostgreSQL or Google Cloud
Storage without additional application work:

- `prisma/schema.prisma` currently declares `provider = "sqlite"`.
- The current upload route uses `/api/upload/mock-s3`, which stores local mock
  files and is not durable Cloud Storage integration.
- The committed production migration must be regenerated after changing the
  Prisma provider and schema for PostgreSQL.

Do not deploy with a PostgreSQL `DATABASE_URL` until the schema/provider and
migrations have been migrated. Do not treat `.mock-storage` as production file
storage. LU-2.54 supplies the container and Cloud Run deployment path; it does
not silently implement a new database or signed-URL/storage architecture.

## Prerequisites

Install and authenticate:

- Docker
- Google Cloud CLI (`gcloud`)
- A Google Cloud project with billing enabled
- A PostgreSQL database compatible with the migrated Prisma schema
- A production object-storage implementation and bucket, if uploads are enabled

Set placeholders for the deployment:

```bash
export GCP_PROJECT_ID="<your-project-id>"
export GCP_REGION="asia-south1"
export ARTIFACT_REGISTRY_REPOSITORY="digilocker"
export CLOUD_RUN_SERVICE="digilocker-vault"
export IMAGE_NAME="digilocker-vault"
export IMAGE_TAG="$(git rev-parse HEAD)"
export IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"
export RUNTIME_SERVICE_ACCOUNT="digilocker-cloud-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
```

Use a different region if it is closer to the database and users. Keep the
image tag immutable; `latest` should not be the deployment source of record.

## Required APIs

```bash
gcloud auth login
gcloud config set project "${GCP_PROJECT_ID}"

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

The application does not currently use a Google Cloud Storage client. Enable
`storage.googleapis.com` only when the production storage adapter is added:

```bash
gcloud services enable storage.googleapis.com
```

## Secret Manager Setup

Create secrets without placing their values in Git, the Dockerfile, or shell
history. The commands below read values interactively:

```bash
gcloud secrets create database-url --replication-policy=automatic
gcloud secrets versions add database-url --data-file=-

gcloud secrets create auth-secret --replication-policy=automatic
gcloud secrets versions add auth-secret --data-file=-

gcloud secrets create auth-google-id --replication-policy=automatic
gcloud secrets versions add auth-google-id --data-file=-

gcloud secrets create auth-google-secret --replication-policy=automatic
gcloud secrets versions add auth-google-secret --data-file=-
```

Paste one value at a time, then press `Ctrl+Z` followed by Enter on Windows or
`Ctrl+D` on Linux/macOS to end standard input. Never put secret values in the
commands themselves.

Create a dedicated runtime identity and grant only the access it needs:

```bash
gcloud iam service-accounts create digilocker-cloud-run \
  --display-name="DigiLocker Cloud Run runtime"

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

If a GCS adapter is added, grant the runtime identity only the bucket-level
role required by that adapter, normally `roles/storage.objectUser` on the
application bucket rather than a project-wide Owner or Editor role.

## Environment Variables

Configure non-sensitive values with `--set-env-vars` and secrets with
`--set-secrets`:

```text
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_NAME=DigiLocker Vault
NEXT_PUBLIC_APP_URL=https://<cloud-run-domain-or-custom-domain>
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_STORAGE_BUCKET=<configured-production-bucket>
NEXT_PUBLIC_STORAGE_REGION=<storage-region>
NEXT_PUBLIC_STORAGE_ENDPOINT=
AUTH_SESSION_EXPIRY_SECONDS=86400
CORS_ALLOWED_ORIGINS=https://<cloud-run-domain-or-custom-domain>
MAX_FILE_SIZE_MB=10
MAX_STORAGE_PER_USER_MB=100
CSP_ENABLED=true
CORS_ENABLED=true
RATE_LIMIT_ENABLED=true
LOG_LEVEL=info
```

Sensitive runtime variables are:

```text
DATABASE_URL       -> database-url:latest
AUTH_SECRET        -> auth-secret:latest
AUTH_GOOGLE_ID     -> auth-google-id:latest
AUTH_GOOGLE_SECRET -> auth-google-secret:latest
```

The exact names match the current application code. Do not add duplicate names
such as `NEXTAUTH_SECRET` unless the authentication implementation is changed.

## Artifact Registry Setup

Create the repository once:

```bash
gcloud artifacts repositories create "${ARTIFACT_REGISTRY_REPOSITORY}" \
  --repository-format=docker \
  --location="${GCP_REGION}" \
  --description="DigiLocker Vault container images"
```

If it already exists, this command can be skipped. Configure Docker and build
the image locally:

```bash
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev"
docker build --pull -t "${IMAGE_URI}" .
docker push "${IMAGE_URI}"
```

The resulting image path is:

```text
REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/IMAGE_NAME:GIT_SHA
```

## Cloud Run Deployment

Deploy with a small, cost-conscious baseline. Adjust memory and concurrency
after observing production metrics:

```bash
gcloud run deploy "${CLOUD_RUN_SERVICE}" \
  --image="${IMAGE_URI}" \
  --region="${GCP_REGION}" \
  --platform=managed \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=40 \
  --timeout=300 \
  --min=0 \
  --max=5 \
  --service-account="${RUNTIME_SERVICE_ACCOUNT}" \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_APP_ENV=production,NEXT_PUBLIC_APP_NAME=DigiLocker Vault,NEXT_PUBLIC_APP_URL=https://<cloud-run-domain-or-custom-domain>,NEXT_PUBLIC_API_BASE_URL=/api,NEXT_PUBLIC_AUTH_ENABLED=true,NEXT_PUBLIC_STORAGE_BUCKET=<configured-production-bucket>,NEXT_PUBLIC_STORAGE_REGION=<storage-region>,AUTH_SESSION_EXPIRY_SECONDS=86400,CORS_ALLOWED_ORIGINS=https://<cloud-run-domain-or-custom-domain>,MAX_FILE_SIZE_MB=10,MAX_STORAGE_PER_USER_MB=100,CSP_ENABLED=true,CORS_ENABLED=true,RATE_LIMIT_ENABLED=true,LOG_LEVEL=info" \
  --set-secrets="DATABASE_URL=database-url:latest,AUTH_SECRET=auth-secret:latest,AUTH_GOOGLE_ID=auth-google-id:latest,AUTH_GOOGLE_SECRET=auth-google-secret:latest"
```

`--allow-unauthenticated` means Cloud Run accepts HTTPS requests; application
authentication still protects `/dashboard`, `/documents`, and admin routes.
Use `--no-allow-unauthenticated` only when an external authenticated gateway
is intentionally placed in front of the service.

Cloud Run injects `PORT=8080` for this container. The standalone Next.js server
binds to `0.0.0.0`, which is required for Cloud Run ingress.

## Database Migration

Do not run `prisma migrate dev` or destructive schema commands in the container
startup command. After the Prisma schema is migrated to PostgreSQL and a
production migration has been reviewed, run the migration from a controlled
release environment:

```bash
npx prisma generate
npx prisma migrate deploy
```

The deployed service should only start the application. Verify connectivity
with the application health and logs after the migration has completed.

## Authentication Configuration

For Google OAuth, add this exact callback URL to the Google OAuth client:

```text
https://<cloud-run-domain-or-custom-domain>/api/auth/callback/google
```

Also add the HTTPS origin as an authorized JavaScript origin. Keep `AUTH_SECRET`
stable across revisions so existing sessions are not invalidated on every deploy.

## Verification

Get the service URL and check public routes:

```bash
SERVICE_URL="$(gcloud run services describe "${CLOUD_RUN_SERVICE}" --region "${GCP_REGION}" --format='value(status.url)')"
curl --fail "${SERVICE_URL}/"
curl --fail "${SERVICE_URL}/login"
```

Then verify manually, with production credentials:

- Google sign-in and callback complete successfully.
- `/dashboard` and `/documents` require authentication.
- Prisma reads and writes succeed against PostgreSQL.
- Static assets and server-rendered pages load.
- Uploads use the configured production object storage, not `/api/upload/mock-s3`.

Inspect logs:

```bash
gcloud run services logs read "${CLOUD_RUN_SERVICE}" \
  --region="${GCP_REGION}" \
  --limit=100
```

Pino writes structured logs to stdout/stderr, which Cloud Run captures in Cloud
Logging. Do not log passwords, OAuth tokens, database URLs, or signed URLs.

## Rollback

Each deployment creates an immutable Cloud Run revision:

```bash
gcloud run revisions list \
  --service="${CLOUD_RUN_SERVICE}" \
  --region="${GCP_REGION}"
```

Route all traffic to a known-good revision after a failed release:

```bash
gcloud run services update-traffic "${CLOUD_RUN_SERVICE}" \
  --region="${GCP_REGION}" \
  --to-revisions="<known-good-revision>=100"
```

Do not delete the previous revision until the new revision has been verified.

## Troubleshooting

- **Container failed to start:** confirm the image exposes `8080` and that
  Cloud Run uses `--port=8080`; inspect logs for missing runtime variables.
- **`DATABASE_URL` or Prisma errors:** the current repository schema is SQLite;
  migrate the provider and migrations before supplying PostgreSQL.
- **Google OAuth redirect mismatch:** use the exact HTTPS Cloud Run callback
  URL shown above.
- **Uploads fail or disappear:** the current mock storage is local-only; add a
  durable GCS/S3 adapter before production use.
- **Secret access denied:** verify the Cloud Run runtime service account has
  `roles/secretmanager.secretAccessor`.
- **Revision does not receive traffic:** inspect Cloud Run revision logs and
  startup probes, then route traffic back to the last healthy revision.