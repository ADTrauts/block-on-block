## Quick Check Commands

# Check migration status
pnpm prisma migrate status

# Check for drift (schema vs database)
pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# Run migration coverage check
node scripts/check-migration-coverage.js

# Build schema from modules (always do this before migrating)
pnpm prisma:build

# Create migration (MANDATORY for any schema change)
pnpm prisma migrate dev --name descriptive_name

