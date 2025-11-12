-- Create enums for onboarding module
CREATE TYPE "OnboardingTaskType" AS ENUM ('DOCUMENT', 'EQUIPMENT', 'TRAINING', 'MEETING', 'FORM', 'CUSTOM');
CREATE TYPE "OnboardingTaskOwnerType" AS ENUM ('EMPLOYEE', 'MANAGER', 'HR', 'BUDDY', 'IT', 'OTHER');
CREATE TYPE "OnboardingJourneyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- Templates defined at the business level
CREATE TABLE "hr_onboarding_templates" (
    "id" TEXT PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerUserId" TEXT,
    "applicabilityRules" JSONB,
    "automationSettings" JSONB,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Task templates (children of templates)
CREATE TABLE "hr_onboarding_task_templates" (
    "id" TEXT PRIMARY KEY,
    "onboardingTemplateId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "taskType" "OnboardingTaskType" NOT NULL DEFAULT 'CUSTOM',
    "ownerType" "OnboardingTaskOwnerType" NOT NULL DEFAULT 'EMPLOYEE',
    "ownerReference" TEXT,
    "dueOffsetDays" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Employee-specific onboarding journeys
CREATE TABLE "hr_employee_onboarding_journeys" (
    "id" TEXT PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeHrProfileId" TEXT NOT NULL,
    "onboardingTemplateId" TEXT,
    "status" "OnboardingJourneyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startDate" TIMESTAMP(3) NOT NULL,
    "completionDate" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Concrete tasks assigned to employees/managers/HR
CREATE TABLE "hr_employee_onboarding_tasks" (
    "id" TEXT PRIMARY KEY,
    "onboardingJourneyId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "onboardingTaskTemplateId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" "OnboardingTaskType" NOT NULL DEFAULT 'CUSTOM',
    "ownerType" "OnboardingTaskOwnerType" NOT NULL DEFAULT 'EMPLOYEE',
    "ownerReference" TEXT,
    "assignedToUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Indexes
CREATE INDEX "hr_onboarding_templates_business_idx" ON "hr_onboarding_templates" ("businessId");
CREATE INDEX "hr_onboarding_templates_default_idx" ON "hr_onboarding_templates" ("isDefault");
CREATE INDEX "hr_onboarding_task_templates_business_idx" ON "hr_onboarding_task_templates" ("businessId");
CREATE INDEX "hr_onboarding_task_templates_template_idx" ON "hr_onboarding_task_templates" ("onboardingTemplateId");
CREATE INDEX "hr_employee_onboarding_journeys_business_idx" ON "hr_employee_onboarding_journeys" ("businessId");
CREATE INDEX "hr_employee_onboarding_journeys_profile_idx" ON "hr_employee_onboarding_journeys" ("employeeHrProfileId");
CREATE INDEX "hr_employee_onboarding_journeys_status_idx" ON "hr_employee_onboarding_journeys" ("status");
CREATE INDEX "hr_employee_onboarding_tasks_business_idx" ON "hr_employee_onboarding_tasks" ("businessId");
CREATE INDEX "hr_employee_onboarding_tasks_journey_idx" ON "hr_employee_onboarding_tasks" ("onboardingJourneyId");
CREATE INDEX "hr_employee_onboarding_tasks_status_idx" ON "hr_employee_onboarding_tasks" ("status");
CREATE INDEX "hr_employee_onboarding_tasks_owner_idx" ON "hr_employee_onboarding_tasks" ("ownerType");

-- Foreign keys
ALTER TABLE "hr_onboarding_templates"
  ADD CONSTRAINT "hr_onboarding_templates_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_onboarding_task_templates"
  ADD CONSTRAINT "hr_onboarding_task_templates_templateId_fkey"
  FOREIGN KEY ("onboardingTemplateId") REFERENCES "hr_onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_onboarding_task_templates"
  ADD CONSTRAINT "hr_onboarding_task_templates_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_employee_onboarding_journeys"
  ADD CONSTRAINT "hr_employee_onboarding_journeys_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_employee_onboarding_journeys"
  ADD CONSTRAINT "hr_employee_onboarding_journeys_employeeHrProfileId_fkey"
  FOREIGN KEY ("employeeHrProfileId") REFERENCES "employee_hr_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_employee_onboarding_journeys"
  ADD CONSTRAINT "hr_employee_onboarding_journeys_template_fkey"
  FOREIGN KEY ("onboardingTemplateId") REFERENCES "hr_onboarding_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hr_employee_onboarding_tasks"
  ADD CONSTRAINT "hr_employee_onboarding_tasks_journeyId_fkey"
  FOREIGN KEY ("onboardingJourneyId") REFERENCES "hr_employee_onboarding_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_employee_onboarding_tasks"
  ADD CONSTRAINT "hr_employee_onboarding_tasks_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_employee_onboarding_tasks"
  ADD CONSTRAINT "hr_employee_onboarding_tasks_template_fkey"
  FOREIGN KEY ("onboardingTaskTemplateId") REFERENCES "hr_onboarding_task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
