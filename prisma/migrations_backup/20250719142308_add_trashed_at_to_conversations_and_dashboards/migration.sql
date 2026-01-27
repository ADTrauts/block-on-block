-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN     "trashedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "trashedAt" TIMESTAMP(3);
