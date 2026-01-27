#!/bin/bash

# Fix GCS Bucket Permissions for Profile Photos
# This script ensures the bucket is publicly readable for images

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get project ID
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}
if [ -z "$PROJECT_ID" ]; then
    print_error "No project ID set. Please set GOOGLE_CLOUD_PROJECT_ID or run:"
    echo "gcloud config set project PROJECT_ID"
    exit 1
fi

# Get bucket name (default to production bucket)
BUCKET_NAME=${GOOGLE_CLOUD_STORAGE_BUCKET:-"vssyl-storage-472202"}

print_status "Fixing GCS Bucket Permissions..."
print_status "Project: $PROJECT_ID"
print_status "Bucket: $BUCKET_NAME"
echo ""

# Check if bucket exists
if ! gsutil ls gs://$BUCKET_NAME &> /dev/null; then
    print_error "Bucket does not exist: $BUCKET_NAME"
    echo ""
    echo "To create the bucket, run:"
    echo "  ./scripts/setup-cloud-storage.sh $BUCKET_NAME"
    exit 1
fi

# Check uniform bucket-level access
print_status "Checking uniform bucket-level access..."
UNIFORM_ACCESS=$(gsutil uniformbucketlevelaccess get gs://$BUCKET_NAME 2>/dev/null | grep -i "enabled" || echo "disabled")

if echo "$UNIFORM_ACCESS" | grep -qi "enabled"; then
    print_status "Uniform bucket-level access is ENABLED"
    print_status "Setting bucket-level IAM policy for public access..."
    
    # Set bucket-level public access
    gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
    print_success "Bucket is now publicly readable (allUsers:objectViewer)"
else
    print_status "Uniform bucket-level access is DISABLED"
    print_warning "Individual files need to be made public"
    print_status "This is less secure - consider enabling uniform bucket-level access"
fi
echo ""

# Ensure profile-photos folder exists
print_status "Ensuring profile-photos folder exists..."
gsutil mkdir -p gs://$BUCKET_NAME/profile-photos 2>/dev/null || true
print_success "profile-photos folder ready"
echo ""

# Update CORS to include vssyl.com domain
print_status "Updating CORS configuration..."
cat > /tmp/cors.json << EOF
[
  {
    "origin": ["https://vssyl.com", "https://*.vssyl.com", "https://vssyl-web-*.run.app"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set /tmp/cors.json gs://$BUCKET_NAME
rm /tmp/cors.json
print_success "CORS configuration updated"
echo ""

# Verify the fix
print_status "Verifying public access..."
IAM_POLICY=$(gsutil iam get gs://$BUCKET_NAME 2>/dev/null || echo "")
if echo "$IAM_POLICY" | grep -q "allUsers.*objectViewer"; then
    print_success "✓ Bucket is publicly readable"
else
    print_error "✗ Bucket is still not publicly readable"
    exit 1
fi

echo ""
print_success "Bucket permissions fixed successfully!"
echo ""
echo "Summary:"
echo "- Bucket: $BUCKET_NAME"
echo "- Public Access: Enabled (allUsers:objectViewer)"
echo "- CORS: Configured for vssyl.com"
echo "- Profile Photos Folder: Ready"
echo ""
print_status "Profile photos should now be accessible publicly"
