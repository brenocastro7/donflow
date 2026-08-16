# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## This is the reusable template, not a client deployment

`donflow` is the clean starting point for every new client: no secrets, no client branding, no
deploy-provider connections. Each real client lives in its own repository created from this
template (see `docs/guides/new-client-playbook.md` for the provisioning steps). Keep this
repository generic — do not hard-code a specific business name, domain, or provider account
into it; anything client-specific belongs in the client's own repository, not here.

### Database safety (absolute — enforced by a hook, not just this instruction)

Reset, drop, or truncate operations against the database must **never** be executed by the
agent — not even with the user's confirmation in chat. This is enforced by a `PreToolUse` hook
(`.claude/hooks/block-destructive-db.mjs`, wired in `.claude/settings.json`) that hard-blocks
matching `Bash`/`PowerShell` commands before they run: `prisma migrate reset`, `--force-reset`,
`dropdb`, `DROP DATABASE`/`DROP SCHEMA`, `TRUNCATE`, `docker compose down -v`, removing `.db`
files, a `DATABASE_URL` referencing production, and setting
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` (a Prisma env var that bypasses its own
protection — blocked explicitly because an agent has actually used it to work around this
guard before). `DELETE FROM` is a soft `ask`, not a hard block.

If the hook blocks a command: **stop**. Do not reformulate the command, do not set the consent
env var, do not ask the user to "confirm" a way around it — the block is intentional and
absolute. `prisma migrate deploy` (the real migration command used in production deploys) is
deliberately **not** blocked — only `migrate reset` and equivalent destructive operations are.
If the user wants an actual reset, they run it themselves in their own terminal, outside the
agent.

## Commands

Run from the repository root unless noted. This is an npm workspaces monorepo (`apps/api`,
`apps/web`).

```bash
npm install                                          # install once, from root
docker compose up -d                                 # local Postgres
npm exec --workspace=apps/api -- prisma migrate deploy
npm run start:dev                                     # API, http://localhost:3000 (/api prefix)
npm run start:web                                      # web, http://localhost:5173
```

Build / lint / test (each has a `:api` or `:web` suffix to scope to one workspace, e.g.
`npm run lint:api`):

```bash
npm run build          # build:api (nest build) + build:web (tsc -b && vite build)
npm run lint            # lint:api (eslint) + lint:web (oxlint)
npm test                 # test:api (jest) + test:web (vitest run)
npm run test:e2e         # apps/api jest e2e suite (test/*.e2e-spec.ts)
npm run test:integration # apps/api jest suite against a real Postgres (RUN_DATABASE_INTEGRATION=true)
npm run verify            # build + lint + test + test:e2e — the CI gate, run before any deploy
```

Single test, API (Jest):

```bash
npm test --workspace=apps/api -- src/appointments/appointments.service.spec.ts
npm test --workspace=apps/api -- -t "test name substring"
```

Single test, web (Vitest):

```bash
npm test --workspace=apps/web -- src/pages/customer-confirm-email-page.test.tsx
```

`npm run test:integration` needs a real Postgres and `RUN_DATABASE_INTEGRATION=true`; CI runs
it against an ephemeral container. Don't point it at a production `DATABASE_URL`.

### Deploy

This template repository has no deploy-provider connections of its own — it is never the target
of a real deploy. See `docs/guides/new-client-playbook.md` for how a new client repository
(created from this template) gets its own domain, hosting accounts, and manual-deploy commands
(Vercel for web, Railway for the API); GitHub Actions CI only validates (build/lint/test/e2e/
integration/CodeQL/audit), it never deploys automatically.

## Architecture

- **API** (`apps/api`, NestJS 11 + Prisma 7): one module per domain
  (`appointments`, `auth`, `barbers`, `customers`, `notifications`, `schedule`, `services`,
  `settings`, `users`, `media`, `reviews`, `dashboard`, `availability`, `storage`, `health`).
  Business rules live in each domain's `*.service.ts`; controllers stay thin.
- **Web** (`apps/web`, React 19 + Vite 8 + React Router 8 + TanStack Query): `features/*` holds
  API clients and domain hooks per area, `pages/*` holds route components, split into
  customer-facing and staff-facing (BARBER/MASTER) pages/PWAs with separate install/start URLs.
- **Auth model**: short-lived access JWT in an `HttpOnly` cookie, rotated/revocable refresh
  tokens backed by a server-side session record, double-submit CSRF cookie for cookie-authenticated
  mutations. `StaffProtectedRoute`/`CustomerProtectedRoute` distinguish "invalid session" from
  "valid session, wrong role" — a wrong-role session redirects to the correct area instead of
  logging the user out. The CSRF cookie's `Domain` and `APP_CORS_ORIGINS` must match the real
  deployed hostname exactly in production, or cross-subdomain login/CSRF breaks in a way that's
  invisible in local dev (Vite proxy) and in `curl` (no CORS/cookie enforcement) — only shows up
  in a real browser.
- **Notifications** (`apps/api/src/notifications`): a persistent outbox pattern, not
  fire-and-forget. Appointment creation/cancellation/rescheduling writes outbox records inside
  the same Prisma transaction as the domain change; a poller (`NotificationDispatcherService`,
  polling every 5 minutes to let serverless-Postgres providers like Neon suspend compute between
  polls) delivers them via a swappable `NotificationProvider` (Resend in production, no-op
  elsewhere). Staff members are **not** emailed or in-app notified about appointment actions
  they performed themselves (self-action is suppressed by comparing the actor's user id against
  the appointment's assigned professional) — only the customer, or a different staff member
  acting on someone else's behalf, gets notified.
- **Image uploads**: signature-checked, fully decoded, dimension-limited, metadata-stripped,
  re-encoded before private R2 storage; served only through an authenticated, authorized API
  endpoint — the bucket itself is never public.
- **Deploy topology**: this template has none of its own. Each client deployment picks its own
  (the first real client uses Vercel + Railway + Neon + Cloudflare + Resend + Sentry — see
  `docs/guides/new-client-playbook.md`).

## Language policy

Repository artifacts (code, tests, docs, commit messages, PRs) are written in English. Content
presented to the end customer (emails, in-app UI text) is written in Portuguese (Portugal).
