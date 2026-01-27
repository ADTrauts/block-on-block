-- Add business-scoped impersonation metadata
ALTER TABLE "admin_impersonations"
    ADD COLUMN "businessId" TEXT,
    ADD COLUMN "context" TEXT,
    ADD COLUMN "sessionTokenHash" TEXT,
    ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Ensure session tokens remain unique
CREATE UNIQUE INDEX "AdminImpersonation_sessionTokenHash_key"
    ON "admin_impersonations"("sessionTokenHash");

-- Index business scope for faster lookups
CREATE INDEX "admin_impersonations_businessId_idx"
    ON "admin_impersonations"("businessId");

-- Maintain referential integrity with businesses
ALTER TABLE "admin_impersonations"
    ADD CONSTRAINT "admin_impersonations_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "businesses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

