-- Add schedule calendar support for HR module

ALTER TABLE "hr_module_settings"
ADD COLUMN "scheduleCalendarId" TEXT;

ALTER TABLE "time_off_requests"
ADD COLUMN "scheduleEventId" TEXT;

ALTER TABLE "time_off_requests"
ADD COLUMN "personalEventId" TEXT;

