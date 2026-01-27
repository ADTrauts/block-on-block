-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "adminImpersonationId" TEXT;

-- CreateTable
CREATE TABLE "admin_impersonations" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "admin_impersonations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_impersonations_adminId_idx" ON "admin_impersonations"("adminId");

-- CreateIndex
CREATE INDEX "admin_impersonations_targetUserId_idx" ON "admin_impersonations"("targetUserId");

-- CreateIndex
CREATE INDEX "admin_impersonations_startedAt_idx" ON "admin_impersonations"("startedAt");

-- CreateIndex
CREATE INDEX "AuditLog_adminImpersonationId_idx" ON "AuditLog"("adminImpersonationId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminImpersonationId_fkey" FOREIGN KEY ("adminImpersonationId") REFERENCES "admin_impersonations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_impersonations" ADD CONSTRAINT "admin_impersonations_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_impersonations" ADD CONSTRAINT "admin_impersonations_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
