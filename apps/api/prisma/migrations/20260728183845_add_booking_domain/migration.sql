-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentOrigin" AS ENUM ('CUSTOMER', 'BARBER', 'MASTER');

-- CreateTable
CREATE TABLE "service_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "duration_minutes" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barber_services" (
    "id" UUID NOT NULL,
    "barber_profile_id" UUID NOT NULL,
    "service_template_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "duration_minutes" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "barber_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" UUID NOT NULL,
    "barber_profile_id" UUID NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_blocks" (
    "id" UUID NOT NULL,
    "barber_profile_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(250),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "customer_user_id" UUID NOT NULL,
    "barber_profile_id" UUID NOT NULL,
    "barber_service_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "origin" "AppointmentOrigin" NOT NULL,
    "service_name_snapshot" VARCHAR(120) NOT NULL,
    "duration_snapshot" INTEGER NOT NULL,
    "price_snapshot" DECIMAL(10,2) NOT NULL,
    "notes" VARCHAR(500),
    "cancellation_reason" VARCHAR(500),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(80) NOT NULL,
    "target_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "barber_services_barber_profile_id_is_active_idx" ON "barber_services"("barber_profile_id", "is_active");

-- CreateIndex
CREATE INDEX "business_hours_barber_profile_id_day_of_week_idx" ON "business_hours"("barber_profile_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_barber_profile_id_day_of_week_start_minute_key" ON "business_hours"("barber_profile_id", "day_of_week", "start_minute");

-- CreateIndex
CREATE INDEX "schedule_blocks_barber_profile_id_starts_at_ends_at_idx" ON "schedule_blocks"("barber_profile_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "appointments_customer_user_id_status_idx" ON "appointments"("customer_user_id", "status");

-- CreateIndex
CREATE INDEX "appointments_barber_profile_id_starts_at_idx" ON "appointments"("barber_profile_id", "starts_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_barber_profile_id_fkey" FOREIGN KEY ("barber_profile_id") REFERENCES "barber_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_service_template_id_fkey" FOREIGN KEY ("service_template_id") REFERENCES "service_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_barber_profile_id_fkey" FOREIGN KEY ("barber_profile_id") REFERENCES "barber_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_barber_profile_id_fkey" FOREIGN KEY ("barber_profile_id") REFERENCES "barber_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_barber_profile_id_fkey" FOREIGN KEY ("barber_profile_id") REFERENCES "barber_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_barber_service_id_fkey" FOREIGN KEY ("barber_service_id") REFERENCES "barber_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain integrity checks.
ALTER TABLE "service_templates"
  ADD CONSTRAINT "service_templates_duration_positive" CHECK ("duration_minutes" > 0),
  ADD CONSTRAINT "service_templates_price_non_negative" CHECK ("price" >= 0);

ALTER TABLE "barber_services"
  ADD CONSTRAINT "barber_services_duration_positive" CHECK ("duration_minutes" > 0),
  ADD CONSTRAINT "barber_services_price_non_negative" CHECK ("price" >= 0);

ALTER TABLE "business_hours"
  ADD CONSTRAINT "business_hours_valid_minutes"
  CHECK ("start_minute" >= 0 AND "end_minute" <= 1440 AND "start_minute" < "end_minute");

ALTER TABLE "schedule_blocks"
  ADD CONSTRAINT "schedule_blocks_valid_range" CHECK ("starts_at" < "ends_at");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_valid_range" CHECK ("starts_at" < "ends_at"),
  ADD CONSTRAINT "appointments_duration_positive" CHECK ("duration_snapshot" > 0),
  ADD CONSTRAINT "appointments_price_non_negative" CHECK ("price_snapshot" >= 0);

-- PostgreSQL is the final authority against concurrent double booking.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_barber_overlap"
  EXCLUDE USING gist (
    "barber_profile_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));

-- Initial opening hours for all existing barber profiles.
INSERT INTO "business_hours"
  ("id", "barber_profile_id", "day_of_week", "start_minute", "end_minute", "updated_at")
SELECT
  gen_random_uuid(),
  profile."id",
  schedule."day"::"DayOfWeek",
  schedule."start_minute",
  schedule."end_minute",
  CURRENT_TIMESTAMP
FROM "barber_profiles" profile
CROSS JOIN (
  VALUES
    ('MONDAY', 540, 780), ('MONDAY', 900, 1140),
    ('TUESDAY', 540, 780), ('TUESDAY', 900, 1140),
    ('WEDNESDAY', 540, 780), ('WEDNESDAY', 900, 1140),
    ('THURSDAY', 540, 780), ('THURSDAY', 900, 1140),
    ('FRIDAY', 540, 780), ('FRIDAY', 900, 1140),
    ('SATURDAY', 540, 840)
) AS schedule("day", "start_minute", "end_minute");
