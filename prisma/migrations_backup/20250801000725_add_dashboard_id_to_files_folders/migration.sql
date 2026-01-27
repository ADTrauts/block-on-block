-- AlterTable
ALTER TABLE "File" ADD COLUMN     "dashboardId" TEXT;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "dashboardId" TEXT;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
