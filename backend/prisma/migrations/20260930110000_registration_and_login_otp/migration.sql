ALTER TABLE "User"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mobileVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "OtpPurpose" AS ENUM ('REGISTRATION_EMAIL', 'REGISTRATION_MOBILE', 'LOGIN');

CREATE TABLE "OtpChallenge" (
  "id" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "userId" TEXT,
  "destination" TEXT NOT NULL,
  "otpHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "proofExpiresAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "sendCount" INTEGER NOT NULL DEFAULT 1,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OtpChallenge_purpose_destination_createdAt_idx" ON "OtpChallenge"("purpose", "destination", "createdAt");
CREATE INDEX "OtpChallenge_userId_purpose_expiresAt_idx" ON "OtpChallenge"("userId", "purpose", "expiresAt");
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
