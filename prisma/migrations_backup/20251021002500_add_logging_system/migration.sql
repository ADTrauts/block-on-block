-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "operation" TEXT,
    "userId" TEXT,
    "businessId" TEXT,
    "module" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "duration" INTEGER,
    "errorStack" TEXT,
    "environment" TEXT NOT NULL,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_alerts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_retention_policies" (
    "id" TEXT NOT NULL,
    "defaultRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "errorRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "autoCleanup" BOOLEAN NOT NULL DEFAULT true,
    "lastCleanupRun" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logs_timestamp_idx" ON "logs"("timestamp");

-- CreateIndex
CREATE INDEX "logs_level_idx" ON "logs"("level");

-- CreateIndex
CREATE INDEX "logs_service_idx" ON "logs"("service");

-- CreateIndex
CREATE INDEX "logs_operation_idx" ON "logs"("operation");

-- CreateIndex
CREATE INDEX "logs_userId_idx" ON "logs"("userId");

-- CreateIndex
CREATE INDEX "logs_businessId_idx" ON "logs"("businessId");

-- CreateIndex
CREATE INDEX "logs_module_idx" ON "logs"("module");

-- CreateIndex
CREATE INDEX "log_alerts_enabled_idx" ON "log_alerts"("enabled");
