-- Add business-specific fields to subscriptions table
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "employeeCount" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "includedEmployees" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "additionalEmployeeCost" DOUBLE PRECISION;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "subscriptions_employeeCount_idx" ON "subscriptions"("employeeCount");

