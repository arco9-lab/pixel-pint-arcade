ALTER TYPE "Role" ADD VALUE 'DEMO';

ALTER TABLE "user" ADD COLUMN     "demoExpiresAt" TIMESTAMP(3),
ADD COLUMN     "demoIpHash" TEXT;

CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

CREATE INDEX "user_role_demoExpiresAt_idx" ON "user"("role", "demoExpiresAt");

CREATE INDEX "user_demoIpHash_createdAt_idx" ON "user"("demoIpHash", "createdAt");
