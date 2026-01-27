-- CreateTable
CREATE TABLE "moderation_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conditions" TEXT[],
    "actions" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_rules_enabled_idx" ON "moderation_rules"("enabled");

-- CreateIndex
CREATE INDEX "moderation_rules_priority_idx" ON "moderation_rules"("priority");
