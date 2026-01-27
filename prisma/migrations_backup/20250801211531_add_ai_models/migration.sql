-- CreateEnum
CREATE TYPE "AIRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "AIInteractionType" AS ENUM ('QUERY', 'ACTION_REQUEST', 'LEARNING', 'FEEDBACK', 'CORRECTION');

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
    "familyTimeOverride" BOOLEAN NOT NULL DEFAULT false,
    "sleepHoursOverride" BOOLEAN NOT NULL DEFAULT false,
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
CREATE INDEX "ai_learning_events_createdAt_idx" ON "ai_learning_events"("createdAt");

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
