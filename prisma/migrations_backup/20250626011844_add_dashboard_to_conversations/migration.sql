-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "dashboardId" TEXT;

-- CreateIndex
CREATE INDEX "conversations_dashboardId_idx" ON "conversations"("dashboardId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
