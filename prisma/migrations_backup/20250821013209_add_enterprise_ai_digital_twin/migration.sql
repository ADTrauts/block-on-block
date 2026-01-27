-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "aiSettings" JSONB;

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

-- AddForeignKey
ALTER TABLE "business_ai_digital_twins" ADD CONSTRAINT "business_ai_digital_twins_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ai_interactions" ADD CONSTRAINT "business_ai_interactions_businessAIId_fkey" FOREIGN KEY ("businessAIId") REFERENCES "business_ai_digital_twins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ai_learning_events" ADD CONSTRAINT "business_ai_learning_events_businessAIId_fkey" FOREIGN KEY ("businessAIId") REFERENCES "business_ai_digital_twins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ai_usage_metrics" ADD CONSTRAINT "business_ai_usage_metrics_businessAIId_fkey" FOREIGN KEY ("businessAIId") REFERENCES "business_ai_digital_twins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
