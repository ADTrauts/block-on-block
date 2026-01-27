-- ============================================================================
-- Add Scheduling Visual Fields and Position Configuration
-- ============================================================================
-- This migration adds:
-- 1. JobFunction and StationType enums
-- 2. Visual builder fields to schedules table (layoutMode, viewMode)
-- 3. Title, station, and job function fields to schedule_shifts table
-- 4. Scheduling configuration fields to positions table
-- ============================================================================

-- Create JobFunction enum (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobFunction') THEN
    CREATE TYPE "JobFunction" AS ENUM (
      'GRILL',
      'FRY',
      'PREP',
      'PIZZA',
      'PANTRY',
      'DISH',
      'LINE_COOK',
      'EXPO',
      'COOK',
      'CHEF',
      'SERVER',
      'HOST',
      'RUNNER',
      'BARTENDER',
      'CASHIER',
      'BARISTA',
      'MANAGER_ON_DUTY',
      'SHIFT_LEAD',
      'SUPERVISOR',
      'NURSE',
      'CNA',
      'TECH',
      'DOCTOR',
      'CUSTOM'
    );
  END IF;
END $$;

-- Create StationType enum (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StationType') THEN
    CREATE TYPE "StationType" AS ENUM (
      'BOH',
      'FOH',
      'MANAGEMENT',
      'HEALTHCARE',
      'MANUFACTURING',
      'OTHER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'schedules'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'schedules' AND column_name = 'layoutMode'
    ) THEN
      ALTER TABLE "schedules" ADD COLUMN "layoutMode" TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'schedules' AND column_name = 'viewMode'
    ) THEN
      ALTER TABLE "schedules" ADD COLUMN "viewMode" TEXT;
    END IF;

    EXECUTE 'CREATE INDEX IF NOT EXISTS "schedules_layoutMode_idx" ON "schedules"("layoutMode")';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'schedule_shifts'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'schedule_shifts' AND column_name = 'stationName'
    ) THEN
      ALTER TABLE "schedule_shifts" ADD COLUMN "stationName" TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'schedule_shifts' AND column_name = 'jobFunction'
    ) THEN
      ALTER TABLE "schedule_shifts" ADD COLUMN "jobFunction" TEXT;
    END IF;

    EXECUTE 'CREATE INDEX IF NOT EXISTS "schedule_shifts_stationName_idx" ON "schedule_shifts"("stationName")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "schedule_shifts_jobFunction_idx" ON "schedule_shifts"("jobFunction")';
  END IF;
END $$;

-- Add scheduling configuration fields to positions table (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'jobFunction'
  ) THEN
    ALTER TABLE "positions" ADD COLUMN "jobFunction" "JobFunction";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'stationName'
  ) THEN
    ALTER TABLE "positions" ADD COLUMN "stationName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'stationType'
  ) THEN
    ALTER TABLE "positions" ADD COLUMN "stationType" "StationType";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'canWorkMultipleStations'
  ) THEN
    ALTER TABLE "positions" ADD COLUMN "canWorkMultipleStations" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'isStationRequired'
  ) THEN
    ALTER TABLE "positions" ADD COLUMN "isStationRequired" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'schedulingPriority'
  ) THEN
    ALTER TABLE "positions" ADD COLUMN "schedulingPriority" INTEGER;
  END IF;
END $$;

-- Create indexes on jobFunction and stationType (only if they don't exist)
CREATE INDEX IF NOT EXISTS "positions_jobFunction_idx" ON "positions"("jobFunction");
CREATE INDEX IF NOT EXISTS "positions_stationType_idx" ON "positions"("stationType");

