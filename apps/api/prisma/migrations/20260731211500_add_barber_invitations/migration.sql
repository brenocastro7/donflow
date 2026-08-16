CREATE TABLE "barber_invitations" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "barber_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "barber_invitations_email_key" ON "barber_invitations"("email");
CREATE UNIQUE INDEX "barber_invitations_token_hash_key" ON "barber_invitations"("token_hash");
CREATE INDEX "barber_invitations_expires_at_idx" ON "barber_invitations"("expires_at");

ALTER TABLE "barber_invitations"
  ADD CONSTRAINT "barber_invitations_invited_by_user_id_fkey"
  FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
