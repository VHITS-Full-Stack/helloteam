-- AlterTable: Add shiftEndNotifiedAt to work_sessions
ALTER TABLE "work_sessions" ADD COLUMN "shiftEndNotifiedAt" TIMESTAMP(3);

-- AlterEnum: Add SHIFT_ENDING and AUTO_CLOCK_OUT to NotificationType
ALTER TYPE "NotificationType" ADD VALUE 'SHIFT_ENDING';
ALTER TYPE "NotificationType" ADD VALUE 'AUTO_CLOCK_OUT';
