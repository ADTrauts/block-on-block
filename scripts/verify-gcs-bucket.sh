#!/bin/bash

# Verify and Fix GCS Bucket Configuration for Vssyl
# This script checks if the bucket is properly configured for profile photos

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

# Get bucket name
BUCKET_NAME=${GOOGLE_CLOUD_STORAGE_BUCKET:-"vssyl-storage-472202"}

print_status "Verifying GCS Bucket Configuration..."
print_status "Project: $PROJECT_ID"
print_status "Bucket: $BUCKET_NAME"
echo ""

# Check if bucket exists
print_status "Checking if bucket exists..."
if ! gsutil ls gs://$BUCKET_NAME &> /dev/null; then
    print_error "Bucket does not exist: $BUCKET_NAME"
    echo ""
    echo "To create the bucket, run:"
    echo "  ./scripts/setup-cloud-storage.sh $BUCKET_NAME"
    exit 1
fi
print_success "Bucket exists: $BUCKET_NAME"
echo ""

# Check uniform bucket-level access
print_status "Checking uniform bucket-level access..."
UNIFORM_ACCESS=$(gsutil uniformbucketlevelaccess get gs://$BUCKET_NAME 2>/dev/null | grep -i "enabled" || echo "disabled")
if echo "$UNIFORM_ACCESS" | grep -qi "enabled"; then
    print_warning "Uniform bucket-level access is ENABLED"
    print_status "Checking bucket IAM policy for public access..."
    
    # Check if allUsers has objectViewer role
    IAM_POLICY=$(gsutil iam get gs://$BUCKET_NAME 2>/dev/null || echo "")
    if echo "$IAM_POLICY" | grep -q "allUsers.*objectViewer"; then
        print_success "Bucket is publicly readable (allUsers:objectViewer)"
    else
        print_error "Bucket is NOT publicly readable"
        echo ""
        echo "To fix, run:"
        echo "  gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME"
        echo ""
        read -p "Would you like to make the bucket publicly readable now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
            print_success "Bucket is now publicly readable"
        fi
    fi
else
    print_status "Uniform bucket-level access is DISABLED"
    print_status "Individual files can be made public"
fi
echo ""

# Check if profile-photos folder exists (by checking for any file in it)
print_status "Checking profile-photos folder..."
if gsutil ls gs://$BUCKET_NAME/profile-photos/ &> /dev/null; then
    PHOTO_COUNT=$(gsutil ls gs://$BUCKET_NAME/profile-photos/ 2>/dev/null | wc -l | tr -d ' ')
    print_success "profile-photos folder exists with $PHOTO_COUNT items"
else
    print_warning "profile-photos folder does not exist or is empty"
    print_status "This is OK - it will be created automatically when photos are uploaded"
fi
echo ""

# Check CORS configuration
print_status "Checking CORS configuration..."
CORS_CONFIG=$(gsutil cors get gs://$BUCKET_NAME 2>/dev/null || echo "[]")
if [ "$CORS_CONFIG" != "[]" ] && [ -n "$CORS_CONFIG" ]; then
    print_success "CORS is configured"
else
    print_warning "CORS is not configured"
    echo ""
    echo "To set CORS, update scripts/setup-cloud-storage.sh and run it"
fi
echo ""

# Test public access (if we can find a file)
print_status "Testing public access to a sample file..."
SAMPLE_FILE=$(gsutil ls gs://$BUCKET_NAME/profile-photos/*.jpg 2>/dev/null | head -1)
if [ -n "$SAMPLE_FILE" ]; then
    FILE_PATH=$(echo "$SAMPLE_FILE" | sed "s|gs://$BUCKET_NAME/||")
    PUBLIC_URL="https://storage.googleapis.com/$BUCKET_NAME/$FILE_PATH"
    print_status "Testing URL: $PUBLIC_URL"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Public access works! (HTTP $HTTP_CODE)"
    elif [ "$HTTP_CODE" = "403" ]; then
        print_error "Public access DENIED (HTTP 403)"
        print_error "The bucket or file is not publicly accessible"
    elif [ "$HTTP_CODE" = "404" ]; then
        print_warning "File not found (HTTP 404) - this might be expected"
    else
        print_warning "Unexpected response (HTTP $HTTP_CODE)"
    fi
else
    print_status "No sample files found to test public access"
fi
echo ""

# Summary
echo "=========================================="
print_status "Verification Summary:"
echo "=========================================="
echo "Bucket: $BUCKET_NAME"
echo "Project: $PROJECT_ID"
echo ""

# Final recommendations
if echo "$UNIFORM_ACCESS" | grep -qi "enabled"; then
    IAM_POLICY=$(gsutil iam get gs://$BUCKET_NAME 2>/dev/null || echo "")
    if ! echo "$IAM_POLICY" | grep -q "allUsers.*objectViewer"; then
        print_error "ACTION REQUIRED:"
        echo "  Run: gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME"
        echo ""
    fi
fi

print_success "Verification complete!"
