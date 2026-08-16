CREATE TABLE "shop_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "address" VARCHAR(300),
  "business_hours" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shop_settings_singleton_check" CHECK ("id" = 1)
);

INSERT INTO "shop_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);
