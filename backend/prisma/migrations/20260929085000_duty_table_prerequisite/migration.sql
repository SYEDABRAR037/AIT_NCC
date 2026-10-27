-- The checked-in history alters Duty at 20260929090000 but has no earlier
-- migration that creates it. Add the base table before that ALTER without
-- changing the checksum of the existing migration. If Duty is already present
-- in a database, leave its schema untouched for operator-led reconciliation.
DO $duty_prerequisite$
BEGIN
  IF to_regclass('public."Duty"') IS NULL THEN
    CREATE TABLE "Duty" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "dutyType" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "dutyDate" TIMESTAMP(3) NOT NULL,
      "reportingTime" TEXT NOT NULL DEFAULT '06:00 hrs',
      "instructions" TEXT,
      "assignedCadetId" TEXT NOT NULL,
      "assignedById" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Duty_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX "Duty_assignedCadetId_idx" ON "Duty"("assignedCadetId");
    CREATE INDEX "Duty_dutyDate_idx" ON "Duty"("dutyDate");

    ALTER TABLE "Duty"
      ADD CONSTRAINT "Duty_assignedCadetId_fkey"
      FOREIGN KEY ("assignedCadetId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "Duty"
      ADD CONSTRAINT "Duty_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$duty_prerequisite$;
