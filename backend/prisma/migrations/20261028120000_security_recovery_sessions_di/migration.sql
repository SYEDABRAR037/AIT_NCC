-- Additive security tables. Depends only on the checked-in User and Platoon tables.
-- This migration has not been applied. Existing migration history must be reconciled first.

CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RecoveryChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "lookupHash" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'QUEUED',
    "verifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecoveryChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecoveryChallenge_userId_createdAt_idx" ON "RecoveryChallenge"("userId", "createdAt");
CREATE INDEX "RecoveryChallenge_lookupHash_createdAt_idx" ON "RecoveryChallenge"("lookupHash", "createdAt");
CREATE INDEX "RecoveryChallenge_expiresAt_idx" ON "RecoveryChallenge"("expiresAt");
ALTER TABLE "RecoveryChallenge" ADD CONSTRAINT "RecoveryChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DrillInstructorAssignment" (
    "id" TEXT NOT NULL,
    "drillInstructorId" TEXT NOT NULL,
    "platoonId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrillInstructorAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DrillInstructorAssignment_drillInstructorId_platoonId_key"
  ON "DrillInstructorAssignment"("drillInstructorId", "platoonId");
CREATE INDEX "DrillInstructorAssignment_platoonId_idx" ON "DrillInstructorAssignment"("platoonId");
ALTER TABLE "DrillInstructorAssignment" ADD CONSTRAINT "DrillInstructorAssignment_drillInstructorId_fkey"
  FOREIGN KEY ("drillInstructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrillInstructorAssignment" ADD CONSTRAINT "DrillInstructorAssignment_platoonId_fkey"
  FOREIGN KEY ("platoonId") REFERENCES "Platoon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
