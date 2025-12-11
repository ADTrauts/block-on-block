DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedule_shifts' AND column_name = 'roleId'
  ) THEN
    ALTER TABLE "schedule_shifts" RENAME COLUMN "roleId" TO "positionId";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_templates' AND column_name = 'roleId'
  ) THEN
    ALTER TABLE "shift_templates" RENAME COLUMN "roleId" TO "positionId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedule_shifts' AND column_name = 'positionId'
  ) THEN
    BEGIN
      ALTER TABLE "schedule_shifts"
        ADD CONSTRAINT "schedule_shifts_positionId_fkey"
        FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_templates' AND column_name = 'positionId'
  ) THEN
    BEGIN
      ALTER TABLE "shift_templates"
        ADD CONSTRAINT "shift_templates_positionId_fkey"
        FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

