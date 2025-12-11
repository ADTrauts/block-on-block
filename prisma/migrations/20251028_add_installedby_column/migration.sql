-- Add installedBy column to business_module_installations (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'business_module_installations' 
        AND column_name = 'installedBy'
    ) THEN
        ALTER TABLE "business_module_installations" ADD COLUMN "installedBy" TEXT;
    END IF;
END $$;

-- Add index for performance (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'business_module_installations_installedBy_idx'
    ) THEN
        CREATE INDEX "business_module_installations_installedBy_idx" ON "business_module_installations"("installedBy");
    END IF;
END $$;

-- Add foreign key constraint (optional, for data integrity)
-- Note: This is commented out because installedBy can be NULL for existing records
-- ALTER TABLE "business_module_installations" ADD CONSTRAINT "business_module_installations_installedBy_fkey" FOREIGN KEY ("installedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

