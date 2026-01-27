-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('REGULAR', 'COLLEAGUE');

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "type" "RelationshipType" NOT NULL DEFAULT 'REGULAR',
    "organizationId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relationships_senderId_idx" ON "relationships"("senderId");

-- CreateIndex
CREATE INDEX "relationships_receiverId_idx" ON "relationships"("receiverId");

-- CreateIndex
CREATE INDEX "relationships_organizationId_idx" ON "relationships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "relationships_senderId_receiverId_key" ON "relationships"("senderId", "receiverId");

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
