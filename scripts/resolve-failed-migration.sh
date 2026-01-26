#!/bin/bash
# Resolve failed migration script
set -e

export DATABASE_URL="postgresql://vssyl_user:ArthurGeorge116!@172.30.0.15:5432/vssyl_production?connection_limit=5&pool_timeout=20"

echo "🔍 Checking migration status..."
pnpm prisma migrate status

echo ""
echo "⚠️  To resolve the failed migration, you need to:"
echo "1. Check if the migration actually succeeded (tables might exist)"
echo "2. Mark it as applied if it succeeded: pnpm prisma migrate resolve --applied 20251026_add_hr_module_schema"
echo "3. Or rollback and reapply if it failed: pnpm prisma migrate resolve --rolled-back 20251026_add_hr_module_schema"
echo ""
echo "⚠️  This requires Cloud SQL Proxy or running from within Google Cloud"
