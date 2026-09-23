-- CreateTable
CREATE TABLE "SeniorAssignment" (
    "id" TEXT NOT NULL,
    "seniorId" TEXT NOT NULL,
    "cadetId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeniorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatoonSeniorAssignment" (
    "id" TEXT NOT NULL,
    "platoonSeniorId" TEXT NOT NULL,
    "platoonId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatoonSeniorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeniorAssignment_cadetId_key" ON "SeniorAssignment"("cadetId");

-- CreateIndex
CREATE INDEX "SeniorAssignment_seniorId_idx" ON "SeniorAssignment"("seniorId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatoonSeniorAssignment_platoonSeniorId_platoonId_key" ON "PlatoonSeniorAssignment"("platoonSeniorId", "platoonId");

-- AddForeignKey
ALTER TABLE "SeniorAssignment" ADD CONSTRAINT "SeniorAssignment_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeniorAssignment" ADD CONSTRAINT "SeniorAssignment_cadetId_fkey" FOREIGN KEY ("cadetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatoonSeniorAssignment" ADD CONSTRAINT "PlatoonSeniorAssignment_platoonSeniorId_fkey" FOREIGN KEY ("platoonSeniorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatoonSeniorAssignment" ADD CONSTRAINT "PlatoonSeniorAssignment_platoonId_fkey" FOREIGN KEY ("platoonId") REFERENCES "Platoon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
