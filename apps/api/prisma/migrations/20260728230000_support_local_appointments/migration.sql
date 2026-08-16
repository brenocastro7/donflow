ALTER TABLE "appointments"
  ALTER COLUMN "customer_user_id" DROP NOT NULL,
  ADD COLUMN "local_customer_name" VARCHAR(120),
  ADD COLUMN "local_customer_phone" VARCHAR(16);

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_customer_identity_check"
  CHECK (
    "customer_user_id" IS NOT NULL
    OR (
      "local_customer_name" IS NOT NULL
      AND LENGTH(TRIM("local_customer_name")) > 0
    )
  );
