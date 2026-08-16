# Technical status and roadmap

Updated on August 16, 2026.

## Release status

The customer, staff (`BARBER`), and administrative (`MASTER`) scheduling platform is
implemented and covered by build, lint, unit tests, and HTTP contract tests as part of the
root verification command (`npm run verify`), which also runs in CI on every push to
`main`.

This repository is the reusable template: it has no deploy connections, no client secrets,
and no production topology of its own. Each client deployment is a separate repository
created from this template, with its own domain, hosting accounts, and secrets — see
[`docs/guides/new-client-playbook.md`](guides/new-client-playbook.md) for the
provider-by-provider setup steps and the incident lessons that setup already bakes in.

## Implemented

- customer registration, transactional-email consent, email verification, login, and
  password recovery;
- controlled initial master bootstrap and email-only barber invitation onboarding;
- active-identity validation on every protected API request;
- role and resource-ownership authorization;
- customer, barber, and master responsive interfaces;
- barber services, master templates, prices, duration, activation, and deletion;
- recurring business hours, lunch ranges, exceptional closures, and Lisbon time-zone
  availability;
- customer and local operational bookings with 24-hour notice, unlimited active bookings
  per customer (capped only while an unjustified no-show is outstanding), and
  PostgreSQL overlap protection;
- customer and staff cancellation and rescheduling;
- automatic completion, no-show handling, booking restrictions, and customer blocking;
- day, week, and month schedules with protected appointment details and history;
- transactional Resend email, in-app notifications, reminders, retries, and idempotency;
- customer directory without email disclosure;
- reviews, monthly dashboard snapshots, realized revenue, occupancy, and comparisons;
- account, shop address, schedule, private R2 profile-image, and sensitive-data confirmation
  flows;
- production security headers, disabled-by-default OpenAPI documentation, CORS allowlist,
  request validation, rate limiting, health checks, and production containers.

## Explicitly outside the MVP

- online payments and point of sale;
- native mobile applications;
- marketing email;
- loyalty programs;
- multiple locations;
- shared rate-limit storage (the rate limiter is process-local; acceptable at
  single-replica scale, revisit before running more than one API instance).

## Known operational constraints

- the included rate limiter is process-local; run one API replica until shared storage is
  configured;
- profile images are limited to 1 MB, sanitized before upload, stored in private Cloudflare
  R2, and delivered through an authenticated and authorized API endpoint;
- authenticated sessions use short-lived access tokens in `HttpOnly` cookies and rotated,
  revocable refresh tokens backed by a server-side session registry;
- dependency auditing is mandatory on every release; `npm audit` findings must be resolved
  or explicitly accepted before deploying.

## Release gate

See [`docs/security/production-security-baseline.md`](security/production-security-baseline.md)
for the full deployment gate checklist a new client deployment must clear before serving
real customers.
