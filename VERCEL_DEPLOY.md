# Vercel deployment

This package is configured to work on Vercel with **only PostgreSQL/Supabase for persistent uploads**. GCP/S3 are optional.

## Required Vercel environment variables

```env
DATABASE_URL=<your Supabase Session Pooler URL on port 5432, preferably with connection_limit=1>
AUTH_SECRET=<a strong random secret>
STORAGE_PROVIDER=database
```

If authentication is disabled you can set `NEXT_PUBLIC_AUTH_ENABLED=false`. If Google login is enabled also set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

## Automatic schema setup

On Vercel, `npm run build` runs `prisma db push --skip-generate` before `next build`. Use the Supabase **Session Pooler (port 5432)** URL for `DATABASE_URL` so schema synchronization and runtime queries both work over IPv4. This creates/updates the application tables, including database-backed object storage tables. The operation is additive and will fail rather than automatically accept destructive data loss.

## Upload behavior

When `STORAGE_PROVIDER=database`, files are split in the browser into 2 MiB chunks (up to the application's 10 MiB file limit), uploaded to signed application routes, and persisted in PostgreSQL. This avoids Vercel ephemeral filesystem storage and does not require GCP/S3 credentials.

If valid GCP or S3 credentials are configured and the corresponding provider is selected, direct cloud uploads continue to work.
