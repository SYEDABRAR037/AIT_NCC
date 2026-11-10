ALTER TABLE "Duty" ADD COLUMN "startTime" TEXT;
ALTER TABLE "Duty" ADD COLUMN "endTime" TEXT;
UPDATE "Duty" SET "startTime" = "reportingTime" WHERE "startTime" IS NULL;
