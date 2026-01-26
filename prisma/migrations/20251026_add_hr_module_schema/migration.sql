-- CreateEnum (only if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE "EmployeeType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY', 'SEASONAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "employee_hr_profiles" (
    "id" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "employeeType" "EmployeeType",
    "workLocation" TEXT,
    "emergencyContact" JSONB,
    "personalInfo" JSONB,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_hr_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "manager_approval_hierarchy" (
    "id" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "managerPositionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "approvalTypes" TEXT[],
    "approvalLevel" INTEGER NOT NULL DEFAULT 1,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_approval_hierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "hr_module_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "timeOffSettings" JSONB,
    "workWeekSettings" JSONB,
    "payrollSettings" JSONB,
    "enabledFeatures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_module_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent - only create if doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "employee_hr_profiles_employeePositionId_key" ON "employee_hr_profiles"("employeePositionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_hr_profiles_businessId_idx" ON "employee_hr_profiles"("businessId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_hr_profiles_employeePositionId_idx" ON "employee_hr_profiles"("employeePositionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_hr_profiles_deletedAt_idx" ON "employee_hr_profiles"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_hr_profiles_employeeType_idx" ON "employee_hr_profiles"("employeeType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "manager_approval_hierarchy_employeePositionId_managerPositionId_businessId_key" ON "manager_approval_hierarchy"("employeePositionId", "managerPositionId", "businessId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "manager_approval_hierarchy_businessId_idx" ON "manager_approval_hierarchy"("businessId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "manager_approval_hierarchy_employeePositionId_idx" ON "manager_approval_hierarchy"("employeePositionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "manager_approval_hierarchy_managerPositionId_idx" ON "manager_approval_hierarchy"("managerPositionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "manager_approval_hierarchy_active_idx" ON "manager_approval_hierarchy"("active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "hr_module_settings_businessId_key" ON "hr_module_settings"("businessId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hr_module_settings_businessId_idx" ON "hr_module_settings"("businessId");

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employee_hr_profiles_employeePositionId_fkey'
    ) THEN
        ALTER TABLE "employee_hr_profiles" ADD CONSTRAINT "employee_hr_profiles_employeePositionId_fkey" 
        FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employee_hr_profiles_businessId_fkey'
    ) THEN
        ALTER TABLE "employee_hr_profiles" ADD CONSTRAINT "employee_hr_profiles_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'manager_approval_hierarchy_employeePositionId_fkey'
    ) THEN
        ALTER TABLE "manager_approval_hierarchy" ADD CONSTRAINT "manager_approval_hierarchy_employeePositionId_fkey" 
        FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'manager_approval_hierarchy_managerPositionId_fkey'
    ) THEN
        ALTER TABLE "manager_approval_hierarchy" ADD CONSTRAINT "manager_approval_hierarchy_managerPositionId_fkey" 
        FOREIGN KEY ("managerPositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'manager_approval_hierarchy_businessId_fkey'
    ) THEN
        ALTER TABLE "manager_approval_hierarchy" ADD CONSTRAINT "manager_approval_hierarchy_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'hr_module_settings_businessId_fkey'
    ) THEN
        ALTER TABLE "hr_module_settings" ADD CONSTRAINT "hr_module_settings_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

