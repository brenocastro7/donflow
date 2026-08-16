CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "customer_user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "reviews_appointment_id_key" ON "reviews"("appointment_id");
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at");
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
