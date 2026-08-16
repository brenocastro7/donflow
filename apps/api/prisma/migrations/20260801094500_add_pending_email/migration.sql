ALTER TABLE "users" ADD COLUMN "pending_email" VARCHAR(254);
CREATE UNIQUE INDEX "users_pending_email_key" ON "users"("pending_email");
