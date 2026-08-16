# Production deployment

> **Deployments do not have to run this way.** The first real client deployment built from
> this template runs on Vercel (web) + Railway (API, from `apps/api/Dockerfile`) + Neon
> (Postgres) + Cloudflare (DNS/CDN) instead of the single-host Docker Compose stack described
> below — see `docs/guides/new-client-playbook.md` for that provider-by-provider setup, and
> `docs/security/production-security-baseline.md` for the security gate checklist. This guide
> remains accurate for anyone self-hosting the stack on a single host instead — the required
> controls (secrets, backups, MFA, monitoring) apply either way.

## Scope

`compose.production.yaml` is a self-contained single-host deployment. It runs PostgreSQL,
the NestJS API, and an Nginx-served React SPA. Nginx proxies `/api` to the API so browser
traffic remains same-origin. For a managed database, remove the PostgreSQL service and set
`DATABASE_URL` to the private managed connection string.

## Required controls

1. Combine `.env.example` (root, infrastructure) and `apps/api/.env.example` (application
   configuration) into a single untracked `.env.production` and replace every placeholder.
   `compose.production.yaml` injects every variable from this one file into the API
   container regardless of which local file it was copied from.
2. Generate at least 32 random bytes for `JWT_ACCESS_SECRET`; never use MD5.
   Generate a separate value of the same strength for `MFA_ENCRYPTION_KEY`.
3. Set `APP_PUBLIC_URL` to the final HTTPS origin without a trailing path.
4. Use `EMAIL_PROVIDER=resend`, the verified Resend key as `EMAIL_API_KEY`,
   `no-reply@mail.<client-domain>` as `EMAIL_FROM_ADDRESS`, and the client's business name as
   `EMAIL_FROM_NAME`. These names are provider-neutral so switching email providers later
   does not require renaming variables.
5. Create a private Cloudflare R2 bucket in the selected jurisdiction. Set
   `STORAGE_PROVIDER=r2`, the matching `STORAGE_ENDPOINT`, `STORAGE_BUCKET_NAME`,
   `STORAGE_ACCOUNT_ID`, and an S3 token restricted to that bucket
   (`STORAGE_ACCESS_KEY_ID`/`STORAGE_SECRET_ACCESS_KEY`). Do not enable public bucket
   access. These names are provider-neutral so switching storage providers later does not
   require renaming variables.
6. Terminate TLS at the hosting platform or a reverse proxy in front of port 8080.
7. Keep `ENABLE_API_DOCS=false`.
8. Restrict database network access to the API host.
9. Enable MFA for the owner immediately after the initial login and store recovery codes
   offline.

Start or update the stack:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
```

The API container runs `prisma migrate deploy` before listening. A failed migration stops
the API and prevents the web service health dependency from becoming ready.

Verify the private bucket credentials without writing an object:

```bash
docker compose --env-file .env.production -f compose.production.yaml run --rm api npm run storage:check --workspace=apps/api
```

If an existing database still contains profile-image bytes, run the idempotent migration
once after the database migration and before opening the application to users:

```bash
docker compose --env-file .env.production -f compose.production.yaml run --rm api npm run storage:migrate-profile-images --workspace=apps/api
```

The application serves private images through its authenticated API. Back up the R2 bucket
and PostgreSQL together because the database stores the object keys.

## Initial master

Set the temporary `MASTER_*` variables only for the bootstrap command:

```bash
docker compose --env-file .env.production -f compose.production.yaml run --rm api npm run bootstrap:master --workspace=apps/api
```

Remove those values from the deployment environment after the command succeeds. The
bootstrap is idempotent and never exposes a public master-creation route.

## Health and monitoring

- liveness: `GET /api/health`;
- database readiness: `GET /api/health/ready`;
- unhandled exceptions report to Sentry when `SENTRY_DSN` (API) / `VITE_SENTRY_DSN` (web)
  are set — unset in local dev, set in production;
- alert when readiness fails, HTTP 5xx rises, notification retries reach their limit, or
  disk/database usage crosses the platform threshold;
- ship container stdout/stderr to the hosting platform's retained log service;
- run a single API replica while throttling remains process-local.

## Backups

> On the live deployment this is handled by `.github/workflows/backup-database.yml`
> (Neon → gzip `pg_dump` → Cloudflare R2, with lifecycle-based retention). See
> `docs/security/production-security-baseline.md` → "Backup and restore" for details and the
> restore procedure. The rest of this section applies to the self-hosted Compose path.

Create encrypted daily PostgreSQL backups outside the application host and retain at least
30 daily and 12 monthly restore points. A portable manual backup command is:

```bash
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > backup.dump
```

The destination, encryption, retention, and access controls belong to the deployment
platform. Test a restore into a separate database before launch and at least quarterly.

## Release and rollback

Run `npm ci`, `npm run verify`, `npm audit --omit=dev`, and a container build before every
release. Tag the image and database backup together. Application rollback uses the previous
image; database rollback should restore a verified backup rather than editing migration
history. Never use `prisma migrate reset` in production.

## Privacy operations

Grant production access only to personnel who need it. Do not expose customer email in
staff scheduling responses. Review retained audit logs and account-anonymisation behavior,
document the legal retention period, and provide a controlled process for access or erasure
requests under applicable data-protection rules.
