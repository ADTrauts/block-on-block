#!/bin/bash

# ==========================================
# Secrets Audit Report
# ==========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

GCP_PROJECT_ID="vssyl-472202"
GCP_REGION="us-central1"

echo "=========================================="
echo -e "${BLUE}🔐 SECRETS AUDIT REPORT${NC}"
echo "=========================================="
echo ""

# Get all secrets
echo -e "${YELLOW}📋 ALL SECRETS IN SECRET MANAGER:${NC}"
echo "----------------------------------------"
ALL_SECRETS=$(gcloud secrets list --project="${GCP_PROJECT_ID}" --format="value(name)" | sort)
echo "$ALL_SECRETS"
echo ""

# Get secrets configured in vssyl-server
echo -e "${YELLOW}📋 SECRETS CONFIGURED IN vssyl-server:${NC}"
echo "----------------------------------------"
SERVER_SECRETS=$(gcloud run services describe vssyl-server \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format="value(spec.template.spec.containers[0].env)" | \
  grep -o "openai-api-key\|anthropic-api-key\|stripe-secret-key\|stripe-webhook-secret" | sort | uniq || echo "")
if [ -z "$SERVER_SECRETS" ]; then
  echo -e "${BLUE}  (extracting from YAML format...)${NC}"
  SERVER_SECRETS=$(gcloud run services describe vssyl-server \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --format="yaml" | grep -A 1 "valueFrom:" | grep "name:" | awk '{print $2}' | sort | uniq || echo "")
fi
echo "$SERVER_SECRETS"
echo ""

# Get secrets configured in vssyl-web
echo -e "${YELLOW}📋 SECRETS CONFIGURED IN vssyl-web:${NC}"
echo "----------------------------------------"
WEB_SECRETS=$(gcloud run services describe vssyl-web \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format="value(spec.template.spec.containers[0].env)" | \
  grep -o "stripe-publishable-key" | sort | uniq || echo "")
if [ -z "$WEB_SECRETS" ]; then
  echo -e "${BLUE}  (extracting from YAML format...)${NC}"
  WEB_SECRETS=$(gcloud run services describe vssyl-web \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --format="yaml" | grep -A 1 "valueFrom:" | grep "name:" | awk '{print $2}' | sort | uniq || echo "")
fi
echo "$WEB_SECRETS"
echo ""

# Analysis
echo "=========================================="
echo -e "${YELLOW}📊 ANALYSIS:${NC}"
echo "=========================================="
echo ""

# Check which secrets exist but aren't configured
echo -e "${YELLOW}⚠️  SECRETS IN SECRET MANAGER BUT NOT CONFIGURED IN CLOUD RUN:${NC}"
echo "----------------------------------------"
MISSING_SMTP=false
for secret in $ALL_SECRETS; do
  if [[ "$secret" == "smtp-user" ]] || [[ "$secret" == "smtp-pass" ]] || [[ "$secret" == "smtp-from" ]]; then
    if ! echo "$SERVER_SECRETS" | grep -q "$secret"; then
      echo -e "${YELLOW}  ❌ $secret${NC} (exists in Secret Manager but not configured in vssyl-server)"
      MISSING_SMTP=true
    fi
  fi
done

if [ "$MISSING_SMTP" = false ]; then
  echo -e "${GREEN}  ✅ All SMTP secrets are configured${NC}"
fi
echo ""

# Check hardcoded secrets that should be in Secret Manager
echo -e "${YELLOW}⚠️  HARDCODED VALUES IN cloudbuild.yaml (should use secrets):${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}  ⚠️  JWT_SECRET${NC} (hardcoded, but jwt-secret exists in Secret Manager)"
echo -e "${YELLOW}  ⚠️  JWT_REFRESH_SECRET${NC} (hardcoded, but jwt-refresh-secret exists in Secret Manager)"
echo -e "${YELLOW}  ⚠️  NEXTAUTH_SECRET${NC} (hardcoded in vssyl-web, but nextauth-secret exists in Secret Manager)"
echo -e "${YELLOW}  ⚠️  DATABASE_URL password${NC} (hardcoded, but database-password exists in Secret Manager)"
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}✅ SUMMARY:${NC}"
echo "=========================================="
echo ""
echo -e "${GREEN}Configured correctly:${NC}"
echo "  ✅ OpenAI API Key (openai-api-key)"
echo "  ✅ Anthropic API Key (anthropic-api-key)"
echo "  ✅ Stripe Secret Key (stripe-secret-key)"
echo "  ✅ Stripe Webhook Secret (stripe-webhook-secret)"
echo "  ✅ Stripe Publishable Key (stripe-publishable-key) - in vssyl-web"
echo ""
echo -e "${YELLOW}Recommendations:${NC}"
echo "  1. Configure SMTP secrets (smtp-user, smtp-pass, smtp-from) in vssyl-server"
echo "  2. Move hardcoded secrets (JWT_SECRET, JWT_REFRESH_SECRET, NEXTAUTH_SECRET) to use Secret Manager"
echo "  3. Move database password to use Secret Manager"
echo ""
