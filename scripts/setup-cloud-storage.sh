#!/bin/bash

# Cloud Storage Setup Script for Vssyl
# This script configures Google Cloud Storage for file uploads and static assets

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
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    print_error "No project ID set. Please run:"
    echo "gcloud config set project PROJECT_ID"
    exit 1
fi

# Get bucket name from environment or use default
BUCKET_NAME=${1:-"vssyl-uploads-$PROJECT_ID"}

print_status "Setting up Cloud Storage for Vssyl..."
print_status "Project: $PROJECT_ID"
print_status "Bucket: $BUCKET_NAME"

# Create bucket if it doesn't exist
if ! gsutil ls gs://$BUCKET_NAME &> /dev/null; then
    print_status "Creating Cloud Storage bucket..."
    gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://$BUCKET_NAME
    print_success "Bucket created: $BUCKET_NAME"
else
    print_warning "Bucket already exists: $BUCKET_NAME"
fi

# Set bucket permissions
print_status "Setting bucket permissions..."

# Make bucket publicly readable for static assets
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME

# Set CORS configuration for file uploads
print_status "Setting CORS configuration..."
cat > cors.json << EOF
[
  {
    "origin": ["https://your-domain.com", "https://vssyl-web-*.run.app"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://$BUCKET_NAME
rm cors.json

print_success "CORS configuration set"

# Create folder structure
print_status "Creating folder structure..."
gsutil mkdir -p gs://$BUCKET_NAME/uploads
gsutil mkdir -p gs://$BUCKET_NAME/static
gsutil mkdir -p gs://$BUCKET_NAME/avatars
gsutil mkdir -p gs://$BUCKET_NAME/business-logos
gsutil mkdir -p gs://$BUCKET_NAME/profile-photos

print_success "Folder structure created"

# Set lifecycle policy for cost optimization
print_status "Setting lifecycle policy..."
cat > lifecycle.json << EOF
{
  "rule": [
    {
      "action": {
        "type": "SetStorageClass",
        "storageClass": "NEARLINE"
      },
      "condition": {
        "age": 30,
        "matchesStorageClass": ["STANDARD"]
      }
    },
    {
      "action": {
        "type": "SetStorageClass",
        "storageClass": "COLDLINE"
      },
      "condition": {
        "age": 90,
        "matchesStorageClass": ["NEARLINE"]
      }
    },
    {
      "action": {
        "type": "Delete"
      },
      "condition": {
        "age": 365
      }
    }
  ]
}
EOF

gsutil lifecycle set lifecycle.json gs://$BUCKET_NAME
rm lifecycle.json

print_success "Lifecycle policy set"

# Create service account for Cloud Storage access
print_status "Creating service account for Cloud Storage..."
gcloud iam service-accounts create vssyl-storage-sa \
    --display-name="Vssyl Storage Service Account" \
    --description="Service account for Vssyl Cloud Storage access"

# Grant storage permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:vssyl-storage-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

print_success "Service account created and permissions granted"

# Create storage configuration file
print_status "Creating storage configuration..."
cat > storage-config.json << EOF
{
  "projectId": "$PROJECT_ID",
  "bucketName": "$BUCKET_NAME",
  "serviceAccount": "vssyl-storage-sa@$PROJECT_ID.iam.gserviceaccount.com",
  "folders": {
    "uploads": "gs://$BUCKET_NAME/uploads",
    "static": "gs://$BUCKET_NAME/static",
    "avatars": "gs://$BUCKET_NAME/avatars",
    "businessLogos": "gs://$BUCKET_NAME/business-logos",
    "profilePhotos": "gs://$BUCKET_NAME/profile-photos"
  },
  "cors": {
    "origins": ["https://your-domain.com", "https://vssyl-web-*.run.app"],
    "methods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAge": 3600
  }
}
EOF

print_success "Storage configuration created: storage-config.json"

# Summary
print_success "Cloud Storage setup completed!"
echo ""
echo "Configuration:"
echo "- Bucket: $BUCKET_NAME"
echo "- Project: $PROJECT_ID"
echo "- Service Account: vssyl-storage-sa@$PROJECT_ID.iam.gserviceaccount.com"
echo ""
echo "Next steps:"
echo "1. Update your .env.production with:"
echo "   GOOGLE_CLOUD_STORAGE_BUCKET=$BUCKET_NAME"
echo "   GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID"
echo "2. Update your domain in the CORS configuration"
echo "3. Deploy your application with Cloud Storage integration"
echo ""
echo "Storage URLs:"
echo "- Uploads: gs://$BUCKET_NAME/uploads"
echo "- Static: gs://$BUCKET_NAME/static"
echo "- Avatars: gs://$BUCKET_NAME/avatars"
echo "- Business Logos: gs://$BUCKET_NAME/business-logos"
echo "- Profile Photos: gs://$BUCKET_NAME/profile-photos"
