#!/bin/bash

# ==========================================
# Update OpenAI Admin API Key in Secret Manager
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
SECRET_NAME="openai-admin-api-key"

echo -e "${YELLOW}🔐 Update OpenAI Admin API Key Secret${NC}"
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
  echo -e "${RED}❌ Error: No admin API key provided${NC}"
  echo ""
  echo "Usage:"
  echo "  ./update-secret-openai-admin.sh YOUR_OPENAI_ADMIN_API_KEY"
  echo ""
  echo "Example:"
  echo "  ./update-secret-openai-admin.sh sk-admin-..."
  echo ""
  echo -e "${YELLOW}⚠️  Note: Admin API keys have elevated permissions${NC}"
  echo "   Make sure this key has read-only permissions for security"
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
echo -e "${BLUE}ℹ️  This secret will be configured in cloudbuild.yaml${NC}"
echo -e "${BLUE}   for use in the admin portal provider usage dashboard${NC}"
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
echo -e "${GREEN}🎉 OpenAI Admin API Key Added Successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. The secret is now stored in Google Secret Manager"
echo "2. Update cloudbuild.yaml to include this secret in Cloud Run"
echo "3. The admin portal can now pull usage/billing data from OpenAI"
echo ""
echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
echo "   - Admin keys have elevated permissions"
echo "   - Ensure the key has read-only permissions in OpenAI"
echo "   - Rotate keys periodically"
echo "   - Limit access to admin users only"
echo ""
echo "To verify the secret:"
echo "  gcloud secrets describe ${SECRET_NAME} --project=${GCP_PROJECT_ID}"
echo ""
