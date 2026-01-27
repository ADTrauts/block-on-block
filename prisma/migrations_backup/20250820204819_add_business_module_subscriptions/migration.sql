-- AlterTable
ALTER TABLE "business_module_installations" ADD COLUMN     "installedBy" TEXT;

-- CreateTable
CREATE TABLE "business_module_subscriptions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_module_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_module_subscriptions_moduleId_idx" ON "business_module_subscriptions"("moduleId");

-- CreateIndex
CREATE INDEX "business_module_subscriptions_businessId_idx" ON "business_module_subscriptions"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_module_subscriptions_moduleId_businessId_key" ON "business_module_subscriptions"("moduleId", "businessId");

-- AddForeignKey
ALTER TABLE "business_module_subscriptions" ADD CONSTRAINT "business_module_subscriptions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_module_subscriptions" ADD CONSTRAINT "business_module_subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
