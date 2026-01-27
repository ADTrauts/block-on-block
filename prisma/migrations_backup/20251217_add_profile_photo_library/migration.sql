-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "user_profile_photos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "crop" JSONB,
    "rotation" INTEGER,
    "trashedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_photos_pkey" PRIMARY KEY ("id")
);

-- AlterTable (only add columns if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='personalPhotoId') THEN
        ALTER TABLE "users" ADD COLUMN "personalPhotoId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='businessPhotoId') THEN
        ALTER TABLE "users" ADD COLUMN "businessPhotoId" TEXT;
    END IF;
END $$;

-- CreateIndex (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "users_personalPhotoId_key" ON "users"("personalPhotoId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_businessPhotoId_key" ON "users"("businessPhotoId");
CREATE INDEX IF NOT EXISTS "user_profile_photos_userId_idx" ON "user_profile_photos"("userId");
CREATE INDEX IF NOT EXISTS "user_profile_photos_trashedAt_idx" ON "user_profile_photos"("trashedAt");

-- AddForeignKey (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profile_photos_userId_fkey') THEN
        ALTER TABLE "user_profile_photos" ADD CONSTRAINT "user_profile_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_personalPhotoId_fkey') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_personalPhotoId_fkey" FOREIGN KEY ("personalPhotoId") REFERENCES "user_profile_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_businessPhotoId_fkey') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_businessPhotoId_fkey" FOREIGN KEY ("businessPhotoId") REFERENCES "user_profile_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

