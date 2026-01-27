-- CreateTable
CREATE TABLE "business_module_installations" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configured" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "business_module_installations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_module_installations_moduleId_idx" ON "business_module_installations"("moduleId");

-- CreateIndex
CREATE INDEX "business_module_installations_businessId_idx" ON "business_module_installations"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_module_installations_moduleId_businessId_key" ON "business_module_installations"("moduleId", "businessId");

-- AddForeignKey
ALTER TABLE "business_module_installations" ADD CONSTRAINT "business_module_installations_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_module_installations" ADD CONSTRAINT "business_module_installations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
