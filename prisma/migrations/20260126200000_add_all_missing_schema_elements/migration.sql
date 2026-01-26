-- ============================================================================
-- COMPREHENSIVE MIGRATION: Add All Missing Schema Elements
-- ============================================================================
-- This migration adds all tables, columns, indexes, and foreign keys that
-- exist in the schema but are missing from migration history.
-- All operations use IF NOT EXISTS to be idempotent and safe for production.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED', 'ESCALATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttendanceExceptionType" AS ENUM ('LATE_ARRIVAL', 'EARLY_DEPARTURE', 'MISSING_PUNCH', 'OVERTIME', 'BREAK_VIOLATION', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'CLOCK_IN', 'MOBILE_APP', 'BIOMETRIC', 'GPS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttendanceRecordStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED', 'ADJUSTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttendanceShiftAssignmentStatus" AS ENUM ('ASSIGNED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AvailabilityType" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'PREFERRED', 'LIMITED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'TERMINATED', 'LEAVE', 'SABBATICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TimeOffType" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'BEREAVEMENT', 'JURY_DUTY', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- AI CONVERSATIONS & MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dashboardId" TEXT,
    "businessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "trashedAt" TIMESTAMP(3),

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- AI QUERY BILLING
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ai_query_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "currentBalance" INTEGER NOT NULL DEFAULT 0,
    "totalPurchased" INTEGER NOT NULL DEFAULT 0,
    "totalUsed" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "lastResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_query_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_query_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "balanceId" TEXT,
    "queryPack" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_query_purchases_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- PRICING CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pricing_configs" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "perEmployeePrice" DOUBLE PRECISION,
    "includedEmployees" INTEGER,
    "queryPackSmall" DOUBLE PRECISION,
    "queryPackMedium" DOUBLE PRECISION,
    "queryPackLarge" DOUBLE PRECISION,
    "queryPackEnterprise" DOUBLE PRECISION,
    "baseAIAllowance" INTEGER,
    "stripePriceId" TEXT,
    "perEmployeeStripePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "price_changes" (
    "id" TEXT NOT NULL,
    "pricingConfigId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldValue" DOUBLE PRECISION NOT NULL,
    "newValue" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "refunds" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "stripeRefundId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- FRONT PAGE CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS "business_front_page_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "layout" JSONB,
    "theme" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_front_page_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "business_front_widgets" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "config" JSONB,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_front_widgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_front_page_customizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "layout" JSONB,
    "widgetPreferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_front_page_customizations_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- DRIVE PERMISSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "folder_permissions" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folder_permissions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- HR MODULE - TIME OFF & ATTENDANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "time_off_requests" (
    "id" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "TimeOffType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION,
    "status" "TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approvedBy" TEXT,
    "deniedBy" TEXT,
    "denialReason" TEXT,
    "scheduleEventId" TEXT,
    "personalEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_off_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attendance_policies" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attendance_shift_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakDuration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_shift_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attendance_shift_assignments" (
    "id" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "AttendanceShiftAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_shift_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attendance_records" (
    "id" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "policyId" TEXT,
    "shiftAssignmentId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "breakStart" TIMESTAMP(3),
    "breakEnd" TIMESTAMP(3),
    "totalHours" DOUBLE PRECISION,
    "overtimeHours" DOUBLE PRECISION,
    "status" "AttendanceRecordStatus" NOT NULL DEFAULT 'PENDING',
    "method" "AttendanceMethod",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attendance_exceptions" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "policyId" TEXT,
    "type" "AttendanceExceptionType" NOT NULL,
    "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'PENDING',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_exceptions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- SCHEDULING MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "schedules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "layoutMode" TEXT,
    "locationId" TEXT,
    "createdById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "schedule_shifts" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeePositionId" TEXT,
    "positionId" TEXT,
    "locationId" TEXT,
    "shiftTemplateId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "jobFunction" TEXT,
    "stationName" TEXT,
    "isOpenShift" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shift_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakDuration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "schedule_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_availability" (
    "id" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "type" "AvailabilityType" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shift_swap_requests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "originalShiftId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedToId" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_locations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_locations_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- TASK MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS "tasks" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "parentRecurringTaskId" TEXT,
    "trashedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_dependencies" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_attachments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_file_links" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_file_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_event_links" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_event_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_watchers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_projects" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_time_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_time_logs_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- INDEXES (Performance optimization)
-- ============================================================================

-- AI Conversations
CREATE INDEX IF NOT EXISTS "ai_conversations_userId_lastMessageAt_idx" ON "ai_conversations"("userId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "ai_conversations_dashboardId_idx" ON "ai_conversations"("dashboardId");
CREATE INDEX IF NOT EXISTS "ai_conversations_businessId_idx" ON "ai_conversations"("businessId");
CREATE INDEX IF NOT EXISTS "ai_conversations_isArchived_lastMessageAt_idx" ON "ai_conversations"("isArchived", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "ai_conversations_trashedAt_idx" ON "ai_conversations"("trashedAt");

-- AI Messages
CREATE INDEX IF NOT EXISTS "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_messages_role_createdAt_idx" ON "ai_messages"("role", "createdAt");

-- AI Query Balances
CREATE INDEX IF NOT EXISTS "ai_query_balances_userId_idx" ON "ai_query_balances"("userId");
CREATE INDEX IF NOT EXISTS "ai_query_balances_businessId_idx" ON "ai_query_balances"("businessId");
CREATE INDEX IF NOT EXISTS "ai_query_balances_currentPeriodStart_idx" ON "ai_query_balances"("currentPeriodStart");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_query_balances_userId_businessId_key" ON "ai_query_balances"("userId", "businessId");

-- AI Query Purchases
CREATE INDEX IF NOT EXISTS "ai_query_purchases_userId_idx" ON "ai_query_purchases"("userId");
CREATE INDEX IF NOT EXISTS "ai_query_purchases_businessId_idx" ON "ai_query_purchases"("businessId");
CREATE INDEX IF NOT EXISTS "ai_query_purchases_status_idx" ON "ai_query_purchases"("status");
CREATE INDEX IF NOT EXISTS "ai_query_purchases_createdAt_idx" ON "ai_query_purchases"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_query_purchases_stripePaymentIntentId_key" ON "ai_query_purchases"("stripePaymentIntentId") WHERE "stripePaymentIntentId" IS NOT NULL;

-- Pricing Configs
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_configs_tier_billingCycle_effectiveDate_key" ON "pricing_configs"("tier", "billingCycle", "effectiveDate");
CREATE INDEX IF NOT EXISTS "pricing_configs_tier_isActive_idx" ON "pricing_configs"("tier", "isActive");
CREATE INDEX IF NOT EXISTS "pricing_configs_effectiveDate_idx" ON "pricing_configs"("effectiveDate");
CREATE INDEX IF NOT EXISTS "pricing_configs_tier_billingCycle_idx" ON "pricing_configs"("tier", "billingCycle");

-- Price Changes
CREATE INDEX IF NOT EXISTS "price_changes_pricingConfigId_idx" ON "price_changes"("pricingConfigId");
CREATE INDEX IF NOT EXISTS "price_changes_createdAt_idx" ON "price_changes"("createdAt");
CREATE INDEX IF NOT EXISTS "price_changes_changeType_idx" ON "price_changes"("changeType");

-- Refunds
CREATE INDEX IF NOT EXISTS "refunds_invoiceId_idx" ON "refunds"("invoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_stripeRefundId_key" ON "refunds"("stripeRefundId") WHERE "stripeRefundId" IS NOT NULL;

-- Business Front Page
CREATE UNIQUE INDEX IF NOT EXISTS "business_front_page_configs_businessId_key" ON "business_front_page_configs"("businessId");
CREATE INDEX IF NOT EXISTS "business_front_widgets_configId_idx" ON "business_front_widgets"("configId");
CREATE INDEX IF NOT EXISTS "business_front_widgets_widgetType_idx" ON "business_front_widgets"("widgetType");
CREATE INDEX IF NOT EXISTS "business_front_widgets_visible_idx" ON "business_front_widgets"("visible");
CREATE UNIQUE INDEX IF NOT EXISTS "user_front_page_customizations_userId_businessId_key" ON "user_front_page_customizations"("userId", "businessId");
CREATE INDEX IF NOT EXISTS "user_front_page_customizations_userId_idx" ON "user_front_page_customizations"("userId");
CREATE INDEX IF NOT EXISTS "user_front_page_customizations_businessId_idx" ON "user_front_page_customizations"("businessId");

-- Folder Permissions
CREATE UNIQUE INDEX IF NOT EXISTS "folder_permissions_folderId_userId_key" ON "folder_permissions"("folderId", "userId");
CREATE INDEX IF NOT EXISTS "folder_permissions_folderId_idx" ON "folder_permissions"("folderId");
CREATE INDEX IF NOT EXISTS "folder_permissions_userId_idx" ON "folder_permissions"("userId");

-- Time Off Requests
CREATE INDEX IF NOT EXISTS "time_off_requests_businessId_idx" ON "time_off_requests"("businessId");
CREATE INDEX IF NOT EXISTS "time_off_requests_employeePositionId_idx" ON "time_off_requests"("employeePositionId");
CREATE INDEX IF NOT EXISTS "time_off_requests_status_idx" ON "time_off_requests"("status");

-- Attendance
CREATE INDEX IF NOT EXISTS "attendance_policies_businessId_idx" ON "attendance_policies"("businessId");
CREATE INDEX IF NOT EXISTS "attendance_policies_active_idx" ON "attendance_policies"("active");
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_shift_templates_businessId_name_key" ON "attendance_shift_templates"("businessId", "name");
CREATE INDEX IF NOT EXISTS "attendance_shift_templates_businessId_idx" ON "attendance_shift_templates"("businessId");
CREATE INDEX IF NOT EXISTS "attendance_shift_templates_policyId_idx" ON "attendance_shift_templates"("policyId");
CREATE INDEX IF NOT EXISTS "attendance_shift_templates_isActive_idx" ON "attendance_shift_templates"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_shift_assignments_employeePositionId_shiftTemplateId_effectiveFrom_key" ON "attendance_shift_assignments"("employeePositionId", "shiftTemplateId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "attendance_shift_assignments_businessId_idx" ON "attendance_shift_assignments"("businessId");
CREATE INDEX IF NOT EXISTS "attendance_shift_assignments_employeePositionId_idx" ON "attendance_shift_assignments"("employeePositionId");
CREATE INDEX IF NOT EXISTS "attendance_shift_assignments_shiftTemplateId_idx" ON "attendance_shift_assignments"("shiftTemplateId");
CREATE INDEX IF NOT EXISTS "attendance_shift_assignments_status_idx" ON "attendance_shift_assignments"("status");
CREATE INDEX IF NOT EXISTS "attendance_records_businessId_workDate_idx" ON "attendance_records"("businessId", "workDate");
CREATE INDEX IF NOT EXISTS "attendance_records_employeePositionId_workDate_idx" ON "attendance_records"("employeePositionId", "workDate");
CREATE INDEX IF NOT EXISTS "attendance_records_status_idx" ON "attendance_records"("status");
CREATE INDEX IF NOT EXISTS "attendance_exceptions_businessId_status_idx" ON "attendance_exceptions"("businessId", "status");
CREATE INDEX IF NOT EXISTS "attendance_exceptions_employeePositionId_idx" ON "attendance_exceptions"("employeePositionId");
CREATE INDEX IF NOT EXISTS "attendance_exceptions_attendanceRecordId_idx" ON "attendance_exceptions"("attendanceRecordId");

-- Scheduling
CREATE INDEX IF NOT EXISTS "schedules_businessId_idx" ON "schedules"("businessId");
CREATE INDEX IF NOT EXISTS "schedules_status_idx" ON "schedules"("status");
CREATE INDEX IF NOT EXISTS "schedules_startDate_endDate_idx" ON "schedules"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "schedules_layoutMode_idx" ON "schedules"("layoutMode");
CREATE INDEX IF NOT EXISTS "schedule_shifts_businessId_idx" ON "schedule_shifts"("businessId");
CREATE INDEX IF NOT EXISTS "schedule_shifts_scheduleId_idx" ON "schedule_shifts"("scheduleId");
CREATE INDEX IF NOT EXISTS "schedule_shifts_employeePositionId_idx" ON "schedule_shifts"("employeePositionId");
CREATE INDEX IF NOT EXISTS "schedule_shifts_positionId_idx" ON "schedule_shifts"("positionId");
CREATE INDEX IF NOT EXISTS "schedule_shifts_locationId_idx" ON "schedule_shifts"("locationId");
CREATE INDEX IF NOT EXISTS "schedule_shifts_startTime_endTime_idx" ON "schedule_shifts"("startTime", "endTime");
CREATE INDEX IF NOT EXISTS "schedule_shifts_isOpenShift_idx" ON "schedule_shifts"("isOpenShift");
CREATE INDEX IF NOT EXISTS "schedule_shifts_jobFunction_idx" ON "schedule_shifts"("jobFunction");
CREATE INDEX IF NOT EXISTS "schedule_shifts_stationName_idx" ON "schedule_shifts"("stationName");
CREATE INDEX IF NOT EXISTS "schedule_shifts_priority_idx" ON "schedule_shifts"("priority");
CREATE UNIQUE INDEX IF NOT EXISTS "shift_templates_businessId_name_key" ON "shift_templates"("businessId", "name");
CREATE INDEX IF NOT EXISTS "shift_templates_businessId_idx" ON "shift_templates"("businessId");
CREATE INDEX IF NOT EXISTS "shift_templates_isActive_idx" ON "shift_templates"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_templates_businessId_name_key" ON "schedule_templates"("businessId", "name");
CREATE INDEX IF NOT EXISTS "schedule_templates_businessId_idx" ON "schedule_templates"("businessId");
CREATE INDEX IF NOT EXISTS "schedule_templates_isActive_idx" ON "schedule_templates"("isActive");
CREATE INDEX IF NOT EXISTS "employee_availability_businessId_idx" ON "employee_availability"("businessId");
CREATE INDEX IF NOT EXISTS "employee_availability_employeePositionId_idx" ON "employee_availability"("employeePositionId");
CREATE INDEX IF NOT EXISTS "employee_availability_dayOfWeek_idx" ON "employee_availability"("dayOfWeek");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_businessId_idx" ON "shift_swap_requests"("businessId");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_originalShiftId_idx" ON "shift_swap_requests"("originalShiftId");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_requestedById_idx" ON "shift_swap_requests"("requestedById");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_status_idx" ON "shift_swap_requests"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "job_locations_businessId_name_key" ON "job_locations"("businessId", "name");
CREATE INDEX IF NOT EXISTS "job_locations_businessId_idx" ON "job_locations"("businessId");
CREATE INDEX IF NOT EXISTS "job_locations_isActive_idx" ON "job_locations"("isActive");

-- Tasks
CREATE INDEX IF NOT EXISTS "tasks_dashboardId_businessId_idx" ON "tasks"("dashboardId", "businessId");
CREATE INDEX IF NOT EXISTS "tasks_assignedToId_idx" ON "tasks"("assignedToId");
CREATE INDEX IF NOT EXISTS "tasks_createdById_idx" ON "tasks"("createdById");
CREATE INDEX IF NOT EXISTS "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");
CREATE INDEX IF NOT EXISTS "tasks_status_dueDate_idx" ON "tasks"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "tasks_trashedAt_idx" ON "tasks"("trashedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "task_dependencies_taskId_dependsOnTaskId_key" ON "task_dependencies"("taskId", "dependsOnTaskId");
CREATE INDEX IF NOT EXISTS "task_dependencies_taskId_idx" ON "task_dependencies"("taskId");
CREATE INDEX IF NOT EXISTS "task_dependencies_dependsOnTaskId_idx" ON "task_dependencies"("dependsOnTaskId");
CREATE INDEX IF NOT EXISTS "task_attachments_taskId_idx" ON "task_attachments"("taskId");
CREATE UNIQUE INDEX IF NOT EXISTS "task_file_links_taskId_fileId_key" ON "task_file_links"("taskId", "fileId");
CREATE INDEX IF NOT EXISTS "task_file_links_taskId_idx" ON "task_file_links"("taskId");
CREATE INDEX IF NOT EXISTS "task_file_links_fileId_idx" ON "task_file_links"("fileId");
CREATE UNIQUE INDEX IF NOT EXISTS "task_event_links_taskId_eventId_key" ON "task_event_links"("taskId", "eventId");
CREATE INDEX IF NOT EXISTS "task_event_links_taskId_idx" ON "task_event_links"("taskId");
CREATE INDEX IF NOT EXISTS "task_event_links_eventId_idx" ON "task_event_links"("eventId");
CREATE INDEX IF NOT EXISTS "task_comments_taskId_idx" ON "task_comments"("taskId");
CREATE INDEX IF NOT EXISTS "task_comments_userId_idx" ON "task_comments"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "task_watchers_taskId_userId_key" ON "task_watchers"("taskId", "userId");
CREATE INDEX IF NOT EXISTS "task_watchers_taskId_idx" ON "task_watchers"("taskId");
CREATE INDEX IF NOT EXISTS "task_watchers_userId_idx" ON "task_watchers"("userId");
CREATE INDEX IF NOT EXISTS "task_projects_dashboardId_businessId_idx" ON "task_projects"("dashboardId", "businessId");
CREATE INDEX IF NOT EXISTS "task_time_logs_taskId_idx" ON "task_time_logs"("taskId");
CREATE INDEX IF NOT EXISTS "task_time_logs_userId_idx" ON "task_time_logs"("userId");
CREATE INDEX IF NOT EXISTS "task_time_logs_startedAt_idx" ON "task_time_logs"("startedAt");
CREATE INDEX IF NOT EXISTS "task_time_logs_isActive_idx" ON "task_time_logs"("isActive");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

-- AI Conversations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversations_userId_fkey') THEN
        ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversations_dashboardId_fkey') THEN
        ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_dashboardId_fkey" 
        FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversations_businessId_fkey') THEN
        ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AI Messages
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_messages_conversationId_fkey') THEN
        ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" 
        FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AI Query Balances
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_query_balances_userId_fkey') THEN
        ALTER TABLE "ai_query_balances" ADD CONSTRAINT "ai_query_balances_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_query_balances_businessId_fkey') THEN
        ALTER TABLE "ai_query_balances" ADD CONSTRAINT "ai_query_balances_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AI Query Purchases
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_query_purchases_userId_fkey') THEN
        ALTER TABLE "ai_query_purchases" ADD CONSTRAINT "ai_query_purchases_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_query_purchases_businessId_fkey') THEN
        ALTER TABLE "ai_query_purchases" ADD CONSTRAINT "ai_query_purchases_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_query_purchases_balanceId_fkey') THEN
        ALTER TABLE "ai_query_purchases" ADD CONSTRAINT "ai_query_purchases_balanceId_fkey" 
        FOREIGN KEY ("balanceId") REFERENCES "ai_query_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Pricing Configs
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_configs_createdBy_fkey') THEN
        ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Price Changes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_changes_pricingConfigId_fkey') THEN
        ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_pricingConfigId_fkey" 
        FOREIGN KEY ("pricingConfigId") REFERENCES "pricing_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_changes_createdBy_fkey') THEN
        ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Refunds
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refunds_invoiceId_fkey') THEN
        ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" 
        FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Business Front Page
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_front_page_configs_businessId_fkey') THEN
        ALTER TABLE "business_front_page_configs" ADD CONSTRAINT "business_front_page_configs_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_front_widgets_configId_fkey') THEN
        ALTER TABLE "business_front_widgets" ADD CONSTRAINT "business_front_widgets_configId_fkey" 
        FOREIGN KEY ("configId") REFERENCES "business_front_page_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- User Front Page
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_front_page_customizations_userId_fkey') THEN
        ALTER TABLE "user_front_page_customizations" ADD CONSTRAINT "user_front_page_customizations_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_front_page_customizations_businessId_fkey') THEN
        ALTER TABLE "user_front_page_customizations" ADD CONSTRAINT "user_front_page_customizations_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Folder Permissions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folder_permissions_folderId_fkey') THEN
        ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_folderId_fkey" 
        FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folder_permissions_userId_fkey') THEN
        ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Time Off Requests
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_off_requests_employeePositionId_fkey') THEN
        ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employeePositionId_fkey" 
        FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_off_requests_businessId_fkey') THEN
        ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Attendance
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_policies_businessId_fkey') THEN
        ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_shift_templates_policyId_fkey') THEN
        ALTER TABLE "attendance_shift_templates" ADD CONSTRAINT "attendance_shift_templates_policyId_fkey" 
        FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_shift_templates_businessId_fkey') THEN
        ALTER TABLE "attendance_shift_templates" ADD CONSTRAINT "attendance_shift_templates_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_shift_assignments_employeePositionId_fkey') THEN
        ALTER TABLE "attendance_shift_assignments" ADD CONSTRAINT "attendance_shift_assignments_employeePositionId_fkey" 
        FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_shift_assignments_shiftTemplateId_fkey') THEN
        ALTER TABLE "attendance_shift_assignments" ADD CONSTRAINT "attendance_shift_assignments_shiftTemplateId_fkey" 
        FOREIGN KEY ("shiftTemplateId") REFERENCES "attendance_shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_shift_assignments_businessId_fkey') THEN
        ALTER TABLE "attendance_shift_assignments" ADD CONSTRAINT "attendance_shift_assignments_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_employeePositionId_fkey') THEN
        ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeePositionId_fkey" 
        FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_businessId_fkey') THEN
        ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_policyId_fkey') THEN
        ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_policyId_fkey" 
        FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_shiftAssignmentId_fkey') THEN
        ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shiftAssignmentId_fkey" 
        FOREIGN KEY ("shiftAssignmentId") REFERENCES "attendance_shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_exceptions_attendanceRecordId_fkey') THEN
        ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_attendanceRecordId_fkey" 
        FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_exceptions_employeePositionId_fkey') THEN
        ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_employeePositionId_fkey" 
        FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_exceptions_businessId_fkey') THEN
        ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_exceptions_policyId_fkey') THEN
        ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_policyId_fkey" 
        FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Scheduling
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_businessId_fkey') THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_locationId_fkey') THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_locationId_fkey" 
        FOREIGN KEY ("locationId") REFERENCES "job_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_createdById_fkey') THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_createdById_fkey" 
        FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_publishedById_fkey') THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_publishedById_fkey" 
        FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_shifts_businessId_fkey') THEN
        ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_shifts_scheduleId_fkey') THEN
        ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_scheduleId_fkey" 
        FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_shifts_employeePositionId_fkey') THEN
        ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_employeePositionId_fkey" 
        FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_shifts_positionId_fkey') THEN
        ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_positionId_fkey" 
        FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_shifts_locationId_fkey') THEN
        ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_locationId_fkey" 
        FOREIGN KEY ("locationId") REFERENCES "job_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_shifts_shiftTemplateId_fkey') THEN
        ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_shiftTemplateId_fkey" 
        FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_templates_businessId_fkey') THEN
        ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_templates_positionId_fkey') THEN
        ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_positionId_fkey" 
        FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_templates_businessId_fkey') THEN
        ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_availability_businessId_fkey') THEN
        ALTER TABLE "employee_availability" ADD CONSTRAINT "employee_availability_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_availability_employeePositionId_fkey') THEN
        ALTER TABLE "employee_availability" ADD CONSTRAINT "employee_availability_employeePositionId_fkey" 
        FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_swap_requests_businessId_fkey') THEN
        ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_swap_requests_originalShiftId_fkey') THEN
        ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_originalShiftId_fkey" 
        FOREIGN KEY ("originalShiftId") REFERENCES "schedule_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_swap_requests_requestedById_fkey') THEN
        ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requestedById_fkey" 
        FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_locations_businessId_fkey') THEN
        ALTER TABLE "job_locations" ADD CONSTRAINT "job_locations_businessId_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Tasks
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assignedToId_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" 
        FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_createdById_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" 
        FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_parentTaskId_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey" 
        FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_parentRecurringTaskId_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentRecurringTaskId_fkey" 
        FOREIGN KEY ("parentRecurringTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_projectId_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "task_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_dependencies_taskId_fkey') THEN
        ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_taskId_fkey" 
        FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_dependencies_dependsOnTaskId_fkey') THEN
        ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_dependsOnTaskId_fkey" 
        FOREIGN KEY ("dependsOnTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_attachments_taskId_fkey') THEN
        ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_taskId_fkey" 
        FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_comments_taskId_fkey') THEN
        ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" 
        FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_comments_userId_fkey') THEN
        ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_watchers_taskId_fkey') THEN
        ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_taskId_fkey" 
        FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_watchers_userId_fkey') THEN
        ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_time_logs_taskId_fkey') THEN
        ALTER TABLE "task_time_logs" ADD CONSTRAINT "task_time_logs_taskId_fkey" 
        FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_time_logs_userId_fkey') THEN
        ALTER TABLE "task_time_logs" ADD CONSTRAINT "task_time_logs_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Notification table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notification' AND column_name = 'priority') THEN
        ALTER TABLE "Notification" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 50;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notification' AND column_name = 'snoozedUntil') THEN
        ALTER TABLE "Notification" ADD COLUMN "snoozedUntil" TIMESTAMP(3);
    END IF;
END $$;

-- AI Autonomy Settings
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_autonomy_settings' AND column_name = 'workHoursStart') THEN
        ALTER TABLE "ai_autonomy_settings" ADD COLUMN "workHoursStart" TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_autonomy_settings' AND column_name = 'workHoursEnd') THEN
        ALTER TABLE "ai_autonomy_settings" ADD COLUMN "workHoursEnd" TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_autonomy_settings' AND column_name = 'familyTimeStart') THEN
        ALTER TABLE "ai_autonomy_settings" ADD COLUMN "familyTimeStart" TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_autonomy_settings' AND column_name = 'familyTimeEnd') THEN
        ALTER TABLE "ai_autonomy_settings" ADD COLUMN "familyTimeEnd" TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_autonomy_settings' AND column_name = 'sleepHoursStart') THEN
        ALTER TABLE "ai_autonomy_settings" ADD COLUMN "sleepHoursStart" TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_autonomy_settings' AND column_name = 'sleepHoursEnd') THEN
        ALTER TABLE "ai_autonomy_settings" ADD COLUMN "sleepHoursEnd" TEXT;
    END IF;
END $$;

-- User AI Context
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_ai_context' AND column_name = 'tags') THEN
        ALTER TABLE "user_ai_context" ADD COLUMN "tags" TEXT[];
    END IF;
END $$;

-- User AI Context Cache
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_ai_context_cache_userId_idx') THEN
        CREATE INDEX "user_ai_context_cache_userId_idx" ON "user_ai_context_cache"("userId");
    END IF;
END $$;
