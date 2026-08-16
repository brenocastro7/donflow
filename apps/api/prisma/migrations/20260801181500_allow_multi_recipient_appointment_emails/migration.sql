DROP INDEX IF EXISTS "notifications_appointment_id_appointment_version_type_key";
CREATE UNIQUE INDEX "notifications_appointment_version_type_recipient_key"
  ON "notifications"("appointment_id", "appointment_version", "type", "recipient");
