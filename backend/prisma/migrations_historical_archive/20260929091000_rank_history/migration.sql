ALTER TABLE "User" ADD COLUMN "rank" TEXT NOT NULL DEFAULT 'CDT';

CREATE TABLE "RankHistory" (
    "id" TEXT NOT NULL,
    "cadetId" TEXT NOT NULL,
    "previousRank" TEXT NOT NULL,
    "newRank" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RankHistory_cadetId_changedAt_idx" ON "RankHistory"("cadetId", "changedAt");
CREATE INDEX "RankHistory_changedById_idx" ON "RankHistory"("changedById");
ALTER TABLE "RankHistory" ADD CONSTRAINT "RankHistory_cadetId_fkey" FOREIGN KEY ("cadetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankHistory" ADD CONSTRAINT "RankHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
