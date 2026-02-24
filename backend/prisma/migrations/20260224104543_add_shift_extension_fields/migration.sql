-- CreateEnum
CREATE TYPE "ShiftExtensionStatus" AS ENUM ('NONE', 'APPROVED', 'PENDING', 'UNAPPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "time_records" ADD COLUMN     "shiftExtensionMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shiftExtensionReason" TEXT,
ADD COLUMN     "shiftExtensionStatus" "ShiftExtensionStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "work_sessions" ADD COLUMN     "shiftEndAction" TEXT,
ADD COLUMN     "shiftEndPausedAt" TIMESTAMP(3),
ADD COLUMN     "shiftEndResumedAt" TIMESTAMP(3);
