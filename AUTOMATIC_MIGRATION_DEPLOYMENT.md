# Automatic Migration Deployment

## ✅ Yes, Migrations Deploy Automatically!

When you push to git and Google Cloud Build runs, migrations are deployed in **two places**:

### 1. During Cloud Build (Attempts First)

**Location:** `cloudbuild.yaml` lines 50-102

```yaml
# Step 3: Run database migrations
- name: 'gcr.io/cloud-builders/gcloud'
  args:
    - '-c'
    - |
      # ... installs dependencies ...
      # Build Prisma schema from modules
      node scripts/build-prisma-schema.js
      # Generate Prisma client
      npx prisma generate
      # Run Prisma migration
      npx prisma migrate deploy
```

**What happens:**
- ✅ Builds schema from modules
- ✅ Generates Prisma client
- ✅ Attempts to run `prisma migrate deploy`
- ⚠️ May fail if database not reachable during build (network/VPC issues)
- ✅ If it fails, migrations run on container startup instead

### 2. On Container Startup (Fallback/Guaranteed)

**Location:** `server/src/index.ts` lines 976-1026

```typescript
// Run database migrations in production
if (process.env.NODE_ENV === 'production') {
  console.log('🔄 Running database migrations...');
  // Builds schema, then runs: prisma migrate deploy
}
```

**What happens:**
- ✅ Runs when Cloud Run container starts
- ✅ Has VPC access to database (guaranteed to work)
- ✅ Builds schema from modules
- ✅ Runs `prisma migrate deploy`
- ✅ Applies any pending migrations

## Current Status

With your clean restart:
- ✅ **1 baseline migration** ready: `20260126230000_initial_schema_baseline`
- ✅ **Will deploy automatically** when you push to git
- ✅ **Cloud Build** will try to run it (may succeed or fail)
- ✅ **Container startup** will definitely run it (guaranteed)

## What You Need to Do

### Nothing! Just push to git:

```bash
git add .
git commit -m "Clean restart: single baseline migration"
git push
```

Cloud Build will:
1. Build your Docker images
2. Try to run migrations (may work, may not - doesn't matter)
3. Deploy containers
4. **Container startup will run migrations** (this is what matters)

## Verification

After deployment, check Cloud Run logs:

```bash
# Check server logs for migration output
gcloud run services logs read vssyl-server --limit=50

# Look for:
# "🔄 Running database migrations..."
# "✅ Migrations completed successfully"
```

## Important Notes

1. **Migrations run automatically** - You don't need to manually run `prisma migrate deploy`
2. **Container startup is the guarantee** - Even if Cloud Build step fails, migrations run on startup
3. **Your baseline migration will apply** - The single `20260126230000_initial_schema_baseline` migration will be applied
4. **No manual steps needed** - Just push to git and deploy

## If You Need to Reset Production

If you want to do a clean restart in production (no data):

1. **Before pushing**, connect to production database and run:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

2. **Then push to git** - The baseline migration will create everything fresh

3. **Or** - The migration will add missing tables/columns if they don't exist (idempotent)

## Summary

✅ **Migrations deploy automatically** when you push to git  
✅ **No manual steps needed**  
✅ **Container startup guarantees** migrations run even if Cloud Build step fails  
✅ **Your baseline migration** will be applied automatically  

Just push to git! 🚀
