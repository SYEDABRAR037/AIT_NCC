ALTER TABLE "Camp"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "reportingVenue" TEXT,
  ADD COLUMN "eligibleYears" TEXT,
  ADD COLUMN "targetPlatoon" TEXT,
  ADD COLUMN "targetTeam" TEXT;

CREATE TABLE "CampDocument" (
  "id" TEXT NOT NULL,
  "campId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampDocument_campId_idx" ON "CampDocument"("campId");
ALTER TABLE "CampDocument" ADD CONSTRAINT "CampDocument_campId_fkey"
  FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
