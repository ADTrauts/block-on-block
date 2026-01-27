-- Add schedule calendar support for HR module

-- Add scheduleCalendarId to hr_module_settings (if table and column don't exist)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'hr_module_settings'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'hr_module_settings' 
        AND column_name = 'scheduleCalendarId'
    ) THEN
        ALTER TABLE "hr_module_settings" ADD COLUMN "scheduleCalendarId" TEXT;
    END IF;
END $$;

-- Add scheduleEventId to time_off_requests (if table and column don't exist)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'time_off_requests'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'time_off_requests' 
        AND column_name = 'scheduleEventId'
    ) THEN
        ALTER TABLE "time_off_requests" ADD COLUMN "scheduleEventId" TEXT;
    END IF;
END $$;

-- Add personalEventId to time_off_requests (if table and column don't exist)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'time_off_requests'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'time_off_requests' 
        AND column_name = 'personalEventId'
    ) THEN
        ALTER TABLE "time_off_requests" ADD COLUMN "personalEventId" TEXT;
    END IF;
END $$;

