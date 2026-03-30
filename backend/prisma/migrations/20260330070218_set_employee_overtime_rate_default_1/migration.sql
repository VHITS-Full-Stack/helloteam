-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "overtimeRate" SET DEFAULT 1;

-- Update existing employees: set overtimeRate to 1 where it's NULL or 0
UPDATE "employees" SET "overtimeRate" = 1 WHERE "overtimeRate" IS NULL OR "overtimeRate" = 0;
