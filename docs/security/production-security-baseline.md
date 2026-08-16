# Production security baseline

This baseline targets OWASP ASVS 5.0 Level 2 for the scheduling application. It is a
release gate, not a claim that the system is invulnerable.

## Implemented application controls

- Authentication uses short-lived access JWTs stored only in `HttpOnly` cookies.
- Refresh tokens are random, hashed at rest, rotated on every use, revocable, and bound to
  a server-side session record.
- Cookie-authenticated mutations require a double-submit CSRF token.
- Password changes, resets, account deletion, deactivation, and account anonymisation
  revoke active sessions.
- Staff accounts support TOTP MFA with an AES-256-GCM encrypted secret and single-use,
  hashed recovery codes.
- Repeated failed logins trigger a temporary account lock without exposing account
  existence.
- New passwords require 12 to 72 characters and the product-defined composition rules;
  passwords are stored with Argon2id.
- Customer account deletion requires password re-authentication and preserves only the
  operational history required by the scheduling domain.
- Image uploads are signature checked, fully decoded, dimension limited, metadata stripped,
  and re-encoded before private object-storage persistence. Image delivery is authenticated
  and role/ownership authorized; the R2 bucket remains non-public.
- The API applies strict validation, response hardening, exact-origin CORS, request-size
  limits, no-store caching for authenticated responses, and production HTTPS validation.
- The same-origin Nginx gateway adds CSP, HSTS, permissions policy, request limits, and
  hides server version information.
- Production containers run without root privileges where applicable, drop Linux
  capabilities, use read-only filesystems, and set `no-new-privileges`.

## Deployment gates

1. Use independent random values for `JWT_ACCESS_SECRET` and `MFA_ENCRYPTION_KEY`. ✅ Done
   — distinct values generated for production, separate from local development.
2. Use HTTPS-only values for `APP_PUBLIC_URL` and every `APP_CORS_ORIGINS` entry. ✅ Done
   — both point at `https://<client-domain>`; enforced at boot by
   `validate-production-environment.ts`.
3. Keep API documentation disabled and expose only the Web gateway publicly. ✅ Done —
   `ENABLE_API_DOCS` stays unset in production; validated at boot.
4. Use a least-privilege application database user and a separate migration identity when
   the hosting platform supports it. ⚠️ Partial — Neon's pooled connection uses the project
   owner role for both the app and `prisma migrate deploy`. Neon's role model doesn't cleanly
   separate "migrate" from "runtime" the way a self-hosted Postgres would; revisit if Neon
   adds finer-grained roles.
5. Enable encrypted daily backups, off-host retention, and complete a restore drill. ✅ Done
   — see "Backup and restore" below.
6. Route logs to retained, access-controlled storage and alert on authentication abuse,
   HTTP 5xx, readiness failures, and exhausted notification retries. ✅ Done for error
   alerting — Sentry captures unhandled exceptions on both API (`@sentry/nestjs`) and web
   (`@sentry/react`), gated behind `SENTRY_DSN`/`VITE_SENTRY_DSN` so local dev stays silent.
   Structured request logs live in Railway's log retention; no dedicated abuse-pattern
   alerting beyond Sentry issue notifications yet.
7. Enable MFA for the owner before inviting production staff. ⚠️ Pending — the production
   master is still the placeholder test account (`master@<client-domain>.test`); MFA enrollment is
   part of the real-owner cutover (see "Before public launch" below).
8. Run build, lint, unit tests, E2E tests, integration tests, CodeQL, dependency audit, and
   container scanning for every release. ✅ Done via `.github/workflows/ci.yml` (CodeQL is
   `continue-on-error` — GitHub Advanced Security code scanning isn't available on this
   private-repo plan).
9. Complete an authenticated DAST scan and an independent penetration test against staging.
   ❌ Not done — no staging environment exists separate from production; revisit before
   scaling past the pilot barbershop.
10. Restrict the R2 S3 token to the profile-image bucket, keep public access disabled, and
    rotate the token through the deployment secret manager. ✅ Done — production uses a
    dedicated `<client>-media-deploy` R2 token scoped only to `<client>-media-production`
    (Object Read/Write), distinct from the token used in local development. A second
    dedicated token (`<client>-backups-deploy`) is scoped only to the backups bucket, so a
    compromise of either token can't reach the other bucket.

## Backup and restore

- **What**: nightly `pg_dump` of the Neon production database, gzip-compressed.
- **Where**: Cloudflare R2, bucket `<client>-production-backups` (EU jurisdiction), via
  `.github/workflows/backup-database.yml` (cron `0 4 * * *` UTC, plus manual
  `workflow_dispatch`).
- **Retention**: `daily/` objects expire after 30 days, `monthly/` objects (uploaded only on
  the 1st of the month) expire after 365 days. Both are enforced by R2 lifecycle rules on the
  bucket itself — no custom pruning code to maintain or get wrong.
- **Credentials**: a dedicated, bucket-scoped R2 token (`<client>-backups-deploy`) and the
  production `DATABASE_URL`, stored as GitHub Actions secrets (`BACKUP_R2_ACCESS_KEY_ID`,
  `BACKUP_R2_SECRET_ACCESS_KEY`, `BACKUP_R2_ENDPOINT`, `BACKUP_R2_BUCKET`,
  `PROD_DATABASE_URL`) — never committed to the repo.
- **Restore drill**: verified 2026-08-09 — downloaded `daily/2026-08-09.sql.gz`, restored it
  into a throwaway `postgres:18` container (`psql -f` against the decompressed dump), and
  confirmed table structure and row counts matched the source. To repeat: download the object
  from R2, `gunzip`, then `psql "$DATABASE_URL" -f dump.sql` against the target database.
- **Known gap**: the dump uses the Neon owner role (see gate 4), so a restore recreates
  ownership as that role. Acceptable for a same-provider restore; would need adjustment for a
  restore into a differently-provisioned Postgres instance.

## Fixed: cross-subdomain CSRF cookie and CORS ordering (2026-08-09)

Discovered while testing the account-settings update as the real production master: any
authenticated mutation from a real browser (not `curl`) failed with a generic "couldn't save"
error. Root cause, found by reproducing through an actual browser session rather than
guessing from the code:

- The CSRF cookie was set without a `Domain` attribute, so it was scoped to the API subdomain
  only. The frontend runs on the apex domain and reads this cookie via `document.cookie` to
  attach `X-CSRF-Token` — a different hostname can't read a host-only cookie, so every
  mutating request was silently missing the header.
- Separately, the CSRF-check middleware ran *before* `app.enableCors()`, so its rejection
  response never carried CORS headers. Browsers treated that as an opaque CORS failure
  instead of a readable JSON error, hiding the real cause from both users and logs.
- A related issue surfaced during verification: the same cookie-presence check applied to
  `@Public()` auth routes (login, register, password reset, etc.), so a browser holding a
  stale or revoked session cookie would get its *login* request rejected too.

Fixed by scoping the CSRF cookie's `Domain` to `APP_PUBLIC_URL`'s hostname in production,
moving `enableCors()` ahead of any middleware that can short-circuit a request, and adding
an explicit exemption list for the public auth endpoints. This was invisible in local dev
(Vite proxies `/api`, making frontend and API same-origin) and in `curl`-based testing (no
CORS enforcement, no `document.cookie`), which is why it survived until a real browser
exercised a real mutation. Verified end-to-end post-fix: login, and an account-settings
save, both through the actual UI in a real browser.

## Before public launch

The production master account is still test data
(`master@<client-domain>.test` / "Teste QA"), created deliberately so the team could validate the
full deploy without using real owner credentials. Before inviting real customers:

1. Update the master's name, email, and phone via the settings UI (or a direct `UPDATE
   users ...` if the UI doesn't cover every field) to the real barbershop owner's details.
2. Set a new, unique password for the account (do not keep the generated test password).
3. Enroll MFA on the account (closes gate 7 above).
4. Confirm the new email address via the normal email-confirmation flow so password resets
   and notifications go to a real, monitored inbox.

## Dependency status

As of 2026-08-09, the locked dependency tree has no known npm audit findings (re-verified
after adding `@sentry/nestjs` and `@sentry/react`). React Router
is on the patched major release, and vulnerable transitive `fast-uri`, `brace-expansion`, and
`js-yaml` versions are constrained to patched releases via `overrides` (`js-yaml` reached
production through a pinned `@nestjs/swagger` dependency; the vulnerable parse path was never
reachable since Swagger only serializes YAML and only when `ENABLE_API_DOCS=true`, which stays
disabled in production, but the version was pinned to the patched release regardless). Build,
lint, tests, dependency auditing, and lockfile review remain mandatory release gates.

## Operational controls owned by the hosting environment

- TLS certificate issuance and renewal (Cloudflare, in front of Vercel and Railway);
- managed firewall and database network isolation (Neon);
- distributed denial-of-service protection (Cloudflare);
- encrypted backup storage (R2, at rest) and restore automation (see "Backup and restore");
- central log retention (Railway) and incident alert delivery (Sentry);
- secret manager access policy and rotation (Railway/Vercel environment variables, GitHub
  Actions secrets — no dedicated secret manager yet; rotation is manual);
- external penetration testing and incident response contacts — not yet arranged (see gate 9).
