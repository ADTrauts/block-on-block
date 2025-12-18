-- Create enum types for logging system
CREATE TYPE "LogLevel" AS ENUM ('debug', 'info', 'warn', 'error');
CREATE TYPE "LogService" AS ENUM ('vssyl_server', 'vssyl_web');

-- Convert logs.level from TEXT to LogLevel enum
-- First, ensure all existing values are valid enum values
UPDATE "logs" SET "level" = 'info' WHERE "level" NOT IN ('debug', 'info', 'warn', 'error');

-- Alter the column type
ALTER TABLE "logs" 
  ALTER COLUMN "level" TYPE "LogLevel" USING "level"::"LogLevel",
  ALTER COLUMN "service" TYPE "LogService" USING "service"::"LogService";

