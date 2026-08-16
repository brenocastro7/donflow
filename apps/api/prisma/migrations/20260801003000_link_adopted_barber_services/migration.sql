ALTER TABLE "barber_services"
ADD COLUMN "source_barber_service_id" UUID;

CREATE UNIQUE INDEX "barber_services_barber_profile_id_source_barber_service_id_key"
ON "barber_services"("barber_profile_id", "source_barber_service_id");

ALTER TABLE "barber_services"
ADD CONSTRAINT "barber_services_source_barber_service_id_fkey"
FOREIGN KEY ("source_barber_service_id") REFERENCES "barber_services"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
