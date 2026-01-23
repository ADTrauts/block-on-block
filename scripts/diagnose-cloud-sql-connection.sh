#!/bin/bash

# ==========================================
# Diagnose Cloud SQL Connection Issues
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
CLOUD_SQL_INSTANCE="vssyl-472202:us-central1:vssyl-db-optimized"

echo -e "${YELLOW}🔍 Diagnosing Cloud SQL Connection${NC}"
echo "=========================================="
echo ""

# Step 1: Check Cloud SQL instance exists
echo -e "${YELLOW}Step 1: Checking Cloud SQL instance...${NC}"
if gcloud sql instances describe vssyl-db-optimized \
  --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${GREEN}✅ Cloud SQL instance exists${NC}"
  
  # Get instance status
  INSTANCE_STATUS=$(gcloud sql instances describe vssyl-db-optimized \
    --project="${GCP_PROJECT_ID}" \
    --format="value(state)" 2>/dev/null)
  echo "   Status: ${INSTANCE_STATUS}"
  
  if [ "$INSTANCE_STATUS" != "RUNNABLE" ]; then
    echo -e "${RED}⚠️  Instance is not RUNNABLE - this could cause connection issues${NC}"
  fi
else
  echo -e "${RED}❌ Cloud SQL instance not found${NC}"
  exit 1
fi

echo ""

# Step 2: Check Cloud Run service configuration
echo -e "${YELLOW}Step 2: Checking Cloud Run service configuration...${NC}"
CLOUD_SQL_CONFIG=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format="value(spec.template.spec.containers[0].env)" 2>/dev/null | grep -i cloudsql || echo "")

if gcloud run services describe "${SERVICE_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format="value(spec.template.spec.containers[0].cloudSqlInstances)" 2>/dev/null | grep -q "${CLOUD_SQL_INSTANCE}"; then
  echo -e "${GREEN}✅ Cloud SQL instance is configured in Cloud Run${NC}"
else
  echo -e "${RED}❌ Cloud SQL instance NOT configured in Cloud Run${NC}"
  echo ""
  echo "To fix, redeploy with:"
  echo "  --add-cloudsql-instances ${CLOUD_SQL_INSTANCE}"
fi

echo ""

# Step 3: Check service account permissions
echo -e "${YELLOW}Step 3: Checking service account permissions...${NC}"
SERVICE_ACCOUNT=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null)

if [ -z "$SERVICE_ACCOUNT" ]; then
  SERVICE_ACCOUNT="${GCP_PROJECT_ID}@appspot.gserviceaccount.com"
  echo "   Using default service account: ${SERVICE_ACCOUNT}"
else
  echo "   Service account: ${SERVICE_ACCOUNT}"
fi

# Check if service account has Cloud SQL Client role
HAS_CLOUD_SQL_CLIENT=$(gcloud projects get-iam-policy "${GCP_PROJECT_ID}" \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT}" \
  --format="value(bindings.role)" 2>/dev/null | grep -i "cloudsql.client" || echo "")

if [ -n "$HAS_CLOUD_SQL_CLIENT" ]; then
  echo -e "${GREEN}✅ Service account has Cloud SQL Client role${NC}"
else
  echo -e "${RED}❌ Service account missing Cloud SQL Client role${NC}"
  echo ""
  echo "To fix, run:"
  echo "  gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \\"
  echo "    --member=\"serviceAccount:${SERVICE_ACCOUNT}\" \\"
  echo "    --role=\"roles/cloudsql.client\""
fi

echo ""

# Step 4: Check if we can access the secret
echo -e "${YELLOW}Step 4: Checking database URL secret...${NC}"
if gcloud secrets describe database-url --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${GREEN}✅ database-url secret exists${NC}"
  
  # Check if service account can access it
  SECRET_ACCESS=$(gcloud secrets get-iam-policy database-url \
    --project="${GCP_PROJECT_ID}" \
    --format="value(bindings.members)" 2>/dev/null | grep -i "${SERVICE_ACCOUNT}" || echo "")
  
  if [ -n "$SECRET_ACCESS" ]; then
    echo -e "${GREEN}✅ Service account has access to secret${NC}"
  else
    echo -e "${YELLOW}⚠️  Service account access to secret not explicitly granted (may use default permissions)${NC}"
  fi
else
  echo -e "${RED}❌ database-url secret not found${NC}"
fi

echo ""

# Step 5: Summary and recommendations
echo -e "${YELLOW}📋 Summary and Recommendations${NC}"
echo "=========================================="
echo ""
echo "If connection is still failing, try:"
echo ""
echo "1. Switch to IP address connection (temporary workaround):"
echo "   - Update database-url secret to use Version 2 (IP address)"
echo "   - This doesn't require Unix socket setup"
echo ""
echo "2. Verify Cloud SQL instance allows connections:"
echo "   gcloud sql instances describe vssyl-db-optimized \\"
echo "     --project=${GCP_PROJECT_ID}"
echo ""
echo "3. Check Cloud Run logs for detailed error:"
echo "   gcloud run services logs read ${SERVICE_NAME} \\"
echo "     --project=${GCP_PROJECT_ID} \\"
echo "     --region=${GCP_REGION} \\"
echo "     --limit=50"
echo ""
echo "4. Test connection from Cloud Run (if possible):"
echo "   - The validation code in prisma.ts should show detailed errors"
echo ""
