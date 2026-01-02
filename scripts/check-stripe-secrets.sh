#!/bin/bash

# ==========================================
# Check if Stripe Secrets Exist in Google Cloud
# ==========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GCP_PROJECT_ID="vssyl-472202"

echo -e "${YELLOW}🔍 Checking for Stripe Secrets in Google Cloud${NC}"
echo "=========================================="
echo ""
echo "Project: ${GCP_PROJECT_ID}"
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
  echo -e "${RED}❌ Error: Not authenticated with gcloud${NC}"
  echo ""
  echo "Please run:"
  echo "  gcloud auth login"
  echo ""
  exit 1
fi

# Set project
gcloud config set project "${GCP_PROJECT_ID}" 2>/dev/null

echo -e "${YELLOW}Checking for Stripe secrets...${NC}"
echo ""

# Check stripe-secret-key
if gcloud secrets describe stripe-secret-key --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${GREEN}✅ stripe-secret-key exists${NC}"
  LATEST_VERSION=$(gcloud secrets versions list stripe-secret-key --project="${GCP_PROJECT_ID}" --limit=1 --format="value(name)" 2>/dev/null)
  echo "   Latest version: ${LATEST_VERSION}"
else
  echo -e "${RED}❌ stripe-secret-key does NOT exist${NC}"
fi

# Check stripe-publishable-key
if gcloud secrets describe stripe-publishable-key --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${GREEN}✅ stripe-publishable-key exists${NC}"
  LATEST_VERSION=$(gcloud secrets versions list stripe-publishable-key --project="${GCP_PROJECT_ID}" --limit=1 --format="value(name)" 2>/dev/null)
  echo "   Latest version: ${LATEST_VERSION}"
else
  echo -e "${RED}❌ stripe-publishable-key does NOT exist${NC}"
fi

# Check stripe-webhook-secret
if gcloud secrets describe stripe-webhook-secret --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${GREEN}✅ stripe-webhook-secret exists${NC}"
  LATEST_VERSION=$(gcloud secrets versions list stripe-webhook-secret --project="${GCP_PROJECT_ID}" --limit=1 --format="value(name)" 2>/dev/null)
  echo "   Latest version: ${LATEST_VERSION}"
else
  echo -e "${YELLOW}⚠️  stripe-webhook-secret does NOT exist (optional)${NC}"
fi

echo ""
echo -e "${YELLOW}All secrets in Secret Manager:${NC}"
gcloud secrets list --project="${GCP_PROJECT_ID}" --format="table(name,createTime)" | head -20

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
if gcloud secrets describe stripe-secret-key --project="${GCP_PROJECT_ID}" &>/dev/null && \
   gcloud secrets describe stripe-publishable-key --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${GREEN}✅ Stripe secrets are configured!${NC}"
  echo "   Your next deployment will use these secrets."
else
  echo -e "${RED}❌ Stripe secrets are missing${NC}"
  echo "   Run: ./scripts/setup-stripe-secrets-gcp.sh"
  echo "   to add your Stripe keys to Secret Manager"
fi
echo ""

