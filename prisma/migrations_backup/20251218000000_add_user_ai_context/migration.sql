-- CreateTable
CREATE TABLE IF NOT EXISTS "user_ai_context" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "moduleId" TEXT,
    "contextType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_context_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_ai_context_userId_idx" ON "user_ai_context"("userId");
CREATE INDEX IF NOT EXISTS "user_ai_context_scope_scopeId_idx" ON "user_ai_context"("scope", "scopeId");
CREATE INDEX IF NOT EXISTS "user_ai_context_moduleId_idx" ON "user_ai_context"("moduleId");
CREATE INDEX IF NOT EXISTS "user_ai_context_contextType_idx" ON "user_ai_context"("contextType");
CREATE INDEX IF NOT EXISTS "user_ai_context_active_idx" ON "user_ai_context"("active");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ai_context_userId_fkey') THEN
        ALTER TABLE "user_ai_context" ADD CONSTRAINT "user_ai_context_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

