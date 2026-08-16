ALTER TABLE "users"
  ADD COLUMN "customer_booking_blocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customer_booking_limited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "appointments"
  ADD COLUMN "auto_completed_at" TIMESTAMPTZ(3),
  ADD COLUMN "no_show_justification" VARCHAR(500);

ALTER TABLE "appointment_history" ALTER COLUMN "actor_user_id" DROP NOT NULL;
