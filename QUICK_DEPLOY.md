# Quick Production Deployment Guide

## The Problem
When you ran `pnpm prisma migrate deploy`, it connected to **localhost** instead of production because `DATABASE_URL` wasn't set to production.

## The Solution

### Step 1: Get Production Database Password
```bash
# Get password from Secret Manager
gcloud secrets versions access latest --secret="database-password"
```

### Step 2: Set Production DATABASE_URL
```bash
# Replace YOUR_PASSWORD with the password from Step 1
export DATABASE_URL="postgresql://vssyl_user:YOUR_PASSWORD@172.30.0.4:5432/vssyl_production?connection_limit=20&pool_timeout=20"
```

**OR use Cloud SQL Proxy (easier for local deployment):**
```bash
# Install Cloud SQL Proxy if needed
# https://cloud.google.com/sql/docs/postgres/sql-proxy

# Start proxy in background
cloud-sql-proxy vssyl-472202:us-central1:vssyl-db &

# Use localhost connection
export DATABASE_URL="postgresql://vssyl_user:YOUR_PASSWORD@127.0.0.1:5432/vssyl_production?connection_limit=20&pool_timeout=20"
```

### Step 3: Verify Connection
```bash
# Check what database you're connecting to
echo "DATABASE_URL: $DATABASE_URL"

# Should NOT contain "localhost:5432" or "blockondrive"
# Should contain "172.30.0.4" or "127.0.0.1" (if using proxy)
```

### Step 4: Deploy Migrations
```bash
# Now deploy to production
pnpm prisma migrate deploy
```

### Step 5: Verify
```bash
# Check migration status
pnpm prisma migrate status

# Should show all 70 migrations applied
# Should NOT say "No pending migrations" if you're on production for the first time
```

## Common Issues

### Issue: "No pending migrations to apply"
**Cause:** Still connected to localhost  
**Fix:** Set `DATABASE_URL` to production (see Step 2)

### Issue: "Connection refused" or "Cannot connect"
**Cause:** Can't reach production database from local machine  
**Fix:** Use Cloud SQL Proxy (see Step 2, Option C)

### Issue: "Instance not found"
**Cause:** Wrong instance name  
**Fix:** Instance name is `vssyl-db` (not `vssyl-production-db`)

## Production Database Info
- **Instance:** `vssyl-db`
- **Database:** `vssyl_production`
- **User:** `vssyl_user`
- **IP:** `172.30.0.4` (private IP)
- **Project:** `vssyl-472202`
- **Region:** `us-central1`
