# ADR-012 — Development environment

- **Status:** Accepted
- **Date:** July 24, 2026

## Context

Before implementing the domain, the project needs a simple and reproducible environment
for a single maintainer without blocking future growth.

## Decision

DonFlow adopts:

- Node.js `24.18.0`;
- npm `11.x`;
- an npm Workspaces monorepo;
- PostgreSQL 18;
- Docker Compose for local infrastructure;
- TypeScript and NestJS for the API;
- Prisma as the ORM and migration tool;
- EditorConfig and Prettier with separate responsibilities;
- Git with LF line endings.

The real `.env` file remains local and untracked. The repository provides an
`.env.example` without secrets.

## Positive consequences

- consistent and reproducible development environment;
- simpler onboarding;
- local database close to the intended production technology;
- repository structure prepared for API and frontend applications;
- schema and migrations versioned with the code.

## Negative consequences

- Docker must be available for the local database;
- maintainers must use compatible tool versions;
- PostgreSQL and Prisma require more learning than in-memory storage.

## Alternatives considered

### pnpm Workspaces

Rejected for the foundation to reduce tooling. This can be revisited if npm no longer
meets project needs.

### SQLite

Rejected because PostgreSQL better represents scheduling consistency, concurrency, and
future operational requirements.

### Turborepo or Nx

Rejected because two applications and one maintainer do not yet justify additional build
orchestration.

## Verification criteria

- clean installation with `npm install`;
- healthy PostgreSQL service through Docker Compose;
- valid Prisma configuration;
- API builds and starts;
- lint and tests run through documented scripts.

## Related documents

- [Development environment](../guides/development-environment.md)
- [Docker and PostgreSQL](../guides/docker.md)
- [Technical status and roadmap](../project-status.md)
