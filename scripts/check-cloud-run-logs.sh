#!/bin/bash

# ==========================================
# Check Cloud Run Logs for Database Connection Issues
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

echo -e "${YELLOW}📋 Checking Cloud Run Logs${NC}"
echo "=========================================="
echo ""
echo "Service: ${SERVICE_NAME}"
echo "Region: ${GCP_REGION}"
echo "Project: ${GCP_PROJECT_ID}"
echo ""

# Check recent logs for database connection errors
echo -e "${YELLOW}Recent logs (last 50 lines)...${NC}"
echo ""

gcloud run services logs read "${SERVICE_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" 2>/dev/null || {
  echo -e "${RED}❌ Failed to read logs${NC}"
  echo ""
  echo "Try checking logs in Google Cloud Console:"
  echo "https://console.cloud.google.com/run/detail/${GCP_REGION}/${SERVICE_NAME}/logs?project=${GCP_PROJECT_ID}"
  exit 1
}

echo ""
echo -e "${YELLOW}To see more logs or filter for errors:${NC}"
echo "  gcloud run services logs read ${SERVICE_NAME} \\"
echo "    --project=${GCP_PROJECT_ID} \\"
echo "    --region=${GCP_REGION} \\"
echo "    --limit=100"
echo ""
echo "Or check in Google Cloud Console:"
echo "https://console.cloud.google.com/run/detail/${GCP_REGION}/${SERVICE_NAME}/logs?project=${GCP_PROJECT_ID}"
