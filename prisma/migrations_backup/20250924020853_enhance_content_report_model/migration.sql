-- AlterTable
ALTER TABLE "content_reports" ADD COLUMN     "autoModerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contentDescription" TEXT,
ADD COLUMN     "contentTitle" TEXT,
ADD COLUMN     "contentUrl" TEXT,
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'medium';

-- CreateIndex
CREATE INDEX "content_reports_severity_idx" ON "content_reports"("severity");

-- CreateIndex
CREATE INDEX "content_reports_autoModerated_idx" ON "content_reports"("autoModerated");
