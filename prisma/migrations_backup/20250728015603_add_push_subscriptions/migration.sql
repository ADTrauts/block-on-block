/*
  Warnings:

  - You are about to drop the column `contentType` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `editHistory` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `editedById` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `formattedContent` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `pinOrder` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `pinnedAt` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `pinnedById` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the `saved_searches` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `search_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ModuleCategory" AS ENUM ('PRODUCTIVITY', 'COMMUNICATION', 'ANALYTICS', 'DEVELOPMENT', 'ENTERTAINMENT', 'EDUCATION', 'FINANCE', 'HEALTH', 'OTHER');

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_editedById_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_pinnedById_fkey";

-- DropForeignKey
ALTER TABLE "saved_searches" DROP CONSTRAINT "saved_searches_userId_fkey";

-- DropForeignKey
ALTER TABLE "search_history" DROP CONSTRAINT "search_history_userId_fkey";

-- DropIndex
DROP INDEX "messages_editedAt_idx";

-- DropIndex
DROP INDEX "messages_pinnedAt_idx";

-- DropIndex
DROP INDEX "messages_priority_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "resourceType" TEXT;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "contentType",
DROP COLUMN "editHistory",
DROP COLUMN "editedById",
DROP COLUMN "formattedContent",
DROP COLUMN "mentions",
DROP COLUMN "pinOrder",
DROP COLUMN "pinnedAt",
DROP COLUMN "pinnedById",
DROP COLUMN "priority",
DROP COLUMN "tags";

-- DropTable
DROP TABLE "saved_searches";

-- DropTable
DROP TABLE "search_history";

-- DropEnum
DROP TYPE "ContentType";

-- DropEnum
DROP TYPE "MessagePriority";

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_privacy_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "activityVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "allowDataProcessing" BOOLEAN NOT NULL DEFAULT true,
    "allowMarketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "allowAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "allowAuditLogs" BOOLEAN NOT NULL DEFAULT true,
    "dataRetentionPeriod" INTEGER NOT NULL DEFAULT 2555,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_classifications" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "classifiedBy" TEXT NOT NULL,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pattern" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sensitivity" TEXT NOT NULL,
    "expiresIn" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_retention_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resourceType" TEXT NOT NULL,
    "retentionPeriod" INTEGER NOT NULL,
    "archiveAfter" INTEGER,
    "deleteAfter" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "backupPath" TEXT NOT NULL,
    "backupSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "policyType" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "category" "ModuleCategory" NOT NULL,
    "tags" TEXT[],
    "icon" TEXT,
    "screenshots" TEXT[],
    "developerId" TEXT NOT NULL,
    "businessId" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'PENDING',
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "manifest" JSONB NOT NULL,
    "dependencies" TEXT[],
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_installations" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configured" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "module_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_submissions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "module_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_reviews" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "user_consents_userId_idx" ON "user_consents"("userId");

-- CreateIndex
CREATE INDEX "user_consents_consentType_idx" ON "user_consents"("consentType");

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_userId_consentType_version_key" ON "user_consents"("userId", "consentType", "version");

-- CreateIndex
CREATE INDEX "data_deletion_requests_userId_idx" ON "data_deletion_requests"("userId");

-- CreateIndex
CREATE INDEX "data_deletion_requests_status_idx" ON "data_deletion_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_privacy_settings_userId_key" ON "user_privacy_settings"("userId");

-- CreateIndex
CREATE INDEX "data_classifications_sensitivity_idx" ON "data_classifications"("sensitivity");

-- CreateIndex
CREATE INDEX "data_classifications_classifiedBy_idx" ON "data_classifications"("classifiedBy");

-- CreateIndex
CREATE INDEX "data_classifications_expiresAt_idx" ON "data_classifications"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "data_classifications_resourceType_resourceId_key" ON "data_classifications"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "classification_rules_name_key" ON "classification_rules"("name");

-- CreateIndex
CREATE INDEX "classification_rules_resourceType_idx" ON "classification_rules"("resourceType");

-- CreateIndex
CREATE INDEX "classification_rules_isActive_idx" ON "classification_rules"("isActive");

-- CreateIndex
CREATE INDEX "classification_rules_priority_idx" ON "classification_rules"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "classification_templates_name_key" ON "classification_templates"("name");

-- CreateIndex
CREATE INDEX "classification_templates_sensitivity_idx" ON "classification_templates"("sensitivity");

-- CreateIndex
CREATE UNIQUE INDEX "system_retention_policies_name_key" ON "system_retention_policies"("name");

-- CreateIndex
CREATE INDEX "system_retention_policies_resourceType_idx" ON "system_retention_policies"("resourceType");

-- CreateIndex
CREATE INDEX "system_retention_policies_isActive_idx" ON "system_retention_policies"("isActive");

-- CreateIndex
CREATE INDEX "backup_records_backupType_idx" ON "backup_records"("backupType");

-- CreateIndex
CREATE INDEX "backup_records_status_idx" ON "backup_records"("status");

-- CreateIndex
CREATE INDEX "backup_records_expiresAt_idx" ON "backup_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "governance_policies_name_key" ON "governance_policies"("name");

-- CreateIndex
CREATE INDEX "governance_policies_policyType_idx" ON "governance_policies"("policyType");

-- CreateIndex
CREATE INDEX "governance_policies_isActive_idx" ON "governance_policies"("isActive");

-- CreateIndex
CREATE INDEX "modules_developerId_idx" ON "modules"("developerId");

-- CreateIndex
CREATE INDEX "modules_businessId_idx" ON "modules"("businessId");

-- CreateIndex
CREATE INDEX "modules_status_idx" ON "modules"("status");

-- CreateIndex
CREATE INDEX "modules_category_idx" ON "modules"("category");

-- CreateIndex
CREATE INDEX "module_installations_moduleId_idx" ON "module_installations"("moduleId");

-- CreateIndex
CREATE INDEX "module_installations_userId_idx" ON "module_installations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "module_installations_moduleId_userId_key" ON "module_installations"("moduleId", "userId");

-- CreateIndex
CREATE INDEX "module_submissions_moduleId_idx" ON "module_submissions"("moduleId");

-- CreateIndex
CREATE INDEX "module_submissions_submitterId_idx" ON "module_submissions"("submitterId");

-- CreateIndex
CREATE INDEX "module_submissions_reviewerId_idx" ON "module_submissions"("reviewerId");

-- CreateIndex
CREATE INDEX "module_submissions_status_idx" ON "module_submissions"("status");

-- CreateIndex
CREATE INDEX "module_reviews_moduleId_idx" ON "module_reviews"("moduleId");

-- CreateIndex
CREATE INDEX "module_reviews_reviewerId_idx" ON "module_reviews"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "module_reviews_moduleId_reviewerId_key" ON "module_reviews"("moduleId", "reviewerId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");

-- CreateIndex
CREATE INDEX "AuditLog_resourceId_idx" ON "AuditLog"("resourceId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_installations" ADD CONSTRAINT "module_installations_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_installations" ADD CONSTRAINT "module_installations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_submissions" ADD CONSTRAINT "module_submissions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_submissions" ADD CONSTRAINT "module_submissions_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_submissions" ADD CONSTRAINT "module_submissions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_reviews" ADD CONSTRAINT "module_reviews_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_reviews" ADD CONSTRAINT "module_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
