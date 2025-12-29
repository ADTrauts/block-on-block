#!/bin/bash

# ==========================================
# Pull Secrets from Google Cloud Secret Manager for Local Development
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
SERVER_ENV_FILE="server/.env"

echo -e "${YELLOW}🔐 Pull Secrets for Local Development${NC}"
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

# Check if server/.env exists
if [ ! -f "$SERVER_ENV_FILE" ]; then
  echo -e "${YELLOW}⚠️  $SERVER_ENV_FILE not found. Creating it...${NC}"
  touch "$SERVER_ENV_FILE"
  echo -e "${GREEN}✅ Created $SERVER_ENV_FILE${NC}"
  echo ""
fi

# Function to pull a secret and add to .env
pull_secret() {
  local SECRET_NAME=$1
  local ENV_VAR_NAME=$2
  
  echo -e "${BLUE}Pulling ${SECRET_NAME}...${NC}"
  
  # Check if secret exists
  if ! gcloud secrets describe "$SECRET_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
    echo -e "${YELLOW}⚠️  Secret ${SECRET_NAME} not found in Secret Manager${NC}"
    echo "   Skipping..."
    return 1
  fi
  
  # Get the secret value
  SECRET_VALUE=$(gcloud secrets versions access latest \
    --secret="$SECRET_NAME" \
    --project="$GCP_PROJECT_ID" 2>/dev/null)
  
  if [ -z "$SECRET_VALUE" ]; then
    echo -e "${RED}❌ Failed to retrieve ${SECRET_NAME}${NC}"
    return 1
  fi
  
  # Remove existing line if it exists
  if grep -q "^${ENV_VAR_NAME}=" "$SERVER_ENV_FILE"; then
    # Use sed to update the line (works on macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "/^${ENV_VAR_NAME}=/d" "$SERVER_ENV_FILE"
    else
      sed -i "/^${ENV_VAR_NAME}=/d" "$SERVER_ENV_FILE"
    fi
  fi
  
  # Append the new value
  echo "${ENV_VAR_NAME}=${SECRET_VALUE}" >> "$SERVER_ENV_FILE"
  
  echo -e "${GREEN}✅ Added ${ENV_VAR_NAME} to ${SERVER_ENV_FILE}${NC}"
  return 0
}

# Pull OpenAI API Key
echo -e "${YELLOW}Step 1: Pulling OpenAI API Key...${NC}"
pull_secret "openai-api-key" "OPENAI_API_KEY"
echo ""

# Pull Anthropic API Key (optional)
echo -e "${YELLOW}Step 2: Pulling Anthropic API Key (optional)...${NC}"
pull_secret "anthropic-api-key" "ANTHROPIC_API_KEY"
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}🎉 Secrets Pulled Successfully!${NC}"
echo ""
echo "Updated file: ${SERVER_ENV_FILE}"
echo ""
echo "Next steps:"
echo "1. Restart your development server:"
echo "   pnpm dev"
echo ""
echo "2. The warning should now be gone!"
echo ""
echo -e "${YELLOW}⚠️  Note: This script pulls secrets for local development only.${NC}"
echo "   Production uses Secret Manager automatically via Cloud Run."
echo ""

