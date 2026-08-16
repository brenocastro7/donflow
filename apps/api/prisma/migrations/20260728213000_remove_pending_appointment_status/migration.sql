-- PENDING is not part of the appointment lifecycle. Preserve any existing
-- development data by treating previously pending bookings as confirmed.
UPDATE "appointments"
SET "status" = 'CONFIRMED'
WHERE "status" = 'PENDING';

-- The exclusion constraint depends on AppointmentStatus and must be recreated
-- after replacing the PostgreSQL enum.
ALTER TABLE "appointments"
  DROP CONSTRAINT "appointments_no_barber_overlap";

ALTER TABLE "appointments"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "AppointmentStatus" RENAME TO "AppointmentStatus_old";

CREATE TYPE "AppointmentStatus" AS ENUM (
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW'
);

ALTER TABLE "appointments"
  ALTER COLUMN "status" TYPE "AppointmentStatus"
  USING ("status"::text::"AppointmentStatus"),
  ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

DROP TYPE "AppointmentStatus_old";

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_barber_overlap"
  EXCLUDE USING gist (
    "barber_profile_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" = 'CONFIRMED');
