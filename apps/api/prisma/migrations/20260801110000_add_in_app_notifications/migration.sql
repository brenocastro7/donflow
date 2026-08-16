CREATE TABLE "in_app_notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "appointment_id" UUID,
  "appointment_version" INTEGER,
  "type" "NotificationType" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "scheduled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "in_app_notifications_user_appointment_version_type_key" ON "in_app_notifications"("user_id", "appointment_id", "appointment_version", "type");
CREATE INDEX "in_app_notifications_user_scheduled_read_idx" ON "in_app_notifications"("user_id", "scheduled_at", "read_at");
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
