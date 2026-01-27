-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "departmentModules" JSONB,
ADD COLUMN     "departmentPermissions" JSONB,
ADD COLUMN     "headPositionId" TEXT,
ADD COLUMN     "parentDepartmentId" TEXT;

-- AlterTable
ALTER TABLE "user_privacy_settings" ADD COLUMN     "allowCollectiveLearning" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "global_learning_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "context" TEXT NOT NULL,
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
CREATE TABLE "_PermissionSetToPosition" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PermissionSetToPosition_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "global_learning_events_userId_idx" ON "global_learning_events"("userId");

-- CreateIndex
CREATE INDEX "global_learning_events_eventType_idx" ON "global_learning_events"("eventType");

-- CreateIndex
CREATE INDEX "global_learning_events_context_idx" ON "global_learning_events"("context");

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
CREATE UNIQUE INDEX "rsvp_tokens_token_key" ON "rsvp_tokens"("token");

-- CreateIndex
CREATE INDEX "rsvp_tokens_token_idx" ON "rsvp_tokens"("token");

-- CreateIndex
CREATE INDEX "rsvp_tokens_eventId_idx" ON "rsvp_tokens"("eventId");

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
CREATE INDEX "_PermissionSetToPosition_B_index" ON "_PermissionSetToPosition"("B");

-- CreateIndex
CREATE INDEX "departments_parentDepartmentId_idx" ON "departments"("parentDepartmentId");

-- CreateIndex
CREATE INDEX "departments_headPositionId_idx" ON "departments"("headPositionId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_headPositionId_fkey" FOREIGN KEY ("headPositionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "sso_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_tokens" ADD CONSTRAINT "rsvp_tokens_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "_PermissionSetToPosition" ADD CONSTRAINT "_PermissionSetToPosition_A_fkey" FOREIGN KEY ("A") REFERENCES "permission_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionSetToPosition" ADD CONSTRAINT "_PermissionSetToPosition_B_fkey" FOREIGN KEY ("B") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
