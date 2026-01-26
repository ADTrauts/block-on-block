#!/bin/bash

# Check Migration Status Script
# This script checks which migrations have been applied to the production database

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

# Check if DATABASE_URL is set, otherwise use production defaults
if [ -z "$DATABASE_URL" ]; then
    print_status "DATABASE_URL not set, using production defaults..."
    DB_USER="vssyl_user"
    DB_PASSWORD="ArthurGeorge116!"
    DB_HOST="172.30.0.15"
    DB_NAME="vssyl_production"
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?connection_limit=5&pool_timeout=20"
else
    print_status "Using DATABASE_URL from environment..."
fi

print_status "🔍 Checking migration status..."

# Check if we can connect
if ! pnpm prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    print_error "Cannot connect to database. Please check your DATABASE_URL."
    exit 1
fi

# Check migration status
print_status "📊 Migration Status:"
pnpm prisma migrate status

print_status ""
print_status "To apply pending migrations to production, run:"
print_status "  pnpm prisma migrate deploy"
print_status ""
print_warning "⚠️  This will apply all pending migrations. Make sure you have a backup!"
