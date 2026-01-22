-- CreateTable
CREATE TABLE "ai_provider_usage_snapshots" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "totalTokens" BIGINT NOT NULL DEFAULT 0,
    "inputTokens" BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "modelBreakdown" JSONB NOT NULL,
    "hourlyData" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncSource" TEXT NOT NULL DEFAULT 'scheduled',
    "rawApiResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_usage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_expense_snapshots" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalCost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dailyBreakdown" JSONB,
    "modelBreakdown" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncSource" TEXT NOT NULL DEFAULT 'scheduled',
    "rawApiResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_expense_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_usage_snapshots_provider_snapshotDate_key" ON "ai_provider_usage_snapshots"("provider", "snapshotDate");

-- CreateIndex
CREATE INDEX "ai_provider_usage_snapshots_provider_idx" ON "ai_provider_usage_snapshots"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_usage_snapshots_snapshotDate_idx" ON "ai_provider_usage_snapshots"("snapshotDate");

-- CreateIndex
CREATE INDEX "ai_provider_usage_snapshots_provider_snapshotDate_idx" ON "ai_provider_usage_snapshots"("provider", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_expense_snapshots_provider_period_periodStart_key" ON "ai_provider_expense_snapshots"("provider", "period", "periodStart");

-- CreateIndex
CREATE INDEX "ai_provider_expense_snapshots_provider_idx" ON "ai_provider_expense_snapshots"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_expense_snapshots_period_idx" ON "ai_provider_expense_snapshots"("period");

-- CreateIndex
CREATE INDEX "ai_provider_expense_snapshots_periodStart_idx" ON "ai_provider_expense_snapshots"("periodStart");

-- CreateIndex
CREATE INDEX "ai_provider_expense_snapshots_provider_period_periodStart_idx" ON "ai_provider_expense_snapshots"("provider", "period", "periodStart");