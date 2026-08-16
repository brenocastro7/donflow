# Development environment

This guide prepares DonFlow for local development on Windows, macOS, or Linux.

## Requirements

- Git
- Node.js `24.18.0`
- npm `11.x`
- Docker Desktop or Docker Engine with Compose

Node.js and npm versions are defined in `.nvmrc` and the root `package.json` engines.

## Runtime configuration

Copy `.env.example` to a root `.env` and replace every placeholder. The root file contains
only infrastructure values shared with Docker Compose and the Prisma CLI: the PostgreSQL
container and `DATABASE_URL`. Never duplicate `DATABASE_URL`/`POSTGRES_*` into
`apps/api/.env`, because it can silently point the API and database tools to different
PostgreSQL instances.

Copy `apps/api/.env.example` to `apps/api/.env` and replace every placeholder there too.
This file holds the API's own application configuration (JWT, auth, MFA, master
bootstrap, CORS, email, storage) and is loaded automatically alongside the root `.env`.
The browser application uses an optional untracked `apps/web/.env.local` copied from
`apps/web/.env.example`; it contains only public Vite configuration.

`JWT_ACCESS_SECRET` must be a unique random value with at least 32 characters. MASTER
bootstrap values are also private and must exist only in the untracked `apps/api/.env` or
the deployment secret manager.

`APP_CORS_ORIGINS` contains comma-separated browser origins. `APP_PUBLIC_URL` is the
frontend origin used in email actions. Keep `EMAIL_PROVIDER=noop` unless a real
transactional-email provider is being tested; when enabled, configure `EMAIL_API_KEY`,
`EMAIL_FROM_ADDRESS`, and optionally `EMAIL_FROM_NAME` only in the private environment.
These variable names are provider-neutral by design, so switching email or storage
providers later does not require renaming them.

`GET /api/health` is a liveness check and does not query PostgreSQL.
`GET /api/health/ready` executes a minimal database query and returns `503 Service
Unavailable` when PostgreSQL cannot be reached.

After migrations are applied and the private `MASTER_*` values are configured, run
`npm run bootstrap:master`. The command is idempotent, and there is intentionally no
public endpoint for privileged account creation.

## Installation

From the repository root:

```bash
npm install
```

Create the local environment files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
```

Review both `.env` files and replace placeholder credentials before starting any service.
Real environment files, hosted database URLs, API keys, tokens, and private keys must
never be committed.

The API bootstrap loads both `.env` files — the root one and the API workspace one — from
the command's initial directory, the API workspace, or the monorepo root. This keeps
`npm run start:dev` working whether it is invoked from the repository root or through the
API workspace.

## Local database

```bash
docker compose up -d
docker compose ps
```

See [Docker and PostgreSQL](docker.md) for database operations and troubleshooting.

Apply all versioned database migrations:

```bash
npm exec --workspace=apps/api -- prisma migrate deploy
```

## API

```bash
npm run start:dev
```

The API starts on `http://localhost:3000` by default and uses the `/api` prefix.

Verify API liveness with:

```bash
curl http://localhost:3000/api/health
```

## Web application

Copy the public frontend environment reference:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

Start the web application in a second terminal:

```bash
npm run start:web
```

Vite serves the React application on `http://localhost:5173`. Its
`VITE_API_URL` defaults to `http://localhost:3000/api`.

## Environment verification

```bash
node --version
npm --version
docker compose version
npm run verify
```

## Current limitations

- A custom production sender domain is still required for final Resend deployment.
- Frontend product flows and approved layouts are not implemented yet.
- Production deployment, backups, and observability are not configured.

These limitations describe the current project state rather than missing setup steps.
