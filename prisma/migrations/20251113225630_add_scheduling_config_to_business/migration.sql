-- Create enums for scheduling module
CREATE TYPE "SchedulingMode" AS ENUM ('RESTAURANT', 'HEALTHCARE', 'RETAIL', 'MANUFACTURING', 'OFFICE', 'COFFEE_SHOP', 'OTHER');
CREATE TYPE "SchedulingStrategy" AS ENUM ('AVAILABILITY_FIRST', 'BUDGET_FIRST', 'COMPLIANCE_FIRST', 'TEMPLATE_BASED', 'AUTO_GENERATE');

-- Add scheduling configuration columns to businesses table
ALTER TABLE "businesses" 
  ADD COLUMN "schedulingMode" "SchedulingMode",
  ADD COLUMN "schedulingStrategy" "SchedulingStrategy",
  ADD COLUMN "schedulingConfig" JSONB;

-- Create index on schedulingMode for faster queries
CREATE INDEX "businesses_schedulingMode_idx" ON "businesses"("schedulingMode");

