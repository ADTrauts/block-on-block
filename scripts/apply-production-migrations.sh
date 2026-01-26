#!/bin/bash

# Apply Production Migrations Script
# This script safely applies pending Prisma migrations to the production database

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

print_warning "⚠️  PRODUCTION DATABASE MIGRATION"
print_warning "⚠️  This will modify the production database schema!"
print_status ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_status "Migration cancelled."
    exit 0
fi

print_status "🔍 Checking current migration status..."
pnpm prisma migrate status

print_status ""
print_warning "⚠️  About to apply pending migrations..."
read -p "Continue? (yes/no): " confirm2

if [ "$confirm2" != "yes" ]; then
    print_status "Migration cancelled."
    exit 0
fi

print_status "🔄 Building Prisma schema from modules..."
pnpm prisma:build

print_status "🔄 Applying migrations to production database..."
if pnpm prisma migrate deploy; then
    print_success "✅ Migrations applied successfully!"
    print_status ""
    print_status "🔍 Verifying migration status..."
    pnpm prisma migrate status
    print_status ""
    print_success "✅ All migrations are now up to date!"
else
    print_error "❌ Migration failed!"
    print_error "Please check the error messages above and fix any issues."
    exit 1
fi
