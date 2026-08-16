# Notifications architecture

Notifications use an outbox and provider boundary so booking and authentication code do
not depend on a transactional email vendor.

## Components

- `NotificationsModule` owns notification orchestration.
- `NotificationProvider` is the only vendor-facing contract.
- `NoopNotificationProvider` is available for development and automated tests and
  performs no external delivery.
- `ResendNotificationProvider` delivers verification, password, confirmation, reminder,
  and cancellation emails.
- `NotificationDispatcherService` polls and processes due appointment outbox records.
- `Notification` is the persistent appointment outbox.
- `NotificationsService` creates confirmation, reminder, cancellation, and
  email-verification messages.

Authentication delegates email verification to `NotificationsService`. Appointment
creation, cancellation, and rescheduling write outbox records inside the same Prisma
transaction as the domain change. This prevents a committed appointment from losing its
logical notification event.

## Provider replacement

A provider implements `NotificationProvider.send`, is registered against
`NOTIFICATION_PROVIDER`, and does not require changes in `AuthService` or
`AppointmentsService`. Delivery processing will update attempts, provider message id,
sent time, status, and the last error.

`EMAIL_PROVIDER=resend` selects the Resend HTTP adapter. It requires private
`EMAIL_API_KEY` and `EMAIL_FROM_ADDRESS` values. Verification and password flows also
require `APP_PUBLIC_URL`; `EMAIL_FROM_NAME` is optional. These variable names are
provider-neutral, so replacing Resend with another vendor later only means changing
`EMAIL_PROVIDER` and the adapter implementation. The adapter sends Portuguese
(Portugal) text and HTML content through the Resend email API and supplies a stable
idempotency key.

The dispatcher starts with the API, checks the outbox every 15 seconds, and processes up
to 20 due records per pass. PostgreSQL `FOR UPDATE SKIP LOCKED` prevents concurrent API
instances from delivering the same record. Failed deliveries retain the record, increment
the attempt counter, store a bounded error, and retry after one minute, up to five
attempts. Successful deliveries store the provider message id and sent timestamp.

## Appointment notification lifecycle

- Creation queues an immediate confirmation and a reminder scheduled 24 hours before.
- Rescheduling cancels pending records from earlier versions and queues a new confirmation
  and reminder for the incremented version.
- Cancellation cancels pending records and queues a cancellation notification.
- Completing an appointment or marking a no-show cancels any remaining pending
  notifications without queuing a new customer message.
- A unique appointment/version/type constraint prevents duplicate logical events.

Email-verification tokens are not stored in the generic outbox because they are sensitive.
Only their existing SHA-256 verification hash is persisted.
