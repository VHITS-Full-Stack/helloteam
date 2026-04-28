-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "lastClockOutAt" TIMESTAMP(3),
ADD COLUMN     "lastClockOutReason" TEXT,
ADD COLUMN     "lastClockedOutBy" TEXT;

-- AlterTable
ALTER TABLE "time_records" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "work_sessions" ADD COLUMN     "clockOutReason" TEXT,
ADD COLUMN     "clockedOutBy" TEXT;
