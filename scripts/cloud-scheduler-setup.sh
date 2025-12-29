#!/bin/bash

##############################################################################
# GOOGLE CLOUD SCHEDULER SETUP
# 
# This script creates a Cloud Scheduler job that runs nightly to sync
# the Module AI Context Registry.
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Project ID set (gcloud config set project vssyl-472202)
# - Cloud Scheduler API enabled
# - Service account with proper permissions
##############################################################################

set -e

PROJECT_ID="vssyl-472202"
REGION="us-central1"
SERVICE_URL="https://vssyl-server-235369681725.us-central1.run.app"

echo "🔧 Setting up Cloud Scheduler for Module Registry Sync"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service URL: $SERVICE_URL"
echo ""

# Enable Cloud Scheduler API if not already enabled
echo "📦 Ensuring Cloud Scheduler API is enabled..."
gcloud services enable cloudscheduler.googleapis.com --project=$PROJECT_ID || true

# Create service account for Cloud Scheduler if it doesn't exist
echo "🔐 Checking service account..."
SERVICE_ACCOUNT="cloud-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT --project=$PROJECT_ID &>/dev/null; then
  echo "Creating service account: $SERVICE_ACCOUNT"
  gcloud iam service-accounts create cloud-scheduler \
    --display-name="Cloud Scheduler Service Account" \
    --project=$PROJECT_ID
else
  echo "Service account already exists: $SERVICE_ACCOUNT"
fi

# Grant necessary permissions to invoke Cloud Run
echo "🔑 Granting Cloud Run Invoker role..."
gcloud run services add-iam-policy-binding vssyl-server \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" \
  --region=$REGION \
  --project=$PROJECT_ID || true

# Create or update the scheduled job
echo "⏰ Creating Cloud Scheduler job..."

JOB_NAME="module-registry-sync"
SCHEDULE="0 3 * * *"  # Run at 3:00 AM daily
TIMEZONE="America/Chicago"
ENDPOINT="${SERVICE_URL}/api/admin/modules/ai/sync"

# Check if job exists
if gcloud scheduler jobs describe $JOB_NAME --location=$REGION --project=$PROJECT_ID &>/dev/null; then
  echo "Job already exists, updating..."
  gcloud scheduler jobs update http $JOB_NAME \
    --location=$REGION \
    --schedule="$SCHEDULE" \
    --uri="$ENDPOINT" \
    --http-method=POST \
    --time-zone="$TIMEZONE" \
    --oidc-service-account-email="$SERVICE_ACCOUNT" \
    --oidc-token-audience="$ENDPOINT" \
    --project=$PROJECT_ID
else
  echo "Creating new job..."
  gcloud scheduler jobs create http $JOB_NAME \
    --location=$REGION \
    --schedule="$SCHEDULE" \
    --uri="$ENDPOINT" \
    --http-method=POST \
    --time-zone="$TIMEZONE" \
    --oidc-service-account-email="$SERVICE_ACCOUNT" \
    --oidc-token-audience="$ENDPOINT" \
    --project=$PROJECT_ID
fi

echo ""
echo "✅ Cloud Scheduler setup complete!"
echo ""
echo "📋 Job Details:"
echo "   Name: $JOB_NAME"
echo "   Schedule: $SCHEDULE ($TIMEZONE)"
echo "   Endpoint: $ENDPOINT"
echo "   Next run: Run 'gcloud scheduler jobs describe $JOB_NAME --location=$REGION' to see"
echo ""
echo "🧪 Test the job manually:"
echo "   gcloud scheduler jobs run $JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo ""
echo "📊 View job logs:"
echo "   gcloud logging read 'resource.type=cloud_scheduler_job AND resource.labels.job_id=$JOB_NAME' --limit=50 --format=json --project=$PROJECT_ID"
echo ""

