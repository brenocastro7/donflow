# Identity and access model

This document defines the approved identity, role, and ownership model. Its identity
foundation is implemented by the first database migrations; authentication and the
remaining role-specific flows are incremental milestones.

## Roles

Every authenticated identity is a `User` with exactly one role:

- `CUSTOMER`
- `BARBER`
- `MASTER`

Roles are assigned by trusted server-side flows. Public registration always creates a
`CUSTOMER`; the API never accepts a role from the registration request.

Public registration is exposed by `POST /api/auth/register`. Authentication is exposed
by `POST /api/auth/login`, and `GET /api/auth/me` verifies a bearer access token.
`AuthModule` owns the transport and authentication-facing flow, `UsersModule` owns user
creation and identity lookup rules, and `PrismaModule` owns database access.

## Permission matrix

| Capability                      | CUSTOMER                      | BARBER       | MASTER                     |
| ------------------------------- | ----------------------------- | ------------ | -------------------------- |
| Sign in with email and password | Yes                           | Yes          | Yes                        |
| Sign in with phone and password | Yes                           | Yes          | Yes                        |
| View available dates            | Selected barber               | Own schedule | All schedules              |
| Create an appointment           | Own appointment               | Own schedule | Any schedule               |
| Cancel an appointment           | Own, at least 24 hours before | Own schedule | Any schedule               |
| View appointment history        | Own appointments              | Own schedule | All schedules              |
| Manage barbers                  | No                            | No           | Yes                        |
| Activate or deactivate barbers  | No                            | No           | Yes                        |
| Manage services and duration    | No                            | Own services | All services and templates |
| Own a barber schedule           | No                            | Yes          | Yes                        |

Authorization requires both a role check and resource ownership. A valid role alone does
not allow a customer or barber to access another user's resource.

The authentication foundation provides `JwtAuthGuard`, `RolesGuard`, `@Roles`,
`@CurrentUser`, and reusable user/barber ownership assertions. Domain controllers must
apply both role and ownership rules when appointments, schedules, and services are added.

## Authentication identifiers

A `CUSTOMER` must provide:

- a name;
- an email address;
- a password, stored only as a secure hash;
- an optional phone number.

Email is mandatory for customers because appointment confirmations are initially sent by
email. `BARBER` and `MASTER` require at least one login identifier: email or phone.

When present:

- email is trimmed, lowercased, and unique;
- phone is normalized to E.164 and unique;
- password and password hash are never returned by the API.

Login accepts one `identifier` field and a password. The server normalizes the identifier
as an email address or phone number before lookup.

Successful login returns a short-lived JWT bearer access token. Its claims contain the
user id, role, and barber profile id when applicable. Inactive users cannot authenticate,
and customers must confirm their email before login. Authentication failures deliberately
use a generic response for invalid identifiers and passwords.

The JWT secret is supplied only through `JWT_ACCESS_SECRET` and must contain at least 32
characters. `JWT_ACCESS_TTL_SECONDS` defaults to 900 seconds. When the user explicitly
selects the trusted-device option, `AUTH_REMEMBER_REFRESH_TTL_SECONDS` controls the extended
session and defaults to 30 days. The browser stores ordinary sessions in session storage
and trusted-device sessions in local storage. Real secrets belong in an untracked local
or deployment environment and never in `.env.example`.

## Email verification

Public customer registration creates a cryptographically random, single-use token with a
60-minute expiration. Only its SHA-256 hash is persisted in
`EmailVerificationToken`; the raw token is sent to the configured email provider and is
never returned by the API.

`POST /api/auth/confirm-email` hashes the submitted token, validates its expiration, sets
`User.emailVerifiedAt`, and deletes the token in one database transaction. The current
no-op provider is suitable only for development and automated tests. It is registered
through `NotificationsModule`; a real provider can replace it without changing
authentication code and must be configured before production.

## Password management

Password recovery does not disclose whether an email exists. A cryptographically random,
single-use token expires after 30 minutes, only its SHA-256 hash is persisted, and a
successful reset consumes it in the same transaction as the Argon2id password update.
Authenticated users may change their password by proving the current password. Customers
may request a new email-confirmation token without revealing whether an account is
awaiting confirmation.

## Data model

### User

Authentication and authorization identity.

Implemented fields:

- `id`
- `name`
- `email` — unique; required by application rules for `CUSTOMER`
- `phone` — optional and unique
- `passwordHash`
- `role` — `CUSTOMER`, `BARBER`, or `MASTER`
- `status` — `ACTIVE` or `INACTIVE`
- `createdAt`
- `updatedAt`

PostgreSQL check constraints enforce that `CUSTOMER` always has an email and that every
user has at least one identifier. The public registration DTO also requires customer
email, while the service normalizes it before persistence.

### BarberProfile

Operational profile that owns a schedule and receives appointments.

Implemented fields:

- `id`
- `userId` — unique foreign key to `User`
- `displayName` — optional
- `createdAt`
- `updatedAt`

Only `BARBER` and `MASTER` users may have a `BarberProfile`, and both roles require one.
This cross-entity invariant is enforced transactionally by the application.

## Creation rules

- Public registration creates an active `CUSTOMER`.
- The initial `MASTER` is created through the controlled `npm run bootstrap:master`
  command and never through a public HTTP route.
- The bootstrap reads `MASTER_NAME`, `MASTER_EMAIL`, optional `MASTER_PHONE`, and
  `MASTER_PASSWORD` from the private runtime environment.
- The bootstrap is idempotent and creates the required `BarberProfile`, marks the
  controlled email as verified, and stores only an Argon2id password hash.
- Only an authenticated `MASTER` can create a `BARBER`.
- Creating a barber creates both `User` and `BarberProfile` in one transaction.
- Neither `CUSTOMER` nor `BARBER` can promote themselves or create privileged users.

## Barber deactivation

Deactivation changes the barber user's status to `INACTIVE`.

An inactive barber:

- cannot authenticate;
- does not appear in new availability searches;
- cannot receive new appointments;
- retains the profile and all past and future appointments.

Future appointments are never deleted automatically. They remain visible to the
`MASTER`, who must explicitly keep, cancel, or later reassign them. Reassignment will be
defined with the appointments domain.

## Appointment ownership

The appointment model references:

- nullable `customerUserId` for a registered customer identity;
- `barberProfileId` for the operational schedule.

`customerUserId` is mandatory for customer self-service bookings. BARBER and MASTER may
instead create a local booking with a required customer name and optional phone without
creating a `User`. If that phone matches an active CUSTOMER, the API links the existing
identity automatically.

A customer selects a barber before viewing availability and may switch the selected
barber to inspect another schedule before booking.

A customer can access an appointment only when `customerUserId` matches the authenticated
user. The customer may cancel it only when at least 24 hours remain before `startsAt`.
Inside the 24-hour window, only the assigned barber or a `MASTER` may cancel it.

A customer may hold any number of active appointments. The former three-appointment cap
was retired on 2026-08-10 at the owner's request — customers book as often as they want,
and slot availability is the only practical constraint.

One quota remains: a customer flagged with `customerBookingLimited` (set automatically on
an unjustified `NO_SHOW`, cleared on their next `COMPLETED` appointment) is capped at a
single active appointment, and must book through a barber or `MASTER` rather than
self-service. Appointment creation validates this transactionally under a per-customer
advisory lock — a plain count followed by an insert is insufficient, because concurrent
requests could both pass the count and exceed the cap.

A barber can create or cancel appointments only when `barberProfileId` matches the
authenticated user's profile, regardless of the 24-hour customer restriction. A
`MASTER` may manage any schedule.

This business quota does not replace HTTP rate limiting. Authentication, availability,
and appointment endpoints still require request-rate protection.

## Service ownership

Each barber owns and manages their service catalog, including service duration. A
`MASTER` can manage every barber's catalog.

The service model will use:

- `ServiceTemplate`: an optional predefined list created and managed by `MASTER`;
- `BarberService`: a service offered by one `BarberProfile`.

A barber may create a service directly or copy one from a `ServiceTemplate`. The copied
`BarberService` remains independently editable, so changing a template does not
retroactively change barber catalogs.

Historical appointments preserve a snapshot of the applied service name, duration, and
price.

The barber administration, catalog, schedule, availability, and appointment policies are
implemented. See [Booking domain](booking-domain.md) for their persistence guarantees and
HTTP surface.
