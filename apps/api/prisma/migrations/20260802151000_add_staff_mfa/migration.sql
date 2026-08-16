ALTER TABLE "users"
ADD COLUMN "mfa_secret_encrypted" VARCHAR(512),
ADD COLUMN "mfa_enabled_at" TIMESTAMPTZ(3),
ADD COLUMN "mfa_recovery_code_hashes" JSONB;
