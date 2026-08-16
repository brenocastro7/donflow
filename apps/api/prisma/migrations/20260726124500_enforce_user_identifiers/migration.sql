ALTER TABLE "users"
ADD CONSTRAINT "users_login_identifier_required"
CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

ALTER TABLE "users"
ADD CONSTRAINT "users_customer_email_required"
CHECK ("role" <> 'CUSTOMER'::"UserRole" OR "email" IS NOT NULL);
