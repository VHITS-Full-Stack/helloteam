-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "lastClockOutAt" TIMESTAMP(3),
ADD COLUMN     "lastClockOutReason" TEXT,
ADD COLUMN     "lastClockedOutBy" TEXT;
