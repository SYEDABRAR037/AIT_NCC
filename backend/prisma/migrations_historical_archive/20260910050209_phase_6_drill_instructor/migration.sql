-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "conductedBy" TEXT NOT NULL,
    "targetPlatoon" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "cadetId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "verifiedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnoutInspection" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "cadetId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "drillGrade" TEXT NOT NULL DEFAULT 'A',
    "uniformScore" INTEGER NOT NULL DEFAULT 9,
    "shaveBeretHackleScore" INTEGER NOT NULL DEFAULT 9,
    "bootsPolishScore" INTEGER NOT NULL DEFAULT 9,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurnoutInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAttendance_sessionId_cadetId_key" ON "TrainingAttendance"("sessionId", "cadetId");

-- CreateIndex
CREATE INDEX "TurnoutInspection_cadetId_idx" ON "TurnoutInspection"("cadetId");

-- CreateIndex
CREATE INDEX "TurnoutInspection_inspectorId_idx" ON "TurnoutInspection"("inspectorId");

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_cadetId_fkey" FOREIGN KEY ("cadetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoutInspection" ADD CONSTRAINT "TurnoutInspection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoutInspection" ADD CONSTRAINT "TurnoutInspection_cadetId_fkey" FOREIGN KEY ("cadetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoutInspection" ADD CONSTRAINT "TurnoutInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
