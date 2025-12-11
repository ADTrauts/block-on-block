-- ============================================================================
-- Ensure All Shifts Have Titles
-- ============================================================================
-- This migration ensures all existing shifts have a title value
-- The title field is required in Prisma but may be NULL in the database
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'schedule_shifts'
  ) THEN
    UPDATE "schedule_shifts" 
    SET "title" = COALESCE(
      "title", 
      CASE 
        WHEN "employeePositionId" IS NOT NULL THEN 'Assigned Shift'
        WHEN COALESCE("positionId", "roleId") IS NOT NULL THEN 'Scheduled Shift'
        ELSE 'Shift'
      END
    )
    WHERE "title" IS NULL OR "title" = '';

    IF NOT EXISTS (SELECT 1 FROM "schedule_shifts" WHERE "title" IS NULL) THEN
      BEGIN
        ALTER TABLE "schedule_shifts" ALTER COLUMN "title" SET NOT NULL;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
  END IF;
END $$;
