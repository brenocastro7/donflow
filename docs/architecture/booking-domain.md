# Booking domain

This document describes the implemented barber, catalog, schedule, availability, and
appointment foundation.

## Barber administration

Only `MASTER` may create a `BARBER` or change their status. Creation persists `User`,
`BarberProfile`, the initial business-hour ranges, and an audit log in one transaction.
Deactivation changes only `User.status`; profiles and appointments remain intact.

Initial hours use `Europe/Lisbon`:

- Monday through Friday: 09:00–13:00 and 15:00–19:00;
- Saturday: 09:00–14:00;
- Sunday: closed.

## Service catalogs

`ServiceTemplate` is controlled by `MASTER`. A `BARBER` may copy an active template or
create a direct `BarberService`; `MASTER` may manage any catalog. Copies retain the
template id for provenance but store independent name, description, duration, and price.

Inactive services remain persisted. New appointments accept only active services owned
by an active barber. Every appointment stores immutable snapshots of the service name,
duration, and price.

## Schedule and availability

Business hours are recurring minute ranges grouped by weekday. Schedule blocks store
exceptional UTC intervals. Overlapping business-hour ranges are rejected.

`GET /api/availability` accepts a barber profile, barber service, local date, and optional
slot interval. It converts `Europe/Lisbon` local time to UTC with daylight-saving support,
then removes schedule blocks and active appointments. Only slots that fully fit inside
one business-hour range and start at least 24 hours later are returned.

There is no lateness calculation and no technical buffer between appointments in the
current scope. Consecutive appointments may touch when the preceding service ends.

## Appointment guarantees

Appointment creation:

- rejects past times and periods outside business hours;
- requires at least 24 hours between creation and the requested start;
- rejects inactive barbers and services;
- serializes requests per customer with a PostgreSQL advisory transaction lock;
- limits each customer to three `CONFIRMED` appointments;
- rejects blocks and existing appointment overlaps;
- uses a PostgreSQL exclusion constraint as the final concurrent overlap authority;
- runs at serializable transaction isolation.

Authenticated `BARBER` and `MASTER` users may create a local operational booking without
registering a customer account. These requests always provide `customerName` and may
provide an E.164 `customerPhone`. When the phone belongs to an active `CUSTOMER`, the
appointment is linked to that existing user and uses the account information and email
notification flow. Otherwise, the name and optional phone are stored only as appointment
contact snapshots; no `User` is created and no email is queued because there is no
verified recipient.

`customerUserId` is therefore nullable only for operational local bookings. A database
check constraint requires every appointment to reference a customer account or contain a
non-empty local customer name. Customers have no cap on active appointments; the only
remaining quota is the single-booking cap carried by a customer with an unjustified
no-show, and it applies whenever an existing customer account is linked. Staff-created
guest bookings remain protected by authentication, schedule ownership, rate limiting,
and overlap constraints.

A customer sees only their appointments and may cancel one only with at least 24 hours
remaining. A barber sees and cancels only appointments in their profile. `MASTER` may
operate on every schedule.

Rescheduling repeats the same availability, ownership, business-hour, overlap, and
24-hour validations. Every creation, cancellation, and rescheduling action appends an
immutable `AppointmentHistory` record. Optimistic appointment versions prevent stale
updates and identify notifications that belong to each schedule version.

The appointment lifecycle does not use a pending state. New bookings are immediately
`CONFIRMED`. The responsible barber or `MASTER` may close a confirmed appointment as
`COMPLETED` or `NO_SHOW` after its scheduled start. Closing an appointment increments its
version, cancels remaining pending notifications, and appends an immutable history entry.
Final and cancelled appointments cannot return to `CONFIRMED`.

## Calendar queries

`GET /api/appointments` requires a `date` in `YYYY-MM-DD` format and accepts `view=day`,
`view=week`, or `view=month`. Period boundaries are calculated in `Europe/Lisbon`;
weeks start on Monday and month queries cover the calendar month containing the reference
date. Optional `status`, `page`, and `pageSize` parameters provide bounded filtering and
pagination.

A customer receives only personal appointments and may optionally filter by barber. A
barber always receives only their own schedule. `MASTER` receives their own schedule by
default and may explicitly select another `barberProfileId`. The response includes the
resolved UTC period and time-zone metadata for deterministic frontend navigation.

Service prices are informational values shown to customers and preserved historically.
The booking backend does not accept payments, close sales, manage cash, or implement a
point-of-sale workflow. A future POS must be a separate bounded context integrated with
appointments only when the business requests it.

## HTTP surface

- `POST /api/barbers` — MASTER creates a barber.
- `GET /api/barbers` — authenticated active-barber listing.
- `PATCH /api/barbers/:barberProfileId/status` — MASTER changes barber status.
- `POST|GET|PATCH /api/service-templates` — MASTER template management and authenticated
  reading.
- `POST /api/barber-services` — BARBER or MASTER creates a catalog item.
- `GET /api/barbers/:barberProfileId/services` — reads a catalog.
- `PATCH /api/barber-services/:id` — owner BARBER or MASTER updates a catalog item.
- `GET|PUT /api/barbers/:barberProfileId/business-hours` — reads or replaces hours.
- `POST /api/barbers/:barberProfileId/schedule-blocks` — creates a block.
- `DELETE /api/schedule-blocks/:id` — removes an owned block.
- `GET /api/availability` — calculates available slots.
- `POST /api/appointments` — creates an authorized confirmed appointment; BARBER and
  MASTER local bookings require `customerName`, accept optional `customerPhone`, and
  automatically link a matching active CUSTOMER.
- `GET /api/appointments?view=day|week|month&date=YYYY-MM-DD` — reads an
  authorized paginated calendar period; `MASTER` may add `barberProfileId`, and callers
  may add `status`, `page`, and `pageSize`.
- `GET /api/appointments/:id` — reads an authorized appointment detail.
- `PATCH /api/appointments/:id/cancel` — applies role, ownership, and notice rules.
- `PATCH /api/appointments/:id/reschedule` — validates and changes an active booking.
- `PATCH /api/appointments/:id/status` — responsible BARBER or MASTER closes a
  started appointment as `COMPLETED` or `NO_SHOW`.
- `GET /api/appointments/:id/history` — reads authorized immutable history.
- `GET /api/customers` — MASTER searches and paginates customer identities.
- `GET /api/customers/:id` — MASTER reads a customer detail.
- `GET /api/customers/:id/appointments` — MASTER reads paginated customer history.

## Rate limiting

The API has a global in-memory rate limit of 120 requests per minute. Sensitive overrides
allow five login attempts, 30 availability requests, and ten appointment creations per
minute per tracker. Production with multiple API replicas will require shared storage
such as Redis.

## User-facing locale

API validation, authorization, domain errors, and transactional email content use
Portuguese (Portugal). Technical source code, OpenAPI descriptions, logs, and repository
documentation remain in English.

## Closed scheduling rules

- minimum booking notice: 24 hours;
- customer cancellation and rescheduling notice: 24 hours;
- lateness calculations: outside the current scope;
- technical buffer: none.
