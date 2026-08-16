ALTER TABLE "users"
ADD COLUMN "profile_image_key" VARCHAR(255);

CREATE UNIQUE INDEX "users_profile_image_key_key"
ON "users"("profile_image_key");
