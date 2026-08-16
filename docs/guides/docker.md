# Docker and PostgreSQL

Docker Compose provides PostgreSQL for local development.

## Start

```bash
docker compose up -d
```

## Verify

```bash
docker compose ps
docker compose logs postgres
```

The service is ready when its health status is `healthy`.

## Stop

```bash
docker compose down
```

The named volume preserves data after the container stops.

## Recreate the database

Removing the volume permanently deletes local database data. Only run this when that loss
is intentional:

```bash
docker compose down --volumes
docker compose up -d
```

## Configuration

Credentials, port, and connection URL come from `.env`, created from `.env.example`. The
example contains disposable local placeholders only. It must never contain a hosted
database URL, production credentials, private keys, or third-party API keys.

```dotenv
POSTGRES_USER=donflow_dev
POSTGRES_PASSWORD=change-me-before-use
POSTGRES_DB=donflow_dev
POSTGRES_PORT=5432
DATABASE_URL=postgresql://donflow_dev:change-me-before-use@localhost:5432/donflow_dev?schema=public
```

Replace the password in the private `.env` file before use. Because the host is
`localhost`, this URL points to the developer's own local container and cannot provide
access to the project owner's database.

## Prisma

Validate the configuration:

```bash
npm exec --workspace=apps/api -- prisma validate
```

Migrations will begin when the first models are defined. Do not create an empty migration
only to mark the integration as complete.
