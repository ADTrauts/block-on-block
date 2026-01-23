#!/bin/bash

# ==========================================
# Force Cloud Run to Redeploy and Pick Up Latest Secrets
# ==========================================

set -e

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

echo -e "${YELLOW}🚀 Redeploying Cloud Run Service${NC}"
echo "=========================================="
echo ""
echo "Service: ${SERVICE_NAME}"
echo "Region: ${GCP_REGION}"
echo "Project: ${GCP_PROJECT_ID}"
echo ""

# Update Cloud Run service (this will force it to pick up latest secrets)
echo -e "${YELLOW}Updating Cloud Run service to pick up latest secrets...${NC}"
gcloud run services update "${SERVICE_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --no-traffic \
  --tag=latest-secret-update || {
  echo -e "${RED}❌ Failed to update Cloud Run service${NC}"
  exit 1
}

echo ""
echo -e "${GREEN}✅ Cloud Run service updated${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Check Cloud Run logs to verify the database connection works"
echo "2. If successful, gradually shift traffic to the new revision"
echo ""
echo "To check logs:"
echo "  gcloud run services logs read ${SERVICE_NAME} \\"
echo "    --project=${GCP_PROJECT_ID} \\"
echo "    --region=${GCP_REGION} \\"
echo "    --limit=50"
echo ""
