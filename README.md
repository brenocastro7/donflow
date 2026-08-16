# DonFlow

Web platform for barbershop management and appointment scheduling. The product does not
hard-code a specific business name or operation into its domain — this repository is the
clean template used as the starting point for every new client deployment.

## Project status

**Current version:** `1.0.0-rc.1`

The customer and staff scheduling MVP is implemented. The repository includes production
containers, database migrations, security headers, health checks, and CI verification.

| Area                    | Status                                    |
| ----------------------- | ----------------------------------------- |
| npm Workspaces monorepo | Complete                                  |
| NestJS API foundation   | Complete                                  |
| PostgreSQL in Docker    | Complete                                  |
| Prisma                  | Scheduling domain and migrations complete |
| Health endpoint         | Complete                                  |
| Continuous integration  | Complete                                  |
| Customer registration   | Persisted with Argon2id password hashing  |
| Authentication          | Core flows complete                       |
| Scheduling domain       | Core flows complete                       |
| Frontend                | Customer and staff MVP complete           |
| Production containers  | Complete                                  |

`POST /api/auth/register` creates `CUSTOMER` accounts in PostgreSQL, normalizes email,
hashes passwords with Argon2id, and excludes sensitive fields from responses. Public
registration never accepts a role or status.

Registration also creates a single-use, expiring email verification token. The raw token
is sent only to the configured email provider and is never stored or returned by the API.
`POST /api/auth/confirm-email` consumes the token and marks the email as verified.

## MVP scope

The MVP should provide:

- administrative authentication;
- barber and service management;
- business hours, breaks, and schedule blocks;
- availability queries;
- appointment creation, cancellation, and rescheduling;
- schedule conflict prevention;
- email confirmations and reminders;
- customer and appointment history.

Online payments, native mobile applications, loyalty programs, automated marketing, and
multiple locations are outside the initial scope.

## Technology

- Node.js 24 LTS
- npm 11
- TypeScript
- NestJS 11
- PostgreSQL 18
- Prisma 7
- React 19
- Vite 8
- React Router 8
- TanStack Query
- Vitest and Testing Library
- Docker Compose
- Jest

## Repository structure

```text
donflow/
├── apps/
│   └── api/              # NestJS API, Prisma, and tests
├── docs/
│   ├── adr/              # versioned technical decisions
│   └── guides/           # operational guides
├── packages/             # reserved for proven shared code
├── .env.example
├── compose.yaml
├── package.json
└── package-lock.json
```

## Prerequisites

- Node.js `24.18.0`
- npm `11.x`
- Docker Desktop with Docker Compose

See the [development environment guide](docs/guides/development-environment.md) for the
complete setup.

## Quick start

```bash
npm install
docker compose up -d
npm exec --workspace=apps/api -- prisma migrate deploy
npm run start:dev
npm run start:web
```

The API uses the `/api` prefix and starts on `http://localhost:3000` by default.
The web application starts on `http://localhost:5173`.

The liveness endpoint is available at `GET /api/health`.
Interactive OpenAPI documentation is available at `GET /api/docs` only when
`ENABLE_API_DOCS=true`. It is disabled by default for production.

Transactional email is selected by `EMAIL_PROVIDER`. The default `noop` provider performs
no external delivery; the Resend adapter is enabled only with private runtime credentials.

The API requires `DATABASE_URL`. The values in `.env.example` are local placeholders only
and never grant access to hosted databases or private credentials.

## Verification

```bash
npm run verify
```

This command runs the build, lint, unit tests, and end-to-end tests.

## Production deployment

The production Compose stack serves the SPA and API from the same origin:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

See [Production deployment](docs/guides/production-deployment.md) for required secrets,
initial master bootstrap, backups, health checks, rollback, and operational checks.

## Documentation

- [Development environment](docs/guides/development-environment.md)
- [Docker and PostgreSQL](docs/guides/docker.md)
- [Coding standards](docs/guides/coding-standards.md)
- [Git workflow](docs/guides/git-workflow.md)
- [Technical status and roadmap](docs/project-status.md)
- [Production deployment](docs/guides/production-deployment.md)
- [Identity and access model](docs/architecture/identity-and-access.md)
- [ADR-012 — Development environment](docs/adr/ADR-012-development-environment.md)

Notion is the source of truth for product requirements, business rules, and the product
roadmap. Versioned repository documentation is the source of truth for setup, execution,
engineering standards, and verified technical status.

## Language policy

Repository artifacts are written in English, including documentation, code, tests,
configuration descriptions, commit messages, and pull requests. Content presented to the
end customer may be written in Portuguese.

## License

This project is private and does not yet define a distribution license.
