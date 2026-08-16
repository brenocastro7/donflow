CREATE TABLE "monthly_dashboard_snapshots" (
    "id" UUID NOT NULL,
    "month" CHAR(7) NOT NULL,
    "scope_key" VARCHAR(80) NOT NULL,
    "data" JSONB NOT NULL,
    "closed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "monthly_dashboard_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_dashboard_snapshots_month_scope_key_key" ON "monthly_dashboard_snapshots"("month", "scope_key");
CREATE INDEX "monthly_dashboard_snapshots_month_idx" ON "monthly_dashboard_snapshots"("month");
