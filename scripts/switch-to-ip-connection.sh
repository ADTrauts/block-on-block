#!/bin/bash

# ==========================================
# Switch to IP Address Connection (Temporary Fix)
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
SECRET_NAME="database-url"

echo -e "${YELLOW}🔄 Switching to IP Address Connection${NC}"
echo "=========================================="
echo ""
echo -e "${GREEN}Using IP address connection (required for this setup)${NC}"
echo "This is the correct connection method when Unix sockets aren't available."
echo ""

# Version 2 value (IP address)
IP_CONNECTION="postgresql://vssyl_user:ArthurGeorge116%21@172.30.0.15:5432/vssyl_production?connection_limit=20&pool_timeout=20"

echo -e "${YELLOW}Step 1: Adding new version with IP connection...${NC}"
echo -n "${IP_CONNECTION}" | gcloud secrets versions add "${SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --data-file=- 2>/dev/null || {
  echo -e "${RED}❌ Failed to add new version${NC}"
  exit 1
}

echo -e "${GREEN}✅ New version created${NC}"

# Verify it's now the latest
NEW_LATEST=$(gcloud secrets versions list "${SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --limit=1 \
  --format="value(name)" 2>/dev/null)

echo -e "${GREEN}✅ New latest version: ${NEW_LATEST}${NC}"
echo ""

echo -e "${YELLOW}Step 2: Next steps${NC}"
echo "=========================================="
echo ""
echo "1. The IP connection version is now 'latest'"
echo "2. Redeploy Cloud Run to pick up the new secret:"
echo ""
echo "   Option A: Push to git (triggers Cloud Build):"
echo "     git push origin main"
echo ""
echo "   Option B: Manually update Cloud Run:"
echo "     gcloud run services update vssyl-server \\"
echo "       --project=${GCP_PROJECT_ID} \\"
echo "       --region=us-central1"
echo ""
echo -e "${GREEN}✅ IP connection is now configured as the primary method${NC}"
echo ""
