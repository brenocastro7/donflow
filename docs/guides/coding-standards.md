# Coding standards

## Principles

- Prefer simple code over premature abstractions.
- Give each module a clear responsibility.
- Keep business rules independent from external providers.
- Validate input at application boundaries.
- Never expose passwords, tokens, or secrets in responses or logs.
- Include tests with behavioral changes.

## Language

Repository artifacts must be written in English:

- code identifiers and comments;
- tests and technical messages;
- README and versioned documentation;
- configuration descriptions;
- branches, commits, pull requests, and changelogs.

Customer-facing content may be written in Portuguese.

## TypeScript and NestJS

- Use explicit public boundary types when they improve readability.
- DTOs validate HTTP input; domain rules should not depend on transport concerns.
- Controllers handle HTTP concerns and delegate behavior to services.
- Services must not return DTOs containing passwords.
- Modules group features from the same domain.

## Formatting and lint

EditorConfig controls editor behavior and Prettier controls formatting.

```bash
npm run format --workspace=apps/api
npm run lint
```

Lint verification must not modify files in CI.

## Tests

- Unit tests isolate external dependencies.
- Controller tests provide or mock injected services.
- End-to-end tests use the same prefix, pipes, filters, and interceptors as production.
- Each endpoint tests successful and invalid requests.
- Critical scheduling rules require overlap and concurrency tests.

## Security

- Store password hashes only.
- Never return passwords, password hashes, tokens, or secrets.
- Normalize email addresses and phone numbers before persistence.
- Enforce authorization on the server.
- Audit sensitive administrative actions without recording secrets.

## Documentation

Changes to setup, scripts, environment variables, architecture, or public behavior must
update documentation in the same unit of work.
