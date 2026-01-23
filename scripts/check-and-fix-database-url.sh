#!/bin/bash

# ==========================================
# Check and Fix database-url Secret
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

echo -e "${YELLOW}🔍 Checking database-url Secret${NC}"
echo "=========================================="
echo ""

# Check current latest version
echo -e "${YELLOW}Step 1: Checking current latest version...${NC}"
LATEST_VERSION=$(gcloud secrets versions list "${SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --limit=1 \
  --format="value(name)" 2>/dev/null)

if [ -z "$LATEST_VERSION" ]; then
  echo -e "${RED}❌ Could not find latest version${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Latest version: ${LATEST_VERSION}${NC}"

# Get the actual value of the latest version
echo ""
echo -e "${YELLOW}Step 2: Checking latest version value...${NC}"
LATEST_VALUE=$(gcloud secrets versions access latest \
  --secret="${SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}" 2>/dev/null)

if [ -z "$LATEST_VALUE" ]; then
  echo -e "${RED}❌ Could not access latest version value${NC}"
  exit 1
fi

# Show first 100 characters (without password)
SAFE_VALUE=$(echo "$LATEST_VALUE" | sed 's/:[^@]*@/:***@/')
echo -e "${BLUE}Current latest value: ${SAFE_VALUE:0:100}...${NC}"

# Check if it has the correct format
echo ""
echo -e "${YELLOW}Step 3: Validating format...${NC}"

if [[ "$LATEST_VALUE" == *"host=/cloudsql/vssyl-472202:us-central1:vssyl-db-optimized"* ]] && \
   [[ "$LATEST_VALUE" == *"connection_limit=20"* ]]; then
  echo -e "${GREEN}✅ Latest version has correct format (Unix socket, connection_limit=20)${NC}"
  echo ""
  echo -e "${GREEN}The secret is correctly configured!${NC}"
  echo ""
  echo "If you're still seeing errors, try:"
  echo "1. Redeploy Cloud Run service to pick up the secret"
  echo "2. Check Cloud Run logs for the actual error"
  exit 0
else
  echo -e "${YELLOW}⚠️  Latest version does not have the optimal format${NC}"
  echo ""
  echo -e "${YELLOW}Step 4: Creating new version with correct format...${NC}"
  
  # The correct value (Version 3)
  CORRECT_VALUE="postgresql://vssyl_user:ArthurGeorge116%21@/vssyl_production?host=/cloudsql/vssyl-472202:us-central1:vssyl-db-optimized&connection_limit=20&pool_timeout=20"
  
  echo -n "${CORRECT_VALUE}" | gcloud secrets versions add "${SECRET_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --data-file=- 2>/dev/null || {
    echo -e "${RED}❌ Failed to add new version${NC}"
    exit 1
  }
  
  echo -e "${GREEN}✅ New version created successfully${NC}"
  
  # Verify it's now the latest
  NEW_LATEST=$(gcloud secrets versions list "${SECRET_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --limit=1 \
    --format="value(name)" 2>/dev/null)
  
  echo -e "${GREEN}✅ New latest version: ${NEW_LATEST}${NC}"
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "1. The new version is now the 'latest' version"
  echo "2. Cloud Run will use it on the next deployment"
  echo "3. To force immediate update, redeploy Cloud Run service:"
  echo ""
  echo "   gcloud run services update vssyl-server \\"
  echo "     --project=${GCP_PROJECT_ID} \\"
  echo "     --region=us-central1"
  echo ""
fi
