#!/bin/bash

# ==========================================
# Setup Stripe Secrets in Google Cloud Secret Manager
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

echo -e "${YELLOW}🔐 Setup Stripe Secrets in Google Cloud${NC}"
echo "=========================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
  echo "Install it from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Set project
gcloud config set project "${GCP_PROJECT_ID}" 2>/dev/null || {
  echo -e "${RED}❌ Error: Failed to set project${NC}"
  exit 1
}

echo "Project: ${GCP_PROJECT_ID}"
echo "Region: ${GCP_REGION}"
echo ""

# Prompt for Stripe keys
echo -e "${YELLOW}Enter your Stripe keys:${NC}"
echo ""

read -p "Stripe Secret Key (sk_live_... or sk_test_...): " STRIPE_SECRET_KEY
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo -e "${RED}❌ Error: Stripe Secret Key is required${NC}"
  exit 1
fi

read -p "Stripe Publishable Key (pk_live_... or pk_test_...): " STRIPE_PUBLISHABLE_KEY
if [ -z "$STRIPE_PUBLISHABLE_KEY" ]; then
  echo -e "${RED}❌ Error: Stripe Publishable Key is required${NC}"
  exit 1
fi

read -p "Stripe Webhook Secret (whsec_...): " STRIPE_WEBHOOK_SECRET
if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo -e "${YELLOW}⚠️  Warning: Webhook secret is optional but recommended${NC}"
  echo "You can add it later by running this script again"
fi

echo ""
echo -e "${YELLOW}Step 1: Creating secrets in Secret Manager...${NC}"

# Create stripe-secret-key secret
if gcloud secrets describe stripe-secret-key --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${YELLOW}⚠️  stripe-secret-key already exists, adding new version...${NC}"
  echo -n "${STRIPE_SECRET_KEY}" | gcloud secrets versions add stripe-secret-key \
    --project="${GCP_PROJECT_ID}" \
    --data-file=- 2>/dev/null || {
    echo -e "${RED}❌ Failed to update stripe-secret-key${NC}"
    exit 1
  }
else
  echo -n "${STRIPE_SECRET_KEY}" | gcloud secrets create stripe-secret-key \
    --project="${GCP_PROJECT_ID}" \
    --data-file=- 2>/dev/null || {
    echo -e "${RED}❌ Failed to create stripe-secret-key${NC}"
    exit 1
  }
fi
echo -e "${GREEN}✅ stripe-secret-key secret created/updated${NC}"

# Create stripe-publishable-key secret
if gcloud secrets describe stripe-publishable-key --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo -e "${YELLOW}⚠️  stripe-publishable-key already exists, adding new version...${NC}"
  echo -n "${STRIPE_PUBLISHABLE_KEY}" | gcloud secrets versions add stripe-publishable-key \
    --project="${GCP_PROJECT_ID}" \
    --data-file=- 2>/dev/null || {
    echo -e "${RED}❌ Failed to update stripe-publishable-key${NC}"
    exit 1
  }
else
  echo -n "${STRIPE_PUBLISHABLE_KEY}" | gcloud secrets create stripe-publishable-key \
    --project="${GCP_PROJECT_ID}" \
    --data-file=- 2>/dev/null || {
    echo -e "${RED}❌ Failed to create stripe-publishable-key${NC}"
    exit 1
  }
fi
echo -e "${GREEN}✅ stripe-publishable-key secret created/updated${NC}"

# Create stripe-webhook-secret secret (if provided)
if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  if gcloud secrets describe stripe-webhook-secret --project="${GCP_PROJECT_ID}" &>/dev/null; then
    echo -e "${YELLOW}⚠️  stripe-webhook-secret already exists, adding new version...${NC}"
    echo -n "${STRIPE_WEBHOOK_SECRET}" | gcloud secrets versions add stripe-webhook-secret \
      --project="${GCP_PROJECT_ID}" \
      --data-file=- 2>/dev/null || {
      echo -e "${RED}❌ Failed to update stripe-webhook-secret${NC}"
      exit 1
    }
  else
    echo -n "${STRIPE_WEBHOOK_SECRET}" | gcloud secrets create stripe-webhook-secret \
      --project="${GCP_PROJECT_ID}" \
      --data-file=- 2>/dev/null || {
      echo -e "${RED}❌ Failed to create stripe-webhook-secret${NC}"
      exit 1
    }
  fi
  echo -e "${GREEN}✅ stripe-webhook-secret secret created/updated${NC}"
fi

echo ""
echo -e "${GREEN}✅ All Stripe secrets created successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update cloudbuild.yaml to include Stripe secrets in --set-secrets"
echo "2. Redeploy your services to apply the secrets"
echo ""
echo -e "${YELLOW}To update Cloud Run services manually:${NC}"
echo ""
echo "# Update server service"
echo "gcloud run services update vssyl-server \\"
echo "  --project=${GCP_PROJECT_ID} \\"
echo "  --region=${GCP_REGION} \\"
echo "  --update-secrets=STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest"
echo ""
echo "# Update web service"
echo "gcloud run services update vssyl-web \\"
echo "  --project=${GCP_PROJECT_ID} \\"
echo "  --region=${GCP_REGION} \\"
echo "  --update-env-vars=NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=\$(gcloud secrets versions access latest --secret=stripe-publishable-key --project=${GCP_PROJECT_ID})"
echo ""

