-- CreateTable
CREATE TABLE "policy_violations" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policy_violations_policyId_idx" ON "policy_violations"("policyId");

-- CreateIndex
CREATE INDEX "policy_violations_resourceType_idx" ON "policy_violations"("resourceType");

-- CreateIndex
CREATE INDEX "policy_violations_severity_idx" ON "policy_violations"("severity");

-- CreateIndex
CREATE INDEX "policy_violations_detectedAt_idx" ON "policy_violations"("detectedAt");

-- CreateIndex
CREATE INDEX "policy_violations_resolvedAt_idx" ON "policy_violations"("resolvedAt");

-- AddForeignKey
ALTER TABLE "policy_violations" ADD CONSTRAINT "policy_violations_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "governance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
