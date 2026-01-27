-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "HouseholdType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'ADMIN', 'ADULT', 'TEEN', 'CHILD', 'TEMPORARY_GUEST');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP', 'CHANNEL');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'FILE', 'SYSTEM', 'REACTION');

-- CreateEnum
CREATE TYPE "ThreadType" AS ENUM ('MESSAGE', 'TOPIC', 'PROJECT', 'DECISION', 'DOCUMENTATION');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "BusinessRole" AS ENUM ('EMPLOYEE', 'ADMIN', 'MANAGER');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('UNIVERSITY', 'COLLEGE', 'HIGH_SCHOOL', 'ELEMENTARY_SCHOOL');

-- CreateEnum
CREATE TYPE "InstitutionRole" AS ENUM ('STUDENT', 'FACULTY', 'STAFF');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('REGULAR', 'COLLEAGUE');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ModuleCategory" AS ENUM ('PRODUCTIVITY', 'COMMUNICATION', 'ANALYTICS', 'DEVELOPMENT', 'ENTERTAINMENT', 'EDUCATION', 'FINANCE', 'HEALTH', 'OTHER');

-- CreateEnum
CREATE TYPE "AIRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "AIInteractionType" AS ENUM ('QUERY', 'ACTION_REQUEST', 'LEARNING', 'FEEDBACK', 'CORRECTION');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('LOCAL', 'EXTERNAL', 'RESOURCE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "CalendarContextType" AS ENUM ('PERSONAL', 'BUSINESS', 'HOUSEHOLD');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReminderMethod" AS ENUM ('APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "SchedulingMode" AS ENUM ('RESTAURANT', 'HEALTHCARE', 'RETAIL', 'MANUFACTURING', 'OFFICE', 'COFFEE_SHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "SchedulingStrategy" AS ENUM ('AVAILABILITY_FIRST', 'BUDGET_FIRST', 'COMPLIANCE_FIRST', 'TEMPLATE_BASED', 'AUTO_GENERATE');

-- CreateEnum
CREATE TYPE "JobFunction" AS ENUM ('GRILL', 'FRY', 'PREP', 'PIZZA', 'PANTRY', 'DISH', 'LINE_COOK', 'EXPO', 'COOK', 'CHEF', 'SERVER', 'HOST', 'RUNNER', 'BARTENDER', 'CASHIER', 'BARISTA', 'MANAGER_ON_DUTY', 'SHIFT_LEAD', 'SUPERVISOR', 'NURSE', 'CNA', 'TECH', 'DOCTOR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StationType" AS ENUM ('BOH', 'FOH', 'MANAGEMENT', 'HEALTHCARE', 'MANUFACTURING', 'OTHER');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('debug', 'info', 'warn', 'error');

-- CreateEnum
CREATE TYPE "LogService" AS ENUM ('vssyl_server', 'vssyl_web');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LiveChatStatus" AS ENUM ('WAITING', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "TimeOffType" AS ENUM ('PTO', 'SICK', 'PERSONAL', 'UNPAID');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AttendanceShiftAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "AttendanceRecordStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'MISSED', 'VOID');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('WEB', 'MOBILE', 'ADMIN', 'AUTO', 'HARDWARE');

-- CreateEnum
CREATE TYPE "AttendanceExceptionType" AS ENUM ('MISSED_PUNCH', 'LATE_ARRIVAL', 'EARLY_DEPARTURE', 'ABSENCE', 'GEO_VIOLATION', 'POLICY_OVERRIDE', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY', 'SEASONAL');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'TERMINATED', 'LEAVE', 'SABBATICAL');

-- CreateEnum
CREATE TYPE "OnboardingTaskType" AS ENUM ('DOCUMENT', 'EQUIPMENT', 'TRAINING', 'MEETING', 'FORM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OnboardingTaskOwnerType" AS ENUM ('EMPLOYEE', 'MANAGER', 'HR', 'BUDDY', 'IT', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingJourneyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'OPEN', 'FILLED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'PREFERRED');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "user_profile_photos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "crop" JSONB,
    "rotation" INTEGER,
    "trashedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "personalPhoto" TEXT,
    "businessPhoto" TEXT,
    "personalPhotoId" TEXT,
    "businessPhotoId" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userNumber" TEXT,
    "countryId" TEXT,
    "regionId" TEXT,
    "townId" TEXT,
    "locationDetectedAt" TIMESTAMP(3),
    "locationUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
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
    "allowCollectiveLearning" BOOLEAN NOT NULL DEFAULT false,
    "dataRetentionPeriod" INTEGER NOT NULL DEFAULT 2555,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "towns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "towns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_serials" (
    "id" TEXT NOT NULL,
    "townId" TEXT NOT NULL,
    "lastSerial" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
    "dashboardId" TEXT,
    "trashedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "threadId" TEXT,
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_references" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "read_receipts" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threads" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "name" TEXT,
    "type" "ThreadType" NOT NULL DEFAULT 'MESSAGE',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_participants" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "thread_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ein" TEXT NOT NULL,
    "einVerified" BOOLEAN NOT NULL DEFAULT false,
    "industry" TEXT,
    "size" TEXT,
    "website" TEXT,
    "address" JSONB,
    "phone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "description" TEXT,
    "branding" JSONB,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "billingEmail" TEXT,
    "billingAddress" JSONB,
    "taxId" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aiSettings" JSONB,
    "schedulingMode" "SchedulingMode",
    "schedulingStrategy" "SchedulingStrategy",
    "schedulingConfig" JSONB,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentDepartmentId" TEXT,
    "headPositionId" TEXT,
    "departmentModules" JSONB,
    "departmentPermissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "departmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_members" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BusinessRole" NOT NULL DEFAULT 'EMPLOYEE',
    "title" TEXT,
    "department" TEXT,
    "jobId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canInvite" BOOLEAN NOT NULL DEFAULT false,
    "canManage" BOOLEAN NOT NULL DEFAULT false,
    "canBilling" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_invitations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "BusinessRole" NOT NULL DEFAULT 'EMPLOYEE',
    "title" TEXT,
    "department" TEXT,
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educational_institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InstitutionType" NOT NULL DEFAULT 'UNIVERSITY',
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logo" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educational_institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_members" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "InstitutionRole" NOT NULL DEFAULT 'STUDENT',
    "title" TEXT,
    "department" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canInvite" BOOLEAN NOT NULL DEFAULT false,
    "canManage" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "institution_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_invitations" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "InstitutionRole" NOT NULL DEFAULT 'STUDENT',
    "title" TEXT,
    "department" TEXT,
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "type" "RelationshipType" NOT NULL DEFAULT 'REGULAR',
    "organizationId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_follows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" JSONB,
    "preferences" JSONB,
    "trashedAt" TIMESTAMP(3),
    "businessId" TEXT,
    "institutionId" TEXT,
    "householdId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "messageRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "autoDeleteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "fileRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceSettings" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "complianceMode" TEXT NOT NULL DEFAULT 'standard',
    "encryptionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "auditLoggingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dataResidency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Widget" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB,
    "position" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_front_page_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "layout" JSONB,
    "theme" JSONB,
    "showAIAssistant" BOOLEAN NOT NULL DEFAULT true,
    "showCompanyStats" BOOLEAN NOT NULL DEFAULT true,
    "showPersonalStats" BOOLEAN NOT NULL DEFAULT true,
    "showRecentActivity" BOOLEAN NOT NULL DEFAULT true,
    "showQuickActions" BOOLEAN NOT NULL DEFAULT true,
    "showAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "showUpcomingEvents" BOOLEAN NOT NULL DEFAULT true,
    "showTeamHighlights" BOOLEAN NOT NULL DEFAULT false,
    "showMetrics" BOOLEAN NOT NULL DEFAULT true,
    "showTasks" BOOLEAN NOT NULL DEFAULT true,
    "welcomeMessage" TEXT,
    "heroImage" TEXT,
    "companyAnnouncements" JSONB,
    "quickLinks" JSONB,
    "allowUserCustomization" BOOLEAN NOT NULL DEFAULT false,
    "userCustomizableWidgets" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "business_front_page_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_front_widgets" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" JSONB NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB,
    "requiredPermission" TEXT,
    "visibleToRoles" JSONB,
    "visibleToTiers" JSONB,
    "visibleToPositions" JSONB,
    "visibleToDepartments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_front_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_front_page_customizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "hiddenWidgets" JSONB,
    "widgetPositions" JSONB,
    "customSettings" JSONB,
    "preferredView" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_front_page_customizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "HouseholdType" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
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
    "pricingTier" TEXT NOT NULL DEFAULT 'free',
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enterprisePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isProprietary" BOOLEAN NOT NULL DEFAULT false,
    "revenueSplit" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "totalLifetimeRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "smallBusinessEligible" BOOLEAN NOT NULL DEFAULT false,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
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
    "cachedContext" JSONB,
    "contextCachedAt" TIMESTAMP(3),

    CONSTRAINT "module_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_module_installations" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "installedBy" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configured" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "business_module_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_module_subscriptions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_module_subscriptions_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "organizational_tiers" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT,
    "defaultPermissions" JSONB,
    "defaultModules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizational_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "departmentId" TEXT,
    "reportsToId" TEXT,
    "permissions" JSONB,
    "assignedModules" JSONB,
    "maxOccupants" INTEGER NOT NULL DEFAULT 1,
    "customPermissions" JSONB,
    "jobFunction" "JobFunction",
    "stationName" TEXT,
    "stationType" "StationType",
    "canWorkMultipleStations" BOOLEAN NOT NULL DEFAULT false,
    "isStationRequired" BOOLEAN NOT NULL DEFAULT false,
    "schedulingPriority" INTEGER,
    "defaultStartTime" TEXT,
    "defaultEndTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dependencies" JSONB,
    "conflicts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_sets" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "template" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "customPermissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_management_rights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" JSONB NOT NULL,
    "canGrantToOthers" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_management_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_changes" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeType" TEXT NOT NULL,
    "targetRole" TEXT,
    "permissionsChanged" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_personality_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalityData" JSONB NOT NULL,
    "learningHistory" JSONB[],
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_personality_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_autonomy_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduling" INTEGER NOT NULL DEFAULT 30,
    "communication" INTEGER NOT NULL DEFAULT 20,
    "fileManagement" INTEGER NOT NULL DEFAULT 40,
    "taskCreation" INTEGER NOT NULL DEFAULT 30,
    "dataAnalysis" INTEGER NOT NULL DEFAULT 60,
    "crossModuleActions" INTEGER NOT NULL DEFAULT 20,
    "workHoursOverride" BOOLEAN NOT NULL DEFAULT false,
    "workHoursStart" TEXT,
    "workHoursEnd" TEXT,
    "familyTimeOverride" BOOLEAN NOT NULL DEFAULT false,
    "familyTimeStart" TEXT,
    "familyTimeEnd" TEXT,
    "sleepHoursOverride" BOOLEAN NOT NULL DEFAULT false,
    "sleepHoursStart" TEXT,
    "sleepHoursEnd" TEXT,
    "financialThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeCommitmentThreshold" INTEGER NOT NULL DEFAULT 60,
    "peopleAffectedThreshold" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_autonomy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_approval_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "actionData" JSONB NOT NULL,
    "affectedUsers" TEXT[],
    "reasoning" TEXT NOT NULL,
    "status" "AIRequestStatus" NOT NULL DEFAULT 'PENDING',
    "responses" JSONB[],
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "interactionType" "AIInteractionType" NOT NULL,
    "userQuery" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "aiResponse" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "reasoning" TEXT,
    "actions" JSONB[],
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processingTime" INTEGER NOT NULL DEFAULT 0,
    "userFeedback" TEXT,
    "feedbackRating" INTEGER,
    "correctionApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_tracking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "queryInteractions" INTEGER NOT NULL DEFAULT 0,
    "actionRequests" INTEGER NOT NULL DEFAULT 0,
    "approvalsRequested" INTEGER NOT NULL DEFAULT 0,
    "approvalsGranted" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openaiCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anthropicCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userSatisfaction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "crossModuleQueries" INTEGER NOT NULL DEFAULT 0,
    "personalityLearning" INTEGER NOT NULL DEFAULT 0,
    "proactiveInsights" INTEGER NOT NULL DEFAULT 0,
    "autonomousActions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_learning_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "sourceModule" TEXT,
    "sourceModuleVersion" TEXT,
    "moduleActive" BOOLEAN NOT NULL DEFAULT true,
    "moduleSpecificData" JSONB,
    "oldBehavior" TEXT,
    "newBehavior" TEXT NOT NULL,
    "userFeedback" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "patternData" JSONB,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_learning_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "sourceModule" TEXT,
    "moduleCategory" TEXT,
    "patternData" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "impact" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_patterns" (
    "id" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "modules" TEXT[],
    "primaryModule" TEXT,
    "moduleCategory" TEXT,
    "userSegment" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "recommendations" TEXT[],
    "dataPoints" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trend" TEXT NOT NULL,
    "privacyLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collective_insights" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "impact" TEXT NOT NULL,
    "affectedModules" TEXT[],
    "affectedUserSegments" TEXT[],
    "actionable" BOOLEAN NOT NULL,
    "recommendations" TEXT[],
    "implementationComplexity" TEXT NOT NULL,
    "estimatedBenefit" DOUBLE PRECISION NOT NULL,
    "dataPoints" INTEGER NOT NULL,
    "lastValidated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collective_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configuration" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_configuration_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "trafficSplit" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "targetAudience" JSONB,
    "successMetrics" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_variants" (
    "id" TEXT NOT NULL,
    "abTestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "trafficWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_results" (
    "id" TEXT NOT NULL,
    "abTestId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "triggers" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "variables" JSONB NOT NULL,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "modelType" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "performance" JSONB,
    "metadata" JSONB,
    "artifacts" JSONB,
    "trainingData" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_versions" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "performance" JSONB,
    "artifacts" JSONB,
    "trainingMetrics" JSONB,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_deployments" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "endpoint" TEXT,
    "config" JSONB,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "ai_model_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_experiments" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "results" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_model_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_ab_tests" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "variants" TEXT[],
    "trafficSplit" JSONB NOT NULL,
    "metrics" TEXT[],
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "results" JSONB,

    CONSTRAINT "model_ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ai_context" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "moduleId" TEXT,
    "contextType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automl_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "dataset" JSONB NOT NULL,
    "task" TEXT NOT NULL,
    "algorithms" TEXT[],
    "hyperparameters" JSONB,
    "constraints" JSONB,
    "results" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "automl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automl_trials" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "trialNumber" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "hyperparameters" JSONB NOT NULL,
    "performance" JSONB,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "automl_trials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_streams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_points" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "data_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stream_processors" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stream_processors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_time_metrics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "tags" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_time_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_time_alerts" (
    "id" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "real_time_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_dashboards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "config" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "position" JSONB NOT NULL,
    "dataSource" TEXT,
    "refreshInterval" INTEGER,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasting_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modelType" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "performance" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecasting_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "horizon" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "data" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_detection_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modelType" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "performance" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anomaly_detection_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomalies" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_metrics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "target" DOUBLE PRECISION,
    "trend" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_dashboards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "config" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_discoveries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "patternType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "data" JSONB NOT NULL,
    "metadata" JSONB,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_discoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligent_insights" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "impact" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligent_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "effort" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
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

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_ai_digital_twins" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Business AI Assistant',
    "description" TEXT,
    "aiPersonality" JSONB NOT NULL,
    "capabilities" JSONB NOT NULL,
    "restrictions" JSONB NOT NULL,
    "trainingData" JSONB,
    "learningSettings" JSONB NOT NULL,
    "performanceMetrics" JSONB,
    "securityLevel" TEXT NOT NULL DEFAULT 'standard',
    "complianceMode" BOOLEAN NOT NULL DEFAULT false,
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "auditSettings" JSONB NOT NULL,
    "encryptionRequired" BOOLEAN NOT NULL DEFAULT true,
    "adminUsers" TEXT[],
    "delegatedAdmins" TEXT[],
    "allowEmployeeInteraction" BOOLEAN NOT NULL DEFAULT true,
    "allowCentralizedLearning" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastTrainingAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3),
    "lastCentralizedLearningAt" TIMESTAMP(3),
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_ai_digital_twins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_ai_interactions" (
    "id" TEXT NOT NULL,
    "businessAIId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "userInput" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "processingTime" INTEGER NOT NULL DEFAULT 0,
    "contextData" JSONB NOT NULL,
    "moduleContext" TEXT,
    "userRole" TEXT,
    "departmentId" TEXT,
    "securityLevel" TEXT NOT NULL,
    "complianceFlags" JSONB,
    "auditMetadata" JSONB,
    "dataClassification" TEXT NOT NULL DEFAULT 'internal',
    "userFeedback" TEXT,
    "feedbackRating" INTEGER,
    "wasHelpful" BOOLEAN,
    "correctionApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_ai_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_ai_learning_events" (
    "id" TEXT NOT NULL,
    "businessAIId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceUserId" TEXT,
    "sourceType" TEXT NOT NULL,
    "learningData" JSONB NOT NULL,
    "previousBehavior" TEXT,
    "newBehavior" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "privacyLevel" TEXT NOT NULL DEFAULT 'internal',
    "dataClassification" TEXT NOT NULL DEFAULT 'business_process',
    "complianceReview" BOOLEAN NOT NULL DEFAULT false,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "effectiveness" DOUBLE PRECISION,
    "rollbackAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_ai_learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_ai_usage_metrics" (
    "id" TEXT NOT NULL,
    "businessAIId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TEXT NOT NULL,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "averageResponseTime" INTEGER NOT NULL DEFAULT 0,
    "averageConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "averageUserRating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "queryInteractions" INTEGER NOT NULL DEFAULT 0,
    "commandExecutions" INTEGER NOT NULL DEFAULT 0,
    "analysisRequests" INTEGER NOT NULL DEFAULT 0,
    "trainingEvents" INTEGER NOT NULL DEFAULT 0,
    "successfulResponses" INTEGER NOT NULL DEFAULT 0,
    "failedResponses" INTEGER NOT NULL DEFAULT 0,
    "timeoutResponses" INTEGER NOT NULL DEFAULT 0,
    "userCorrections" INTEGER NOT NULL DEFAULT 0,
    "departmentUsage" JSONB,
    "roleUsage" JSONB,
    "moduleUsage" JSONB,
    "learningEventsGenerated" INTEGER NOT NULL DEFAULT 0,
    "learningEventsApproved" INTEGER NOT NULL DEFAULT 0,
    "learningEventsApplied" INTEGER NOT NULL DEFAULT 0,
    "knowledgeBaseGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_ai_usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_ai_context_registry" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT[],
    "patterns" TEXT[],
    "concepts" TEXT[],
    "entities" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "contextProviders" JSONB NOT NULL,
    "queryableData" JSONB,
    "relationships" JSONB,
    "fullAIContext" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_ai_context_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ai_context_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cachedContext" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_ai_context_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_ai_performance_metrics" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "successfulQueries" INTEGER NOT NULL DEFAULT 0,
    "failedQueries" INTEGER NOT NULL DEFAULT 0,
    "averageLatency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contextFetchCount" INTEGER NOT NULL DEFAULT 0,
    "contextFetchErrors" INTEGER NOT NULL DEFAULT 0,
    "averageContextSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheHitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positiveRatings" INTEGER NOT NULL DEFAULT 0,
    "negativeRatings" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "learningEventsGenerated" INTEGER NOT NULL DEFAULT 0,
    "patternsContributed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_ai_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_query_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "baseAllowance" INTEGER NOT NULL DEFAULT 0,
    "baseAllowanceUsed" INTEGER NOT NULL DEFAULT 0,
    "purchasedQueries" INTEGER NOT NULL DEFAULT 0,
    "purchasedQueriesUsed" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "queriesRolledOver" INTEGER NOT NULL DEFAULT 0,
    "monthlySpendingLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPeriodSpending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overageQueriesUsed" INTEGER NOT NULL DEFAULT 0,
    "overageQueriesCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_query_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_query_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "balanceId" TEXT,
    "packType" TEXT NOT NULL,
    "queriesAmount" INTEGER NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_query_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_configs" (
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

-- CreateTable
CREATE TABLE "price_changes" (
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

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "stripeMetadata" JSONB,
    "employeeCount" INTEGER,
    "includedEmployees" INTEGER,
    "additionalEmployeeCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "moduleId" TEXT NOT NULL,
    "coreSubscriptionId" TEXT,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "platformRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "developerRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "moduleSubscriptionId" TEXT,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "moduleSubscriptionId" TEXT,
    "businessId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeChargeId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeFee" DOUBLE PRECISION,
    "stripeNetAmount" DOUBLE PRECISION,
    "refundAmount" DOUBLE PRECISION DEFAULT 0,
    "refundCount" INTEGER DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "stripeMetadata" JSONB,
    "userId" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "stripeRefundId" TEXT,
    "stripeChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_revenue" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL,
    "platformRevenue" DOUBLE PRECISION NOT NULL,
    "developerRevenue" DOUBLE PRECISION NOT NULL,
    "payoutStatus" TEXT NOT NULL DEFAULT 'pending',
    "payoutDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionType" TEXT NOT NULL,
    "subscriptionAgeMonths" INTEGER NOT NULL,
    "isFirstYear" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "developer_revenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "type" "CalendarType" NOT NULL DEFAULT 'LOCAL',
    "contextType" "CalendarContextType" NOT NULL,
    "contextId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDeletable" BOOLEAN NOT NULL DEFAULT true,
    "defaultReminderMinutes" INTEGER NOT NULL DEFAULT 10,
    "visibility" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_members" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "onlineMeetingLink" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "EventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "recurrenceRule" TEXT,
    "recurrenceEndAt" TIMESTAMP(3),
    "parentEventId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trashedAt" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendees" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "response" TEXT,

    CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "method" "ReminderMethod" NOT NULL DEFAULT 'APP',
    "minutesBefore" INTEGER NOT NULL DEFAULT 10,
    "dispatchedAt" TIMESTAMP(3),

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attachments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "driveFileId" TEXT,
    "externalUrl" TEXT,

    CONSTRAINT "event_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_comments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvp_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rsvp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "folderId" TEXT,
    "dashboardId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trashedAt" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "dashboardId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trashedAt" TIMESTAMP(3),

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_permissions" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_permissions" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "action" TEXT,
    "details" TEXT,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "configValue" JSONB NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "adminId" TEXT,
    "adminEmail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "severity" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_impersonations" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "businessId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "context" TEXT,
    "sessionTokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "admin_impersonations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "details" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "adminImpersonationId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "policy_violations" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_violations_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "service" "LogService" NOT NULL,
    "operation" VARCHAR(255),
    "userId" TEXT,
    "businessId" TEXT,
    "module" VARCHAR(100),
    "metadata" JSONB,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "requestId" VARCHAR(100),
    "duration" INTEGER,
    "statusCode" INTEGER,
    "errorStack" TEXT,
    "environment" VARCHAR(50) NOT NULL DEFAULT 'production',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_alerts" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggered" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
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
    "lastCleanup" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_sessions" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sso_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_frameworks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "controls" JSONB NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "affectedUsers" INTEGER,
    "data" JSONB NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "reportedBy" TEXT,

    CONSTRAINT "security_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audits" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "recommendations" TEXT[],
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "auditor" TEXT,

    CONSTRAINT "security_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "customerId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "responseTime" DOUBLE PRECISION,
    "resolutionTime" DOUBLE PRECISION,
    "satisfaction" INTEGER,
    "views" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "isFromCustomer" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_attachments" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "ticketId" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "authorId" TEXT NOT NULL,
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'DRAFT',
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "notHelpful" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "knowledge_base_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_chat_sessions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agentId" TEXT,
    "status" "LiveChatStatus" NOT NULL DEFAULT 'WAITING',
    "subject" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "satisfaction" INTEGER,

    CONSTRAINT "live_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isFromCustomer" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_analytics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ticketsCreated" INTEGER NOT NULL DEFAULT 0,
    "ticketsResolved" INTEGER NOT NULL DEFAULT 0,
    "ticketsClosed" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "avgResolutionTime" DOUBLE PRECISION,
    "avgSatisfaction" DOUBLE PRECISION,
    "satisfactionCount" INTEGER NOT NULL DEFAULT 0,
    "chatSessions" INTEGER NOT NULL DEFAULT 0,
    "avgChatDuration" DOUBLE PRECISION,
    "articleViews" INTEGER NOT NULL DEFAULT 0,
    "articleHelpful" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "support_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off_requests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "type" "TimeOffType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "managerNote" TEXT,
    "scheduleEventId" TEXT,
    "personalEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_off_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_policies" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "timezone" TEXT,
    "roundingIncrementMinutes" INTEGER,
    "gracePeriodMinutes" INTEGER,
    "autoClockOutAfterMinutes" INTEGER,
    "requireGeolocation" BOOLEAN NOT NULL DEFAULT false,
    "geofenceRadiusMeters" INTEGER,
    "workingDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_shift_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "timezone" TEXT,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "breakMinutes" INTEGER,
    "daysOfWeek" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policyId" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_shift_assignments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "AttendanceShiftAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "overrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "shiftAssignmentId" TEXT,
    "policyId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "clockInTime" TIMESTAMP(3),
    "clockInMethod" "AttendanceMethod",
    "clockInLocation" JSONB,
    "clockInSource" TEXT,
    "clockOutTime" TIMESTAMP(3),
    "clockOutMethod" "AttendanceMethod",
    "clockOutLocation" JSONB,
    "clockOutSource" TEXT,
    "status" "AttendanceRecordStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "durationMinutes" INTEGER,
    "varianceMinutes" INTEGER,
    "metadata" JSONB,
    "exceptionFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_exceptions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "attendanceRecordId" TEXT,
    "employeePositionId" TEXT NOT NULL,
    "policyId" TEXT,
    "type" "AttendanceExceptionType" NOT NULL,
    "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedById" TEXT,
    "detectedSource" TEXT,
    "details" JSONB,
    "managerNote" TEXT,
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionPayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_hr_profiles" (
    "id" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "terminationReason" TEXT,
    "terminatedBy" TEXT,
    "terminationNotes" JSONB,
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

-- CreateTable
CREATE TABLE "manager_approval_hierarchy" (
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

-- CreateTable
CREATE TABLE "hr_module_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "timeOffSettings" JSONB,
    "scheduleCalendarId" TEXT,
    "workWeekSettings" JSONB,
    "payrollSettings" JSONB,
    "enabledFeatures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_module_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_onboarding_templates" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_onboarding_task_templates" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_onboarding_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_onboarding_journeys" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_employee_onboarding_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_onboarding_tasks" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_employee_onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "locationId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "templateId" TEXT,
    "layoutMode" TEXT,
    "viewMode" TEXT,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_shifts" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeePositionId" TEXT,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER,
    "locationId" TEXT,
    "departmentId" TEXT,
    "positionId" TEXT,
    "stationName" TEXT,
    "jobFunction" TEXT,
    "notes" TEXT,
    "color" TEXT,
    "isOpenShift" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "minStaffing" INTEGER,
    "maxStaffing" INTEGER,
    "priority" INTEGER,
    "shiftTemplateId" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultStartTime" TEXT NOT NULL,
    "defaultEndTime" TEXT NOT NULL,
    "defaultBreakMinutes" INTEGER,
    "daysOfWeek" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "departmentId" TEXT,
    "positionId" TEXT,
    "color" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_availability" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeePositionId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "availabilityType" "AvailabilityType" NOT NULL DEFAULT 'AVAILABLE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_swap_requests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "originalShiftId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedToId" TEXT,
    "reason" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scheduleType" TEXT NOT NULL,
    "templateData" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_stations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stationType" "StationType" NOT NULL,
    "jobFunction" "JobFunction",
    "description" TEXT,
    "color" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultStartTime" TEXT,
    "defaultEndTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_locations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dashboardId" TEXT NOT NULL,
    "businessId" TEXT,
    "householdId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "projectId" TEXT,
    "parentTaskId" TEXT,
    "recurrenceRule" TEXT,
    "recurrenceEndAt" TIMESTAMP(3),
    "parentRecurringTaskId" TEXT,
    "tags" TEXT[],
    "category" TEXT,
    "timeEstimate" INTEGER,
    "actualTimeSpent" INTEGER,
    "trashedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileId" TEXT,
    "url" TEXT,
    "name" TEXT NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_file_links" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "task_file_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_event_links" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "task_event_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_watchers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dashboardId" TEXT NOT NULL,
    "businessId" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_time_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PermissionSetToPosition" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PermissionSetToPosition_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "user_profile_photos_userId_idx" ON "user_profile_photos"("userId");

-- CreateIndex
CREATE INDEX "user_profile_photos_trashedAt_idx" ON "user_profile_photos"("trashedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_personalPhotoId_key" ON "users"("personalPhotoId");

-- CreateIndex
CREATE UNIQUE INDEX "users_businessPhotoId_key" ON "users"("businessPhotoId");

-- CreateIndex
CREATE UNIQUE INDEX "users_userNumber_key" ON "users"("userNumber");

-- CreateIndex
CREATE INDEX "users_userNumber_idx" ON "users"("userNumber");

-- CreateIndex
CREATE INDEX "users_countryId_regionId_townId_idx" ON "users"("countryId", "regionId", "townId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");

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
CREATE UNIQUE INDEX "countries_phoneCode_key" ON "countries"("phoneCode");

-- CreateIndex
CREATE UNIQUE INDEX "regions_countryId_code_key" ON "regions"("countryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "towns_regionId_code_key" ON "towns"("regionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "user_serials_townId_key" ON "user_serials"("townId");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- CreateIndex
CREATE INDEX "conversations_dashboardId_idx" ON "conversations"("dashboardId");

-- CreateIndex
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");

-- CreateIndex
CREATE INDEX "conversation_participants_conversationId_idx" ON "conversation_participants"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_key" ON "conversation_participants"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_threadId_idx" ON "messages"("threadId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "file_references_messageId_idx" ON "file_references"("messageId");

-- CreateIndex
CREATE INDEX "file_references_fileId_idx" ON "file_references"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "file_references_messageId_fileId_key" ON "file_references"("messageId", "fileId");

-- CreateIndex
CREATE INDEX "message_reactions_messageId_idx" ON "message_reactions"("messageId");

-- CreateIndex
CREATE INDEX "message_reactions_userId_idx" ON "message_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_messageId_userId_emoji_key" ON "message_reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "read_receipts_messageId_idx" ON "read_receipts"("messageId");

-- CreateIndex
CREATE INDEX "read_receipts_userId_idx" ON "read_receipts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "read_receipts_messageId_userId_key" ON "read_receipts"("messageId", "userId");

-- CreateIndex
CREATE INDEX "threads_conversationId_idx" ON "threads"("conversationId");

-- CreateIndex
CREATE INDEX "threads_parentId_idx" ON "threads"("parentId");

-- CreateIndex
CREATE INDEX "threads_type_idx" ON "threads"("type");

-- CreateIndex
CREATE INDEX "thread_participants_threadId_idx" ON "thread_participants"("threadId");

-- CreateIndex
CREATE INDEX "thread_participants_userId_idx" ON "thread_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "thread_participants_threadId_userId_key" ON "thread_participants"("threadId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_ein_key" ON "businesses"("ein");

-- CreateIndex
CREATE INDEX "businesses_ein_idx" ON "businesses"("ein");

-- CreateIndex
CREATE INDEX "businesses_schedulingMode_idx" ON "businesses"("schedulingMode");

-- CreateIndex
CREATE INDEX "departments_businessId_idx" ON "departments"("businessId");

-- CreateIndex
CREATE INDEX "departments_parentDepartmentId_idx" ON "departments"("parentDepartmentId");

-- CreateIndex
CREATE INDEX "departments_headPositionId_idx" ON "departments"("headPositionId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_businessId_name_key" ON "departments"("businessId", "name");

-- CreateIndex
CREATE INDEX "jobs_businessId_idx" ON "jobs"("businessId");

-- CreateIndex
CREATE INDEX "jobs_departmentId_idx" ON "jobs"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_businessId_title_key" ON "jobs"("businessId", "title");

-- CreateIndex
CREATE INDEX "sso_configs_businessId_idx" ON "sso_configs"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "sso_configs_businessId_provider_key" ON "sso_configs"("businessId", "provider");

-- CreateIndex
CREATE INDEX "business_members_businessId_idx" ON "business_members"("businessId");

-- CreateIndex
CREATE INDEX "business_members_userId_idx" ON "business_members"("userId");

-- CreateIndex
CREATE INDEX "business_members_jobId_idx" ON "business_members"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "business_members_businessId_userId_key" ON "business_members"("businessId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "business_invitations_token_key" ON "business_invitations"("token");

-- CreateIndex
CREATE INDEX "business_invitations_businessId_idx" ON "business_invitations"("businessId");

-- CreateIndex
CREATE INDEX "business_invitations_email_idx" ON "business_invitations"("email");

-- CreateIndex
CREATE INDEX "business_invitations_token_idx" ON "business_invitations"("token");

-- CreateIndex
CREATE INDEX "institution_members_institutionId_idx" ON "institution_members"("institutionId");

-- CreateIndex
CREATE INDEX "institution_members_userId_idx" ON "institution_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "institution_members_institutionId_userId_key" ON "institution_members"("institutionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "institution_invitations_token_key" ON "institution_invitations"("token");

-- CreateIndex
CREATE INDEX "institution_invitations_institutionId_idx" ON "institution_invitations"("institutionId");

-- CreateIndex
CREATE INDEX "institution_invitations_email_idx" ON "institution_invitations"("email");

-- CreateIndex
CREATE INDEX "institution_invitations_token_idx" ON "institution_invitations"("token");

-- CreateIndex
CREATE INDEX "relationships_senderId_idx" ON "relationships"("senderId");

-- CreateIndex
CREATE INDEX "relationships_receiverId_idx" ON "relationships"("receiverId");

-- CreateIndex
CREATE INDEX "relationships_organizationId_idx" ON "relationships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "relationships_senderId_receiverId_key" ON "relationships"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "business_follows_businessId_idx" ON "business_follows"("businessId");

-- CreateIndex
CREATE INDEX "business_follows_userId_idx" ON "business_follows"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "business_follows_userId_businessId_key" ON "business_follows"("userId", "businessId");

-- CreateIndex
CREATE INDEX "dashboards_businessId_idx" ON "dashboards"("businessId");

-- CreateIndex
CREATE INDEX "dashboards_institutionId_idx" ON "dashboards"("institutionId");

-- CreateIndex
CREATE INDEX "dashboards_householdId_idx" ON "dashboards"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_dashboardId_key" ON "RetentionPolicy"("dashboardId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceSettings_dashboardId_key" ON "ComplianceSettings"("dashboardId");

-- CreateIndex
CREATE UNIQUE INDEX "business_front_page_configs_businessId_key" ON "business_front_page_configs"("businessId");

-- CreateIndex
CREATE INDEX "business_front_widgets_configId_idx" ON "business_front_widgets"("configId");

-- CreateIndex
CREATE INDEX "business_front_widgets_widgetType_idx" ON "business_front_widgets"("widgetType");

-- CreateIndex
CREATE INDEX "business_front_widgets_visible_idx" ON "business_front_widgets"("visible");

-- CreateIndex
CREATE INDEX "user_front_page_customizations_userId_idx" ON "user_front_page_customizations"("userId");

-- CreateIndex
CREATE INDEX "user_front_page_customizations_businessId_idx" ON "user_front_page_customizations"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "user_front_page_customizations_userId_businessId_key" ON "user_front_page_customizations"("userId", "businessId");

-- CreateIndex
CREATE INDEX "household_members_userId_idx" ON "household_members"("userId");

-- CreateIndex
CREATE INDEX "household_members_householdId_idx" ON "household_members"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_userId_householdId_key" ON "household_members"("userId", "householdId");

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
CREATE INDEX "business_module_installations_moduleId_idx" ON "business_module_installations"("moduleId");

-- CreateIndex
CREATE INDEX "business_module_installations_businessId_idx" ON "business_module_installations"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_module_installations_moduleId_businessId_key" ON "business_module_installations"("moduleId", "businessId");

-- CreateIndex
CREATE INDEX "business_module_subscriptions_moduleId_idx" ON "business_module_subscriptions"("moduleId");

-- CreateIndex
CREATE INDEX "business_module_subscriptions_businessId_idx" ON "business_module_subscriptions"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_module_subscriptions_moduleId_businessId_key" ON "business_module_subscriptions"("moduleId", "businessId");

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
CREATE INDEX "organizational_tiers_businessId_idx" ON "organizational_tiers"("businessId");

-- CreateIndex
CREATE INDEX "organizational_tiers_level_idx" ON "organizational_tiers"("level");

-- CreateIndex
CREATE UNIQUE INDEX "organizational_tiers_businessId_name_key" ON "organizational_tiers"("businessId", "name");

-- CreateIndex
CREATE INDEX "positions_businessId_idx" ON "positions"("businessId");

-- CreateIndex
CREATE INDEX "positions_tierId_idx" ON "positions"("tierId");

-- CreateIndex
CREATE INDEX "positions_departmentId_idx" ON "positions"("departmentId");

-- CreateIndex
CREATE INDEX "positions_reportsToId_idx" ON "positions"("reportsToId");

-- CreateIndex
CREATE INDEX "positions_jobFunction_idx" ON "positions"("jobFunction");

-- CreateIndex
CREATE INDEX "positions_stationType_idx" ON "positions"("stationType");

-- CreateIndex
CREATE UNIQUE INDEX "positions_businessId_title_key" ON "positions"("businessId", "title");

-- CreateIndex
CREATE INDEX "permissions_moduleId_idx" ON "permissions"("moduleId");

-- CreateIndex
CREATE INDEX "permissions_featureId_idx" ON "permissions"("featureId");

-- CreateIndex
CREATE INDEX "permissions_action_idx" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "permissions_category_idx" ON "permissions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_moduleId_featureId_action_key" ON "permissions"("moduleId", "featureId", "action");

-- CreateIndex
CREATE INDEX "permission_sets_businessId_idx" ON "permission_sets"("businessId");

-- CreateIndex
CREATE INDEX "permission_sets_category_idx" ON "permission_sets"("category");

-- CreateIndex
CREATE INDEX "permission_sets_template_idx" ON "permission_sets"("template");

-- CreateIndex
CREATE UNIQUE INDEX "permission_sets_businessId_name_key" ON "permission_sets"("businessId", "name");

-- CreateIndex
CREATE INDEX "employee_positions_userId_idx" ON "employee_positions"("userId");

-- CreateIndex
CREATE INDEX "employee_positions_positionId_idx" ON "employee_positions"("positionId");

-- CreateIndex
CREATE INDEX "employee_positions_businessId_idx" ON "employee_positions"("businessId");

-- CreateIndex
CREATE INDEX "employee_positions_assignedById_idx" ON "employee_positions"("assignedById");

-- CreateIndex
CREATE INDEX "employee_positions_active_idx" ON "employee_positions"("active");

-- CreateIndex
CREATE UNIQUE INDEX "employee_positions_userId_positionId_businessId_key" ON "employee_positions"("userId", "positionId", "businessId");

-- CreateIndex
CREATE INDEX "permission_management_rights_userId_idx" ON "permission_management_rights"("userId");

-- CreateIndex
CREATE INDEX "permission_management_rights_businessId_idx" ON "permission_management_rights"("businessId");

-- CreateIndex
CREATE INDEX "permission_management_rights_grantedById_idx" ON "permission_management_rights"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "permission_management_rights_userId_businessId_key" ON "permission_management_rights"("userId", "businessId");

-- CreateIndex
CREATE INDEX "permission_changes_businessId_idx" ON "permission_changes"("businessId");

-- CreateIndex
CREATE INDEX "permission_changes_changedById_idx" ON "permission_changes"("changedById");

-- CreateIndex
CREATE INDEX "permission_changes_changedAt_idx" ON "permission_changes"("changedAt");

-- CreateIndex
CREATE INDEX "permission_changes_changeType_idx" ON "permission_changes"("changeType");

-- CreateIndex
CREATE UNIQUE INDEX "ai_personality_profiles_userId_key" ON "ai_personality_profiles"("userId");

-- CreateIndex
CREATE INDEX "ai_personality_profiles_userId_idx" ON "ai_personality_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_autonomy_settings_userId_key" ON "ai_autonomy_settings"("userId");

-- CreateIndex
CREATE INDEX "ai_autonomy_settings_userId_idx" ON "ai_autonomy_settings"("userId");

-- CreateIndex
CREATE INDEX "ai_approval_requests_userId_idx" ON "ai_approval_requests"("userId");

-- CreateIndex
CREATE INDEX "ai_approval_requests_status_idx" ON "ai_approval_requests"("status");

-- CreateIndex
CREATE INDEX "ai_approval_requests_expiresAt_idx" ON "ai_approval_requests"("expiresAt");

-- CreateIndex
CREATE INDEX "ai_conversation_history_userId_idx" ON "ai_conversation_history"("userId");

-- CreateIndex
CREATE INDEX "ai_conversation_history_sessionId_idx" ON "ai_conversation_history"("sessionId");

-- CreateIndex
CREATE INDEX "ai_conversation_history_interactionType_idx" ON "ai_conversation_history"("interactionType");

-- CreateIndex
CREATE INDEX "ai_conversation_history_createdAt_idx" ON "ai_conversation_history"("createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_tracking_userId_idx" ON "ai_usage_tracking"("userId");

-- CreateIndex
CREATE INDEX "ai_usage_tracking_year_month_idx" ON "ai_usage_tracking"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_tracking_userId_month_year_key" ON "ai_usage_tracking"("userId", "month", "year");

-- CreateIndex
CREATE INDEX "ai_learning_events_userId_idx" ON "ai_learning_events"("userId");

-- CreateIndex
CREATE INDEX "ai_learning_events_eventType_idx" ON "ai_learning_events"("eventType");

-- CreateIndex
CREATE INDEX "ai_learning_events_sourceModule_idx" ON "ai_learning_events"("sourceModule");

-- CreateIndex
CREATE INDEX "ai_learning_events_moduleActive_idx" ON "ai_learning_events"("moduleActive");

-- CreateIndex
CREATE INDEX "ai_learning_events_createdAt_idx" ON "ai_learning_events"("createdAt");

-- CreateIndex
CREATE INDEX "global_learning_events_userId_idx" ON "global_learning_events"("userId");

-- CreateIndex
CREATE INDEX "global_learning_events_eventType_idx" ON "global_learning_events"("eventType");

-- CreateIndex
CREATE INDEX "global_learning_events_context_idx" ON "global_learning_events"("context");

-- CreateIndex
CREATE INDEX "global_learning_events_sourceModule_idx" ON "global_learning_events"("sourceModule");

-- CreateIndex
CREATE INDEX "global_learning_events_moduleCategory_idx" ON "global_learning_events"("moduleCategory");

-- CreateIndex
CREATE INDEX "global_learning_events_createdAt_idx" ON "global_learning_events"("createdAt");

-- CreateIndex
CREATE INDEX "global_patterns_patternType_idx" ON "global_patterns"("patternType");

-- CreateIndex
CREATE INDEX "global_patterns_userSegment_idx" ON "global_patterns"("userSegment");

-- CreateIndex
CREATE INDEX "global_patterns_impact_idx" ON "global_patterns"("impact");

-- CreateIndex
CREATE INDEX "global_patterns_confidence_idx" ON "global_patterns"("confidence");

-- CreateIndex
CREATE INDEX "global_patterns_primaryModule_idx" ON "global_patterns"("primaryModule");

-- CreateIndex
CREATE INDEX "global_patterns_moduleCategory_idx" ON "global_patterns"("moduleCategory");

-- CreateIndex
CREATE INDEX "global_patterns_lastUpdated_idx" ON "global_patterns"("lastUpdated");

-- CreateIndex
CREATE INDEX "collective_insights_type_idx" ON "collective_insights"("type");

-- CreateIndex
CREATE INDEX "collective_insights_impact_idx" ON "collective_insights"("impact");

-- CreateIndex
CREATE INDEX "collective_insights_actionable_idx" ON "collective_insights"("actionable");

-- CreateIndex
CREATE INDEX "collective_insights_estimatedBenefit_idx" ON "collective_insights"("estimatedBenefit");

-- CreateIndex
CREATE INDEX "collective_insights_createdAt_idx" ON "collective_insights"("createdAt");

-- CreateIndex
CREATE INDEX "ab_tests_status_idx" ON "ab_tests"("status");

-- CreateIndex
CREATE INDEX "ab_tests_startDate_idx" ON "ab_tests"("startDate");

-- CreateIndex
CREATE INDEX "ab_test_variants_abTestId_idx" ON "ab_test_variants"("abTestId");

-- CreateIndex
CREATE INDEX "ab_test_results_abTestId_idx" ON "ab_test_results"("abTestId");

-- CreateIndex
CREATE INDEX "ab_test_results_variantId_idx" ON "ab_test_results"("variantId");

-- CreateIndex
CREATE INDEX "ab_test_results_userId_idx" ON "ab_test_results"("userId");

-- CreateIndex
CREATE INDEX "ab_test_results_timestamp_idx" ON "ab_test_results"("timestamp");

-- CreateIndex
CREATE INDEX "workflow_definitions_status_idx" ON "workflow_definitions"("status");

-- CreateIndex
CREATE INDEX "workflow_definitions_category_idx" ON "workflow_definitions"("category");

-- CreateIndex
CREATE INDEX "workflow_definitions_createdBy_idx" ON "workflow_definitions"("createdBy");

-- CreateIndex
CREATE INDEX "workflow_executions_workflowId_idx" ON "workflow_executions"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- CreateIndex
CREATE INDEX "workflow_executions_startedAt_idx" ON "workflow_executions"("startedAt");

-- CreateIndex
CREATE INDEX "ai_models_modelType_idx" ON "ai_models"("modelType");

-- CreateIndex
CREATE INDEX "ai_models_status_idx" ON "ai_models"("status");

-- CreateIndex
CREATE INDEX "ai_models_createdBy_idx" ON "ai_models"("createdBy");

-- CreateIndex
CREATE INDEX "ai_model_versions_modelId_idx" ON "ai_model_versions"("modelId");

-- CreateIndex
CREATE INDEX "ai_model_versions_version_idx" ON "ai_model_versions"("version");

-- CreateIndex
CREATE INDEX "ai_model_deployments_modelId_idx" ON "ai_model_deployments"("modelId");

-- CreateIndex
CREATE INDEX "ai_model_deployments_versionId_idx" ON "ai_model_deployments"("versionId");

-- CreateIndex
CREATE INDEX "ai_model_deployments_environment_idx" ON "ai_model_deployments"("environment");

-- CreateIndex
CREATE INDEX "ai_model_deployments_status_idx" ON "ai_model_deployments"("status");

-- CreateIndex
CREATE INDEX "ai_model_experiments_modelId_idx" ON "ai_model_experiments"("modelId");

-- CreateIndex
CREATE INDEX "ai_model_experiments_status_idx" ON "ai_model_experiments"("status");

-- CreateIndex
CREATE INDEX "model_ab_tests_modelId_idx" ON "model_ab_tests"("modelId");

-- CreateIndex
CREATE INDEX "model_ab_tests_status_idx" ON "model_ab_tests"("status");

-- CreateIndex
CREATE INDEX "user_ai_context_userId_idx" ON "user_ai_context"("userId");

-- CreateIndex
CREATE INDEX "user_ai_context_scope_scopeId_idx" ON "user_ai_context"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "user_ai_context_moduleId_idx" ON "user_ai_context"("moduleId");

-- CreateIndex
CREATE INDEX "user_ai_context_contextType_idx" ON "user_ai_context"("contextType");

-- CreateIndex
CREATE INDEX "user_ai_context_active_idx" ON "user_ai_context"("active");

-- CreateIndex
CREATE INDEX "automl_jobs_status_idx" ON "automl_jobs"("status");

-- CreateIndex
CREATE INDEX "automl_jobs_task_idx" ON "automl_jobs"("task");

-- CreateIndex
CREATE INDEX "automl_jobs_createdBy_idx" ON "automl_jobs"("createdBy");

-- CreateIndex
CREATE INDEX "automl_trials_jobId_idx" ON "automl_trials"("jobId");

-- CreateIndex
CREATE INDEX "automl_trials_trialNumber_idx" ON "automl_trials"("trialNumber");

-- CreateIndex
CREATE INDEX "automl_trials_status_idx" ON "automl_trials"("status");

-- CreateIndex
CREATE INDEX "data_streams_source_idx" ON "data_streams"("source");

-- CreateIndex
CREATE INDEX "data_streams_status_idx" ON "data_streams"("status");

-- CreateIndex
CREATE INDEX "data_points_streamId_idx" ON "data_points"("streamId");

-- CreateIndex
CREATE INDEX "data_points_timestamp_idx" ON "data_points"("timestamp");

-- CreateIndex
CREATE INDEX "stream_processors_streamId_idx" ON "stream_processors"("streamId");

-- CreateIndex
CREATE INDEX "stream_processors_type_idx" ON "stream_processors"("type");

-- CreateIndex
CREATE INDEX "real_time_metrics_name_idx" ON "real_time_metrics"("name");

-- CreateIndex
CREATE INDEX "real_time_metrics_category_idx" ON "real_time_metrics"("category");

-- CreateIndex
CREATE INDEX "real_time_metrics_timestamp_idx" ON "real_time_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "real_time_alerts_metricName_idx" ON "real_time_alerts"("metricName");

-- CreateIndex
CREATE INDEX "real_time_alerts_severity_idx" ON "real_time_alerts"("severity");

-- CreateIndex
CREATE INDEX "real_time_alerts_status_idx" ON "real_time_alerts"("status");

-- CreateIndex
CREATE INDEX "analytics_dashboards_category_idx" ON "analytics_dashboards"("category");

-- CreateIndex
CREATE INDEX "analytics_dashboards_createdBy_idx" ON "analytics_dashboards"("createdBy");

-- CreateIndex
CREATE INDEX "dashboard_widgets_dashboardId_idx" ON "dashboard_widgets"("dashboardId");

-- CreateIndex
CREATE INDEX "dashboard_widgets_type_idx" ON "dashboard_widgets"("type");

-- CreateIndex
CREATE INDEX "forecasting_models_modelType_idx" ON "forecasting_models"("modelType");

-- CreateIndex
CREATE INDEX "forecasting_models_status_idx" ON "forecasting_models"("status");

-- CreateIndex
CREATE INDEX "forecasts_modelId_idx" ON "forecasts"("modelId");

-- CreateIndex
CREATE INDEX "forecasts_horizon_idx" ON "forecasts"("horizon");

-- CreateIndex
CREATE INDEX "forecasts_createdAt_idx" ON "forecasts"("createdAt");

-- CreateIndex
CREATE INDEX "anomaly_detection_models_modelType_idx" ON "anomaly_detection_models"("modelType");

-- CreateIndex
CREATE INDEX "anomaly_detection_models_status_idx" ON "anomaly_detection_models"("status");

-- CreateIndex
CREATE INDEX "anomalies_modelId_idx" ON "anomalies"("modelId");

-- CreateIndex
CREATE INDEX "anomalies_severity_idx" ON "anomalies"("severity");

-- CreateIndex
CREATE INDEX "anomalies_detectedAt_idx" ON "anomalies"("detectedAt");

-- CreateIndex
CREATE INDEX "business_metrics_name_idx" ON "business_metrics"("name");

-- CreateIndex
CREATE INDEX "business_metrics_category_idx" ON "business_metrics"("category");

-- CreateIndex
CREATE INDEX "business_metrics_lastUpdated_idx" ON "business_metrics"("lastUpdated");

-- CreateIndex
CREATE INDEX "kpi_dashboards_category_idx" ON "kpi_dashboards"("category");

-- CreateIndex
CREATE INDEX "kpi_dashboards_createdBy_idx" ON "kpi_dashboards"("createdBy");

-- CreateIndex
CREATE INDEX "pattern_discoveries_patternType_idx" ON "pattern_discoveries"("patternType");

-- CreateIndex
CREATE INDEX "pattern_discoveries_confidence_idx" ON "pattern_discoveries"("confidence");

-- CreateIndex
CREATE INDEX "pattern_discoveries_discoveredAt_idx" ON "pattern_discoveries"("discoveredAt");

-- CreateIndex
CREATE INDEX "intelligent_insights_type_idx" ON "intelligent_insights"("type");

-- CreateIndex
CREATE INDEX "intelligent_insights_impact_idx" ON "intelligent_insights"("impact");

-- CreateIndex
CREATE INDEX "intelligent_insights_actionable_idx" ON "intelligent_insights"("actionable");

-- CreateIndex
CREATE INDEX "intelligent_insights_createdAt_idx" ON "intelligent_insights"("createdAt");

-- CreateIndex
CREATE INDEX "recommendations_type_idx" ON "recommendations"("type");

-- CreateIndex
CREATE INDEX "recommendations_priority_idx" ON "recommendations"("priority");

-- CreateIndex
CREATE INDEX "recommendations_status_idx" ON "recommendations"("status");

-- CreateIndex
CREATE INDEX "recommendations_impact_idx" ON "recommendations"("impact");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_lastMessageAt_idx" ON "ai_conversations"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ai_conversations_dashboardId_idx" ON "ai_conversations"("dashboardId");

-- CreateIndex
CREATE INDEX "ai_conversations_businessId_idx" ON "ai_conversations"("businessId");

-- CreateIndex
CREATE INDEX "ai_conversations_isArchived_lastMessageAt_idx" ON "ai_conversations"("isArchived", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ai_conversations_trashedAt_idx" ON "ai_conversations"("trashedAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_messages_role_createdAt_idx" ON "ai_messages"("role", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "business_ai_digital_twins_businessId_key" ON "business_ai_digital_twins"("businessId");

-- CreateIndex
CREATE INDEX "business_ai_digital_twins_businessId_idx" ON "business_ai_digital_twins"("businessId");

-- CreateIndex
CREATE INDEX "business_ai_digital_twins_status_idx" ON "business_ai_digital_twins"("status");

-- CreateIndex
CREATE INDEX "business_ai_digital_twins_securityLevel_idx" ON "business_ai_digital_twins"("securityLevel");

-- CreateIndex
CREATE INDEX "business_ai_interactions_businessAIId_idx" ON "business_ai_interactions"("businessAIId");

-- CreateIndex
CREATE INDEX "business_ai_interactions_userId_idx" ON "business_ai_interactions"("userId");

-- CreateIndex
CREATE INDEX "business_ai_interactions_interactionType_idx" ON "business_ai_interactions"("interactionType");

-- CreateIndex
CREATE INDEX "business_ai_interactions_createdAt_idx" ON "business_ai_interactions"("createdAt");

-- CreateIndex
CREATE INDEX "business_ai_interactions_moduleContext_idx" ON "business_ai_interactions"("moduleContext");

-- CreateIndex
CREATE INDEX "business_ai_learning_events_businessAIId_idx" ON "business_ai_learning_events"("businessAIId");

-- CreateIndex
CREATE INDEX "business_ai_learning_events_eventType_idx" ON "business_ai_learning_events"("eventType");

-- CreateIndex
CREATE INDEX "business_ai_learning_events_sourceUserId_idx" ON "business_ai_learning_events"("sourceUserId");

-- CreateIndex
CREATE INDEX "business_ai_learning_events_approved_idx" ON "business_ai_learning_events"("approved");

-- CreateIndex
CREATE INDEX "business_ai_learning_events_createdAt_idx" ON "business_ai_learning_events"("createdAt");

-- CreateIndex
CREATE INDEX "business_ai_usage_metrics_businessAIId_idx" ON "business_ai_usage_metrics"("businessAIId");

-- CreateIndex
CREATE INDEX "business_ai_usage_metrics_date_idx" ON "business_ai_usage_metrics"("date");

-- CreateIndex
CREATE INDEX "business_ai_usage_metrics_period_idx" ON "business_ai_usage_metrics"("period");

-- CreateIndex
CREATE UNIQUE INDEX "business_ai_usage_metrics_businessAIId_date_period_key" ON "business_ai_usage_metrics"("businessAIId", "date", "period");

-- CreateIndex
CREATE UNIQUE INDEX "module_ai_context_registry_moduleId_key" ON "module_ai_context_registry"("moduleId");

-- CreateIndex
CREATE INDEX "module_ai_context_registry_keywords_idx" ON "module_ai_context_registry"("keywords");

-- CreateIndex
CREATE INDEX "module_ai_context_registry_category_idx" ON "module_ai_context_registry"("category");

-- CreateIndex
CREATE INDEX "module_ai_context_registry_moduleName_idx" ON "module_ai_context_registry"("moduleName");

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_context_cache_userId_key" ON "user_ai_context_cache"("userId");

-- CreateIndex
CREATE INDEX "user_ai_context_cache_userId_idx" ON "user_ai_context_cache"("userId");

-- CreateIndex
CREATE INDEX "user_ai_context_cache_expiresAt_idx" ON "user_ai_context_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "module_ai_performance_metrics_moduleId_idx" ON "module_ai_performance_metrics"("moduleId");

-- CreateIndex
CREATE INDEX "module_ai_performance_metrics_date_idx" ON "module_ai_performance_metrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "module_ai_performance_metrics_moduleId_date_key" ON "module_ai_performance_metrics"("moduleId", "date");

-- CreateIndex
CREATE INDEX "ai_query_balances_userId_idx" ON "ai_query_balances"("userId");

-- CreateIndex
CREATE INDEX "ai_query_balances_businessId_idx" ON "ai_query_balances"("businessId");

-- CreateIndex
CREATE INDEX "ai_query_balances_currentPeriodStart_idx" ON "ai_query_balances"("currentPeriodStart");

-- CreateIndex
CREATE UNIQUE INDEX "ai_query_balances_userId_businessId_key" ON "ai_query_balances"("userId", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_query_purchases_stripePaymentIntentId_key" ON "ai_query_purchases"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "ai_query_purchases_userId_idx" ON "ai_query_purchases"("userId");

-- CreateIndex
CREATE INDEX "ai_query_purchases_businessId_idx" ON "ai_query_purchases"("businessId");

-- CreateIndex
CREATE INDEX "ai_query_purchases_status_idx" ON "ai_query_purchases"("status");

-- CreateIndex
CREATE INDEX "ai_query_purchases_stripePaymentIntentId_idx" ON "ai_query_purchases"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "ai_query_purchases_createdAt_idx" ON "ai_query_purchases"("createdAt");

-- CreateIndex
CREATE INDEX "pricing_configs_tier_isActive_idx" ON "pricing_configs"("tier", "isActive");

-- CreateIndex
CREATE INDEX "pricing_configs_effectiveDate_idx" ON "pricing_configs"("effectiveDate");

-- CreateIndex
CREATE INDEX "pricing_configs_tier_billingCycle_idx" ON "pricing_configs"("tier", "billingCycle");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_configs_tier_billingCycle_effectiveDate_key" ON "pricing_configs"("tier", "billingCycle", "effectiveDate");

-- CreateIndex
CREATE INDEX "price_changes_pricingConfigId_idx" ON "price_changes"("pricingConfigId");

-- CreateIndex
CREATE INDEX "price_changes_createdAt_idx" ON "price_changes"("createdAt");

-- CreateIndex
CREATE INDEX "price_changes_changeType_idx" ON "price_changes"("changeType");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_businessId_idx" ON "subscriptions"("businessId");

-- CreateIndex
CREATE INDEX "subscriptions_tier_idx" ON "subscriptions"("tier");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "module_subscriptions_userId_idx" ON "module_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "module_subscriptions_businessId_idx" ON "module_subscriptions"("businessId");

-- CreateIndex
CREATE INDEX "module_subscriptions_moduleId_idx" ON "module_subscriptions"("moduleId");

-- CreateIndex
CREATE INDEX "module_subscriptions_status_idx" ON "module_subscriptions"("status");

-- CreateIndex
CREATE INDEX "usage_records_subscriptionId_idx" ON "usage_records"("subscriptionId");

-- CreateIndex
CREATE INDEX "usage_records_moduleSubscriptionId_idx" ON "usage_records"("moduleSubscriptionId");

-- CreateIndex
CREATE INDEX "usage_records_userId_idx" ON "usage_records"("userId");

-- CreateIndex
CREATE INDEX "usage_records_metric_idx" ON "usage_records"("metric");

-- CreateIndex
CREATE INDEX "usage_records_periodStart_idx" ON "usage_records"("periodStart");

-- CreateIndex
CREATE INDEX "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");

-- CreateIndex
CREATE INDEX "invoices_moduleSubscriptionId_idx" ON "invoices"("moduleSubscriptionId");

-- CreateIndex
CREATE INDEX "invoices_businessId_idx" ON "invoices"("businessId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_stripeInvoiceId_idx" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "invoices_stripeChargeId_idx" ON "invoices"("stripeChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_stripeRefundId_key" ON "refunds"("stripeRefundId");

-- CreateIndex
CREATE INDEX "refunds_invoiceId_idx" ON "refunds"("invoiceId");

-- CreateIndex
CREATE INDEX "refunds_stripeRefundId_idx" ON "refunds"("stripeRefundId");

-- CreateIndex
CREATE INDEX "developer_revenue_developerId_idx" ON "developer_revenue"("developerId");

-- CreateIndex
CREATE INDEX "developer_revenue_moduleId_idx" ON "developer_revenue"("moduleId");

-- CreateIndex
CREATE INDEX "developer_revenue_periodStart_idx" ON "developer_revenue"("periodStart");

-- CreateIndex
CREATE INDEX "developer_revenue_commissionType_idx" ON "developer_revenue"("commissionType");

-- CreateIndex
CREATE INDEX "calendars_contextType_contextId_idx" ON "calendars"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "calendar_members_userId_idx" ON "calendar_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_members_calendarId_userId_key" ON "calendar_members"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "events_calendarId_idx" ON "events"("calendarId");

-- CreateIndex
CREATE INDEX "events_startAt_endAt_idx" ON "events"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "events_trashedAt_idx" ON "events"("trashedAt");

-- CreateIndex
CREATE INDEX "event_attendees_eventId_idx" ON "event_attendees"("eventId");

-- CreateIndex
CREATE INDEX "reminders_eventId_idx" ON "reminders"("eventId");

-- CreateIndex
CREATE INDEX "event_attachments_eventId_idx" ON "event_attachments"("eventId");

-- CreateIndex
CREATE INDEX "event_comments_eventId_idx" ON "event_comments"("eventId");

-- CreateIndex
CREATE INDEX "event_comments_userId_idx" ON "event_comments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rsvp_tokens_token_key" ON "rsvp_tokens"("token");

-- CreateIndex
CREATE INDEX "rsvp_tokens_token_idx" ON "rsvp_tokens"("token");

-- CreateIndex
CREATE INDEX "rsvp_tokens_eventId_idx" ON "rsvp_tokens"("eventId");

-- CreateIndex
CREATE INDEX "files_userId_idx" ON "files"("userId");

-- CreateIndex
CREATE INDEX "files_folderId_idx" ON "files"("folderId");

-- CreateIndex
CREATE INDEX "files_dashboardId_idx" ON "files"("dashboardId");

-- CreateIndex
CREATE INDEX "folders_userId_idx" ON "folders"("userId");

-- CreateIndex
CREATE INDEX "folders_parentId_idx" ON "folders"("parentId");

-- CreateIndex
CREATE INDEX "folders_dashboardId_idx" ON "folders"("dashboardId");

-- CreateIndex
CREATE INDEX "file_permissions_fileId_idx" ON "file_permissions"("fileId");

-- CreateIndex
CREATE INDEX "file_permissions_userId_idx" ON "file_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "file_permissions_fileId_userId_key" ON "file_permissions"("fileId", "userId");

-- CreateIndex
CREATE INDEX "folder_permissions_folderId_idx" ON "folder_permissions"("folderId");

-- CreateIndex
CREATE INDEX "folder_permissions_userId_idx" ON "folder_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "folder_permissions_folderId_userId_key" ON "folder_permissions"("folderId", "userId");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "activities"("userId");

-- CreateIndex
CREATE INDEX "activities_fileId_idx" ON "activities"("fileId");

-- CreateIndex
CREATE INDEX "activities_timestamp_idx" ON "activities"("timestamp");

-- CreateIndex
CREATE INDEX "content_reports_reporterId_idx" ON "content_reports"("reporterId");

-- CreateIndex
CREATE INDEX "content_reports_contentType_idx" ON "content_reports"("contentType");

-- CreateIndex
CREATE INDEX "content_reports_status_idx" ON "content_reports"("status");

-- CreateIndex
CREATE INDEX "system_metrics_metricType_idx" ON "system_metrics"("metricType");

-- CreateIndex
CREATE INDEX "system_metrics_metricName_idx" ON "system_metrics"("metricName");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_configKey_key" ON "system_configs"("configKey");

-- CreateIndex
CREATE INDEX "system_configs_configKey_idx" ON "system_configs"("configKey");

-- CreateIndex
CREATE INDEX "security_events_eventType_idx" ON "security_events"("eventType");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_timestamp_idx" ON "security_events"("timestamp");

-- CreateIndex
CREATE INDEX "security_events_resolved_idx" ON "security_events"("resolved");

-- CreateIndex
CREATE UNIQUE INDEX "admin_impersonations_sessionTokenHash_key" ON "admin_impersonations"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "admin_impersonations_adminId_idx" ON "admin_impersonations"("adminId");

-- CreateIndex
CREATE INDEX "admin_impersonations_targetUserId_idx" ON "admin_impersonations"("targetUserId");

-- CreateIndex
CREATE INDEX "admin_impersonations_startedAt_idx" ON "admin_impersonations"("startedAt");

-- CreateIndex
CREATE INDEX "admin_impersonations_businessId_idx" ON "admin_impersonations"("businessId");

-- CreateIndex
CREATE INDEX "admin_impersonations_adminId_endedAt_idx" ON "admin_impersonations"("adminId", "endedAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_conversationId_idx" ON "audit_logs"("conversationId");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_idx" ON "audit_logs"("resourceType");

-- CreateIndex
CREATE INDEX "audit_logs_resourceId_idx" ON "audit_logs"("resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_adminImpersonationId_idx" ON "audit_logs"("adminImpersonationId");

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
CREATE INDEX "policy_violations_policyId_idx" ON "policy_violations"("policyId");

-- CreateIndex
CREATE INDEX "policy_violations_resourceType_idx" ON "policy_violations"("resourceType");

-- CreateIndex
CREATE INDEX "policy_violations_severity_idx" ON "policy_violations"("severity");

-- CreateIndex
CREATE INDEX "policy_violations_detectedAt_idx" ON "policy_violations"("detectedAt");

-- CreateIndex
CREATE INDEX "policy_violations_resolvedAt_idx" ON "policy_violations"("resolvedAt");

-- CreateIndex
CREATE INDEX "ai_provider_usage_snapshots_provider_idx" ON "ai_provider_usage_snapshots"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_usage_snapshots_snapshotDate_idx" ON "ai_provider_usage_snapshots"("snapshotDate");

-- CreateIndex
CREATE INDEX "ai_provider_usage_snapshots_provider_snapshotDate_idx" ON "ai_provider_usage_snapshots"("provider", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_usage_snapshots_provider_snapshotDate_key" ON "ai_provider_usage_snapshots"("provider", "snapshotDate");

-- CreateIndex
CREATE INDEX "ai_provider_expense_snapshots_provider_idx" ON "ai_provider_expense_snapshots"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_expense_snapshots_period_idx" ON "ai_provider_expense_snapshots"("period");

-- CreateIndex
CREATE INDEX "ai_provider_expense_snapshots_periodStart_idx" ON "ai_provider_expense_snapshots"("periodStart");

-- CreateIndex
CREATE INDEX "ai_provider_expense_snapshots_provider_period_periodStart_idx" ON "ai_provider_expense_snapshots"("provider", "period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_expense_snapshots_provider_period_periodStart_key" ON "ai_provider_expense_snapshots"("provider", "period", "periodStart");

-- CreateIndex
CREATE INDEX "logs_level_timestamp_idx" ON "logs"("level", "timestamp");

-- CreateIndex
CREATE INDEX "logs_service_timestamp_idx" ON "logs"("service", "timestamp");

-- CreateIndex
CREATE INDEX "logs_operation_timestamp_idx" ON "logs"("operation", "timestamp");

-- CreateIndex
CREATE INDEX "logs_userId_timestamp_idx" ON "logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "logs_businessId_timestamp_idx" ON "logs"("businessId", "timestamp");

-- CreateIndex
CREATE INDEX "logs_module_timestamp_idx" ON "logs"("module", "timestamp");

-- CreateIndex
CREATE INDEX "logs_timestamp_idx" ON "logs"("timestamp");

-- CreateIndex
CREATE INDEX "sso_providers_type_idx" ON "sso_providers"("type");

-- CreateIndex
CREATE INDEX "sso_providers_status_idx" ON "sso_providers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sso_sessions_sessionToken_key" ON "sso_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sso_sessions_providerId_idx" ON "sso_sessions"("providerId");

-- CreateIndex
CREATE INDEX "sso_sessions_userId_idx" ON "sso_sessions"("userId");

-- CreateIndex
CREATE INDEX "sso_sessions_expiresAt_idx" ON "sso_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "compliance_frameworks_name_idx" ON "compliance_frameworks"("name");

-- CreateIndex
CREATE INDEX "compliance_frameworks_status_idx" ON "compliance_frameworks"("status");

-- CreateIndex
CREATE INDEX "security_incidents_severity_idx" ON "security_incidents"("severity");

-- CreateIndex
CREATE INDEX "security_incidents_status_idx" ON "security_incidents"("status");

-- CreateIndex
CREATE INDEX "security_incidents_category_idx" ON "security_incidents"("category");

-- CreateIndex
CREATE INDEX "security_incidents_reportedAt_idx" ON "security_incidents"("reportedAt");

-- CreateIndex
CREATE INDEX "security_audits_type_idx" ON "security_audits"("type");

-- CreateIndex
CREATE INDEX "security_audits_scope_idx" ON "security_audits"("scope");

-- CreateIndex
CREATE INDEX "security_audits_status_idx" ON "security_audits"("status");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_base_articles_slug_key" ON "knowledge_base_articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "support_analytics_date_key" ON "support_analytics"("date");

-- CreateIndex
CREATE INDEX "time_off_requests_businessId_idx" ON "time_off_requests"("businessId");

-- CreateIndex
CREATE INDEX "time_off_requests_employeePositionId_idx" ON "time_off_requests"("employeePositionId");

-- CreateIndex
CREATE INDEX "time_off_requests_status_idx" ON "time_off_requests"("status");

-- CreateIndex
CREATE INDEX "attendance_policies_businessId_idx" ON "attendance_policies"("businessId");

-- CreateIndex
CREATE INDEX "attendance_policies_active_idx" ON "attendance_policies"("active");

-- CreateIndex
CREATE INDEX "attendance_shift_templates_businessId_idx" ON "attendance_shift_templates"("businessId");

-- CreateIndex
CREATE INDEX "attendance_shift_templates_policyId_idx" ON "attendance_shift_templates"("policyId");

-- CreateIndex
CREATE INDEX "attendance_shift_templates_isActive_idx" ON "attendance_shift_templates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_shift_templates_businessId_name_key" ON "attendance_shift_templates"("businessId", "name");

-- CreateIndex
CREATE INDEX "attendance_shift_assignments_businessId_idx" ON "attendance_shift_assignments"("businessId");

-- CreateIndex
CREATE INDEX "attendance_shift_assignments_employeePositionId_idx" ON "attendance_shift_assignments"("employeePositionId");

-- CreateIndex
CREATE INDEX "attendance_shift_assignments_shiftTemplateId_idx" ON "attendance_shift_assignments"("shiftTemplateId");

-- CreateIndex
CREATE INDEX "attendance_shift_assignments_status_idx" ON "attendance_shift_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_shift_assignments_employeePositionId_shiftTempla_key" ON "attendance_shift_assignments"("employeePositionId", "shiftTemplateId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "attendance_records_businessId_workDate_idx" ON "attendance_records"("businessId", "workDate");

-- CreateIndex
CREATE INDEX "attendance_records_employeePositionId_workDate_idx" ON "attendance_records"("employeePositionId", "workDate");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE INDEX "attendance_exceptions_businessId_status_idx" ON "attendance_exceptions"("businessId", "status");

-- CreateIndex
CREATE INDEX "attendance_exceptions_employeePositionId_idx" ON "attendance_exceptions"("employeePositionId");

-- CreateIndex
CREATE INDEX "attendance_exceptions_attendanceRecordId_idx" ON "attendance_exceptions"("attendanceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_hr_profiles_employeePositionId_key" ON "employee_hr_profiles"("employeePositionId");

-- CreateIndex
CREATE INDEX "employee_hr_profiles_businessId_idx" ON "employee_hr_profiles"("businessId");

-- CreateIndex
CREATE INDEX "employee_hr_profiles_employeePositionId_idx" ON "employee_hr_profiles"("employeePositionId");

-- CreateIndex
CREATE INDEX "employee_hr_profiles_deletedAt_idx" ON "employee_hr_profiles"("deletedAt");

-- CreateIndex
CREATE INDEX "employee_hr_profiles_employeeType_idx" ON "employee_hr_profiles"("employeeType");

-- CreateIndex
CREATE INDEX "employee_hr_profiles_employmentStatus_idx" ON "employee_hr_profiles"("employmentStatus");

-- CreateIndex
CREATE INDEX "manager_approval_hierarchy_businessId_idx" ON "manager_approval_hierarchy"("businessId");

-- CreateIndex
CREATE INDEX "manager_approval_hierarchy_employeePositionId_idx" ON "manager_approval_hierarchy"("employeePositionId");

-- CreateIndex
CREATE INDEX "manager_approval_hierarchy_managerPositionId_idx" ON "manager_approval_hierarchy"("managerPositionId");

-- CreateIndex
CREATE INDEX "manager_approval_hierarchy_active_idx" ON "manager_approval_hierarchy"("active");

-- CreateIndex
CREATE UNIQUE INDEX "manager_approval_hierarchy_employeePositionId_managerPositi_key" ON "manager_approval_hierarchy"("employeePositionId", "managerPositionId", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_module_settings_businessId_key" ON "hr_module_settings"("businessId");

-- CreateIndex
CREATE INDEX "hr_module_settings_businessId_idx" ON "hr_module_settings"("businessId");

-- CreateIndex
CREATE INDEX "hr_onboarding_templates_businessId_idx" ON "hr_onboarding_templates"("businessId");

-- CreateIndex
CREATE INDEX "hr_onboarding_templates_isActive_idx" ON "hr_onboarding_templates"("isActive");

-- CreateIndex
CREATE INDEX "hr_onboarding_templates_isDefault_idx" ON "hr_onboarding_templates"("isDefault");

-- CreateIndex
CREATE INDEX "hr_onboarding_task_templates_businessId_idx" ON "hr_onboarding_task_templates"("businessId");

-- CreateIndex
CREATE INDEX "hr_onboarding_task_templates_onboardingTemplateId_idx" ON "hr_onboarding_task_templates"("onboardingTemplateId");

-- CreateIndex
CREATE INDEX "hr_onboarding_task_templates_taskType_idx" ON "hr_onboarding_task_templates"("taskType");

-- CreateIndex
CREATE INDEX "hr_onboarding_task_templates_ownerType_idx" ON "hr_onboarding_task_templates"("ownerType");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_journeys_businessId_idx" ON "hr_employee_onboarding_journeys"("businessId");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_journeys_employeeHrProfileId_idx" ON "hr_employee_onboarding_journeys"("employeeHrProfileId");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_journeys_status_idx" ON "hr_employee_onboarding_journeys"("status");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_tasks_businessId_idx" ON "hr_employee_onboarding_tasks"("businessId");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_tasks_onboardingJourneyId_idx" ON "hr_employee_onboarding_tasks"("onboardingJourneyId");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_tasks_status_idx" ON "hr_employee_onboarding_tasks"("status");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_tasks_taskType_idx" ON "hr_employee_onboarding_tasks"("taskType");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_tasks_ownerType_idx" ON "hr_employee_onboarding_tasks"("ownerType");

-- CreateIndex
CREATE INDEX "schedules_businessId_idx" ON "schedules"("businessId");

-- CreateIndex
CREATE INDEX "schedules_status_idx" ON "schedules"("status");

-- CreateIndex
CREATE INDEX "schedules_startDate_endDate_idx" ON "schedules"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "schedules_layoutMode_idx" ON "schedules"("layoutMode");

-- CreateIndex
CREATE INDEX "schedule_shifts_scheduleId_idx" ON "schedule_shifts"("scheduleId");

-- CreateIndex
CREATE INDEX "schedule_shifts_businessId_idx" ON "schedule_shifts"("businessId");

-- CreateIndex
CREATE INDEX "schedule_shifts_employeePositionId_idx" ON "schedule_shifts"("employeePositionId");

-- CreateIndex
CREATE INDEX "schedule_shifts_positionId_idx" ON "schedule_shifts"("positionId");

-- CreateIndex
CREATE INDEX "schedule_shifts_locationId_idx" ON "schedule_shifts"("locationId");

-- CreateIndex
CREATE INDEX "schedule_shifts_startTime_endTime_idx" ON "schedule_shifts"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "schedule_shifts_isOpenShift_idx" ON "schedule_shifts"("isOpenShift");

-- CreateIndex
CREATE INDEX "schedule_shifts_stationName_idx" ON "schedule_shifts"("stationName");

-- CreateIndex
CREATE INDEX "schedule_shifts_jobFunction_idx" ON "schedule_shifts"("jobFunction");

-- CreateIndex
CREATE INDEX "schedule_shifts_priority_idx" ON "schedule_shifts"("priority");

-- CreateIndex
CREATE INDEX "shift_templates_businessId_idx" ON "shift_templates"("businessId");

-- CreateIndex
CREATE INDEX "shift_templates_isActive_idx" ON "shift_templates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "shift_templates_businessId_name_key" ON "shift_templates"("businessId", "name");

-- CreateIndex
CREATE INDEX "employee_availability_businessId_idx" ON "employee_availability"("businessId");

-- CreateIndex
CREATE INDEX "employee_availability_employeePositionId_idx" ON "employee_availability"("employeePositionId");

-- CreateIndex
CREATE INDEX "employee_availability_dayOfWeek_idx" ON "employee_availability"("dayOfWeek");

-- CreateIndex
CREATE INDEX "shift_swap_requests_businessId_idx" ON "shift_swap_requests"("businessId");

-- CreateIndex
CREATE INDEX "shift_swap_requests_originalShiftId_idx" ON "shift_swap_requests"("originalShiftId");

-- CreateIndex
CREATE INDEX "shift_swap_requests_requestedById_idx" ON "shift_swap_requests"("requestedById");

-- CreateIndex
CREATE INDEX "shift_swap_requests_status_idx" ON "shift_swap_requests"("status");

-- CreateIndex
CREATE INDEX "schedule_templates_businessId_idx" ON "schedule_templates"("businessId");

-- CreateIndex
CREATE INDEX "schedule_templates_isActive_idx" ON "schedule_templates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_templates_businessId_name_key" ON "schedule_templates"("businessId", "name");

-- CreateIndex
CREATE INDEX "business_stations_businessId_idx" ON "business_stations"("businessId");

-- CreateIndex
CREATE INDEX "business_stations_stationType_idx" ON "business_stations"("stationType");

-- CreateIndex
CREATE INDEX "business_stations_jobFunction_idx" ON "business_stations"("jobFunction");

-- CreateIndex
CREATE INDEX "business_stations_isActive_idx" ON "business_stations"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "business_stations_businessId_name_key" ON "business_stations"("businessId", "name");

-- CreateIndex
CREATE INDEX "job_locations_businessId_idx" ON "job_locations"("businessId");

-- CreateIndex
CREATE INDEX "job_locations_isActive_idx" ON "job_locations"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "job_locations_businessId_name_key" ON "job_locations"("businessId", "name");

-- CreateIndex
CREATE INDEX "tasks_dashboardId_businessId_idx" ON "tasks"("dashboardId", "businessId");

-- CreateIndex
CREATE INDEX "tasks_assignedToId_idx" ON "tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "tasks_status_dueDate_idx" ON "tasks"("status", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_trashedAt_idx" ON "tasks"("trashedAt");

-- CreateIndex
CREATE INDEX "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");

-- CreateIndex
CREATE INDEX "tasks_createdById_idx" ON "tasks"("createdById");

-- CreateIndex
CREATE INDEX "task_dependencies_taskId_idx" ON "task_dependencies"("taskId");

-- CreateIndex
CREATE INDEX "task_dependencies_dependsOnTaskId_idx" ON "task_dependencies"("dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_taskId_dependsOnTaskId_key" ON "task_dependencies"("taskId", "dependsOnTaskId");

-- CreateIndex
CREATE INDEX "task_attachments_taskId_idx" ON "task_attachments"("taskId");

-- CreateIndex
CREATE INDEX "task_file_links_taskId_idx" ON "task_file_links"("taskId");

-- CreateIndex
CREATE INDEX "task_file_links_fileId_idx" ON "task_file_links"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "task_file_links_taskId_fileId_key" ON "task_file_links"("taskId", "fileId");

-- CreateIndex
CREATE INDEX "task_event_links_taskId_idx" ON "task_event_links"("taskId");

-- CreateIndex
CREATE INDEX "task_event_links_eventId_idx" ON "task_event_links"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "task_event_links_taskId_eventId_key" ON "task_event_links"("taskId", "eventId");

-- CreateIndex
CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");

-- CreateIndex
CREATE INDEX "task_comments_userId_idx" ON "task_comments"("userId");

-- CreateIndex
CREATE INDEX "task_watchers_taskId_idx" ON "task_watchers"("taskId");

-- CreateIndex
CREATE INDEX "task_watchers_userId_idx" ON "task_watchers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "task_watchers_taskId_userId_key" ON "task_watchers"("taskId", "userId");

-- CreateIndex
CREATE INDEX "task_projects_dashboardId_businessId_idx" ON "task_projects"("dashboardId", "businessId");

-- CreateIndex
CREATE INDEX "task_time_logs_taskId_idx" ON "task_time_logs"("taskId");

-- CreateIndex
CREATE INDEX "task_time_logs_userId_idx" ON "task_time_logs"("userId");

-- CreateIndex
CREATE INDEX "task_time_logs_isActive_idx" ON "task_time_logs"("isActive");

-- CreateIndex
CREATE INDEX "task_time_logs_startedAt_idx" ON "task_time_logs"("startedAt");

-- CreateIndex
CREATE INDEX "_PermissionSetToPosition_B_index" ON "_PermissionSetToPosition"("B");

-- AddForeignKey
ALTER TABLE "user_profile_photos" ADD CONSTRAINT "user_profile_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_personalPhotoId_fkey" FOREIGN KEY ("personalPhotoId") REFERENCES "user_profile_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_businessPhotoId_fkey" FOREIGN KEY ("businessPhotoId") REFERENCES "user_profile_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_townId_fkey" FOREIGN KEY ("townId") REFERENCES "towns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "towns" ADD CONSTRAINT "towns_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_serials" ADD CONSTRAINT "user_serials_townId_fkey" FOREIGN KEY ("townId") REFERENCES "towns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_references" ADD CONSTRAINT "file_references_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_references" ADD CONSTRAINT "file_references_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "read_receipts" ADD CONSTRAINT "read_receipts_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "read_receipts" ADD CONSTRAINT "read_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_headPositionId_fkey" FOREIGN KEY ("headPositionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_configs" ADD CONSTRAINT "sso_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_invitations" ADD CONSTRAINT "business_invitations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_invitations" ADD CONSTRAINT "business_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_members" ADD CONSTRAINT "institution_members_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "educational_institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_members" ADD CONSTRAINT "institution_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_invitations" ADD CONSTRAINT "institution_invitations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "educational_institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_invitations" ADD CONSTRAINT "institution_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_follows" ADD CONSTRAINT "business_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_follows" ADD CONSTRAINT "business_follows_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "educational_institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceSettings" ADD CONSTRAINT "ComplianceSettings_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Widget" ADD CONSTRAINT "Widget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_front_page_configs" ADD CONSTRAINT "business_front_page_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_front_widgets" ADD CONSTRAINT "business_front_widgets_configId_fkey" FOREIGN KEY ("configId") REFERENCES "business_front_page_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_front_page_customizations" ADD CONSTRAINT "user_front_page_customizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_front_page_customizations" ADD CONSTRAINT "user_front_page_customizations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_installations" ADD CONSTRAINT "module_installations_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_installations" ADD CONSTRAINT "module_installations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_module_installations" ADD CONSTRAINT "business_module_installations_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_module_installations" ADD CONSTRAINT "business_module_installations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_module_subscriptions" ADD CONSTRAINT "business_module_subscriptions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_module_subscriptions" ADD CONSTRAINT "business_module_subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "organizational_tiers" ADD CONSTRAINT "organizational_tiers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "organizational_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_sets" ADD CONSTRAINT "permission_sets_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_management_rights" ADD CONSTRAINT "permission_management_rights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_management_rights" ADD CONSTRAINT "permission_management_rights_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_management_rights" ADD CONSTRAINT "permission_management_rights_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_changes" ADD CONSTRAINT "permission_changes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_changes" ADD CONSTRAINT "permission_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_personality_profiles" ADD CONSTRAINT "ai_personality_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_autonomy_settings" ADD CONSTRAINT "ai_autonomy_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_approval_requests" ADD CONSTRAINT "ai_approval_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_history" ADD CONSTRAINT "ai_conversation_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_tracking" ADD CONSTRAINT "ai_usage_tracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_learning_events" ADD CONSTRAINT "ai_learning_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ab_test_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_versions" ADD CONSTRAINT "ai_model_versions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_deployments" ADD CONSTRAINT "ai_model_deployments_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_deployments" ADD CONSTRAINT "ai_model_deployments_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ai_model_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_experiments" ADD CONSTRAINT "ai_model_experiments_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_ab_tests" ADD CONSTRAINT "model_ab_tests_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ai_context" ADD CONSTRAINT "user_ai_context_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automl_trials" ADD CONSTRAINT "automl_trials_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "automl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "data_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_processors" ADD CONSTRAINT "stream_processors_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "data_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "analytics_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "forecasting_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "anomaly_detection_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ai_digital_twins" ADD CONSTRAINT "business_ai_digital_twins_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ai_interactions" ADD CONSTRAINT "business_ai_interactions_businessAIId_fkey" FOREIGN KEY ("businessAIId") REFERENCES "business_ai_digital_twins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ai_learning_events" ADD CONSTRAINT "business_ai_learning_events_businessAIId_fkey" FOREIGN KEY ("businessAIId") REFERENCES "business_ai_digital_twins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ai_usage_metrics" ADD CONSTRAINT "business_ai_usage_metrics_businessAIId_fkey" FOREIGN KEY ("businessAIId") REFERENCES "business_ai_digital_twins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_ai_context_registry" ADD CONSTRAINT "module_ai_context_registry_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ai_context_cache" ADD CONSTRAINT "user_ai_context_cache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_ai_performance_metrics" ADD CONSTRAINT "module_ai_performance_metrics_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_query_balances" ADD CONSTRAINT "ai_query_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_query_balances" ADD CONSTRAINT "ai_query_balances_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_query_purchases" ADD CONSTRAINT "ai_query_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_query_purchases" ADD CONSTRAINT "ai_query_purchases_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_query_purchases" ADD CONSTRAINT "ai_query_purchases_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "ai_query_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_pricingConfigId_fkey" FOREIGN KEY ("pricingConfigId") REFERENCES "pricing_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_subscriptions" ADD CONSTRAINT "module_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_subscriptions" ADD CONSTRAINT "module_subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_subscriptions" ADD CONSTRAINT "module_subscriptions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_subscriptions" ADD CONSTRAINT "module_subscriptions_coreSubscriptionId_fkey" FOREIGN KEY ("coreSubscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_moduleSubscriptionId_fkey" FOREIGN KEY ("moduleSubscriptionId") REFERENCES "module_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_moduleSubscriptionId_fkey" FOREIGN KEY ("moduleSubscriptionId") REFERENCES "module_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_revenue" ADD CONSTRAINT "developer_revenue_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_revenue" ADD CONSTRAINT "developer_revenue_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_parentEventId_fkey" FOREIGN KEY ("parentEventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attachments" ADD CONSTRAINT "event_attachments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_tokens" ADD CONSTRAINT "rsvp_tokens_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_permissions" ADD CONSTRAINT "file_permissions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_permissions" ADD CONSTRAINT "file_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_impersonations" ADD CONSTRAINT "admin_impersonations_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_impersonations" ADD CONSTRAINT "admin_impersonations_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_impersonations" ADD CONSTRAINT "admin_impersonations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminImpersonationId_fkey" FOREIGN KEY ("adminImpersonationId") REFERENCES "admin_impersonations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_violations" ADD CONSTRAINT "policy_violations_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "governance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "sso_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base_articles" ADD CONSTRAINT "knowledge_base_articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_sessions" ADD CONSTRAINT "live_chat_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_sessions" ADD CONSTRAINT "live_chat_sessions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employeePositionId_fkey" FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shift_templates" ADD CONSTRAINT "attendance_shift_templates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shift_templates" ADD CONSTRAINT "attendance_shift_templates_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shift_assignments" ADD CONSTRAINT "attendance_shift_assignments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shift_assignments" ADD CONSTRAINT "attendance_shift_assignments_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "attendance_shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shift_assignments" ADD CONSTRAINT "attendance_shift_assignments_employeePositionId_fkey" FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeePositionId_fkey" FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shiftAssignmentId_fkey" FOREIGN KEY ("shiftAssignmentId") REFERENCES "attendance_shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_employeePositionId_fkey" FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_detectedById_fkey" FOREIGN KEY ("detectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hr_profiles" ADD CONSTRAINT "employee_hr_profiles_employeePositionId_fkey" FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hr_profiles" ADD CONSTRAINT "employee_hr_profiles_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_approval_hierarchy" ADD CONSTRAINT "manager_approval_hierarchy_employeePositionId_fkey" FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_approval_hierarchy" ADD CONSTRAINT "manager_approval_hierarchy_managerPositionId_fkey" FOREIGN KEY ("managerPositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_approval_hierarchy" ADD CONSTRAINT "manager_approval_hierarchy_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_module_settings" ADD CONSTRAINT "hr_module_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_onboarding_templates" ADD CONSTRAINT "hr_onboarding_templates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_onboarding_task_templates" ADD CONSTRAINT "hr_onboarding_task_templates_onboardingTemplateId_fkey" FOREIGN KEY ("onboardingTemplateId") REFERENCES "hr_onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_onboarding_task_templates" ADD CONSTRAINT "hr_onboarding_task_templates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_onboarding_journeys" ADD CONSTRAINT "hr_employee_onboarding_journeys_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_onboarding_journeys" ADD CONSTRAINT "hr_employee_onboarding_journeys_employeeHrProfileId_fkey" FOREIGN KEY ("employeeHrProfileId") REFERENCES "employee_hr_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_onboarding_journeys" ADD CONSTRAINT "hr_employee_onboarding_journeys_onboardingTemplateId_fkey" FOREIGN KEY ("onboardingTemplateId") REFERENCES "hr_onboarding_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_onboarding_tasks" ADD CONSTRAINT "hr_employee_onboarding_tasks_onboardingJourneyId_fkey" FOREIGN KEY ("onboardingJourneyId") REFERENCES "hr_employee_onboarding_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_onboarding_tasks" ADD CONSTRAINT "hr_employee_onboarding_tasks_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_onboarding_tasks" ADD CONSTRAINT "hr_employee_onboarding_tasks_onboardingTaskTemplateId_fkey" FOREIGN KEY ("onboardingTaskTemplateId") REFERENCES "hr_onboarding_task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "job_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_employeePositionId_fkey" FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "job_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_availability" ADD CONSTRAINT "employee_availability_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_availability" ADD CONSTRAINT "employee_availability_employeePositionId_fkey" FOREIGN KEY ("employeePositionId") REFERENCES "employee_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_originalShiftId_fkey" FOREIGN KEY ("originalShiftId") REFERENCES "schedule_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requestedToId_fkey" FOREIGN KEY ("requestedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_stations" ADD CONSTRAINT "business_stations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_locations" ADD CONSTRAINT "job_locations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "task_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentRecurringTaskId_fkey" FOREIGN KEY ("parentRecurringTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_file_links" ADD CONSTRAINT "task_file_links_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_event_links" ADD CONSTRAINT "task_event_links_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_logs" ADD CONSTRAINT "task_time_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_logs" ADD CONSTRAINT "task_time_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionSetToPosition" ADD CONSTRAINT "_PermissionSetToPosition_A_fkey" FOREIGN KEY ("A") REFERENCES "permission_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionSetToPosition" ADD CONSTRAINT "_PermissionSetToPosition_B_fkey" FOREIGN KEY ("B") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

