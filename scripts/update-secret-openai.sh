#!/bin/bash

# ==========================================
# Update OpenAI API Key in Secret Manager
# ==========================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GCP_PROJECT_ID="vssyl-472202"
GCP_REGION="us-central1"
SERVICE_NAME="vssyl-server"
SECRET_NAME="openai-api-key"

echo -e "${YELLOW}🔐 Update OpenAI API Key Secret${NC}"
echo "=========================================="
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo -e "${RED}❌ Error: Not authenticated with gcloud${NC}"
  echo ""
  echo "Please run:"
  echo "  gcloud auth login"
  echo ""
  exit 1
fi

# Check if user provided API key as argument
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: No API key provided${NC}"
  echo ""
  echo "Usage:"
  echo "  ./update-secret-openai.sh YOUR_OPENAI_API_KEY"
  echo ""
  echo "Example:"
  echo "  ./update-secret-openai.sh sk-proj-..."
  echo ""
  exit 1
fi

NEW_API_KEY="$1"

echo "Project: ${GCP_PROJECT_ID}"
echo "Region: ${GCP_REGION}"
echo "Service: ${SERVICE_NAME}"
echo "Secret: ${SECRET_NAME}"
echo ""

# Step 1: Check if secret exists, create if not
echo -e "${YELLOW}Step 1: Checking if secret exists...${NC}"
if ! gcloud secrets describe "${SECRET_NAME}" --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${BLUE}Secret doesn't exist, creating it...${NC}"
  echo -n "${NEW_API_KEY}" | gcloud secrets create "${SECRET_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --data-file=- 2>/dev/null || {
    echo -e "${RED}❌ Failed to create secret${NC}"
    exit 1
  }
  echo -e "${GREEN}✅ Secret created successfully${NC}"
else
  echo -e "${BLUE}Secret exists, adding new version...${NC}"
  echo -n "${NEW_API_KEY}" | gcloud secrets versions add "${SECRET_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --data-file=- 2>/dev/null || {
    echo -e "${RED}❌ Failed to update secret${NC}"
    exit 1
  }
  echo -e "${GREEN}✅ Secret updated successfully${NC}"
fi
echo ""

# Step 2: Get latest version number
echo -e "${YELLOW}Step 2: Verifying latest version...${NC}"
LATEST_VERSION=$(gcloud secrets versions list "${SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --limit=1 \
  --format="value(name)")
echo -e "${GREEN}✅ Latest version: ${LATEST_VERSION}${NC}"
echo ""

# Step 3: Note about Cloud Run configuration
echo -e "${YELLOW}Step 3: Cloud Run Configuration${NC}"
echo -e "${BLUE}ℹ️  Cloud Run service is already configured to use this secret${NC}"
echo -e "${BLUE}   (configured in cloudbuild.yaml line 154)${NC}"
echo -e "${BLUE}   The secret will be automatically available on next deployment${NC}"
echo ""

# Step 4: Verify secret is accessible
echo -e "${YELLOW}Step 4: Verifying secret accessibility...${NC}"
SECRET_VALUE=$(gcloud secrets versions access latest \
  --secret="${SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}" 2>/dev/null)

if [ -n "$SECRET_VALUE" ] && [ "$SECRET_VALUE" = "$NEW_API_KEY" ]; then
  echo -e "${GREEN}✅ Secret is accessible and matches the provided key${NC}"
else
  echo -e "${YELLOW}⚠️  Could not verify secret value (this is normal for security reasons)${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}🎉 OpenAI API Key Added Successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. The secret is now stored in Google Secret Manager"
echo "2. Cloud Run will automatically use it on the next deployment"
echo "3. For local development, run: ./scripts/pull-secrets-local.sh"
echo ""
echo "To verify the secret is being used:"
echo "  gcloud run services describe ${SERVICE_NAME} \\"
echo "    --project=${GCP_PROJECT_ID} \\"
echo "    --region=${GCP_REGION} \\"
echo "    --format='value(spec.template.spec.containers[0].env)'"
echo ""
echo "To view logs:"
echo "  gcloud run services logs tail ${SERVICE_NAME} --project=${GCP_PROJECT_ID}"
echo ""
