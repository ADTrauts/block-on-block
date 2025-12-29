#!/bin/bash

# ==========================================
# Update VirusTotal API Key in Secret Manager
# ==========================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GCP_PROJECT_ID="vssyl-472202"
GCP_REGION="us-central1"
SERVICE_NAME="vssyl-server"
SECRET_NAME="virustotal-api-key"

echo -e "${YELLOW}🔐 Update VirusTotal API Key Secret${NC}"
echo "=========================================="
echo ""

# Check if user provided API key as argument
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: No API key provided${NC}"
  echo ""
  echo "Usage:"
  echo "  ./update-secret-virustotal.sh YOUR_NEW_API_KEY"
  echo ""
  echo "Example:"
  echo "  ./update-secret-virustotal.sh abc123def456..."
  echo ""
  exit 1
fi

NEW_API_KEY="$1"

echo "Project: ${GCP_PROJECT_ID}"
echo "Region: ${GCP_REGION}"
echo "Service: ${SERVICE_NAME}"
echo "Secret: ${SECRET_NAME}"
echo ""

# Step 1: Update secret
echo -e "${YELLOW}Step 1: Updating secret in Secret Manager...${NC}"
echo -n "${NEW_API_KEY}" | gcloud secrets versions add "${SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --data-file=- 2>/dev/null || {
  echo -e "${RED}❌ Failed to update secret${NC}"
  exit 1
}
echo -e "${GREEN}✅ Secret updated successfully${NC}"
echo ""

# Step 2: Get latest version number
echo -e "${YELLOW}Step 2: Verifying latest version...${NC}"
LATEST_VERSION=$(gcloud secrets versions list "${SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --limit=1 \
  --format="value(name)")
echo -e "${GREEN}✅ Latest version: ${LATEST_VERSION}${NC}"
echo ""

# Step 3: Update Cloud Run service
echo -e "${YELLOW}Step 3: Updating Cloud Run service...${NC}"
gcloud run services update "${SERVICE_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --update-secrets=VIRUSTOTAL_API_KEY="${SECRET_NAME}:latest" || {
  echo -e "${RED}❌ Failed to update Cloud Run service${NC}"
  exit 1
}
echo -e "${GREEN}✅ Cloud Run service updated${NC}"
echo ""

# Step 4: Wait for deployment
echo -e "${YELLOW}Step 4: Waiting for deployment to complete...${NC}"
sleep 5
echo -e "${GREEN}✅ Deployment should be complete${NC}"
echo ""

# Step 5: Verify
echo -e "${YELLOW}Step 5: Verifying configuration...${NC}"
echo "Checking if service is using the secret..."
gcloud run services describe "${SERVICE_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format="value(spec.template.spec.containers[0].env)" | \
  grep -q "VIRUSTOTAL_API_KEY" && \
  echo -e "${GREEN}✅ Service is configured to use VIRUSTOTAL_API_KEY${NC}" || \
  echo -e "${YELLOW}⚠️  Could not verify secret configuration${NC}"
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}🎉 Update Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test module submission in the admin portal"
echo "2. Check Security Dashboard for scan results"
echo "3. Monitor Cloud Run logs for any errors"
echo ""
echo "To view logs:"
echo "  gcloud run services logs tail ${SERVICE_NAME} --project=${GCP_PROJECT_ID}"
echo ""

