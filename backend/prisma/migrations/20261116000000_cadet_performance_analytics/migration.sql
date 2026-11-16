CREATE TABLE "PerformanceAssessment" (
  "id" TEXT NOT NULL,
  "cadetId" TEXT NOT NULL,
  "evaluatorId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "title" TEXT NOT NULL,
  "feedback" TEXT,
  "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerformanceAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PerformanceAssessment_cadetId_fkey" FOREIGN KEY ("cadetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PerformanceAssessment_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PerformanceAssessment_cadetId_category_assessmentDate_idx" ON "PerformanceAssessment"("cadetId", "category", "assessmentDate");
CREATE INDEX "PerformanceAssessment_evaluatorId_idx" ON "PerformanceAssessment"("evaluatorId");
CREATE TABLE "PerformanceScoreSnapshot" (
  "id" TEXT NOT NULL,
  "cadetId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "overallScore" DOUBLE PRECISION,
  "grade" TEXT,
  "completeness" DOUBLE PRECISION NOT NULL,
  "categories" JSONB NOT NULL,
  "sourceDigest" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerformanceScoreSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PerformanceScoreSnapshot_cadetId_fkey" FOREIGN KEY ("cadetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PerformanceScoreSnapshot_cadetId_period_periodStart_sourceDigest_key" ON "PerformanceScoreSnapshot"("cadetId", "period", "periodStart", "sourceDigest");
CREATE INDEX "PerformanceScoreSnapshot_cadetId_periodStart_idx" ON "PerformanceScoreSnapshot"("cadetId", "periodStart");
