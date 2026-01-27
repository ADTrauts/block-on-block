-- AlterTable
ALTER TABLE "File" ADD COLUMN     "path" TEXT,
ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;
