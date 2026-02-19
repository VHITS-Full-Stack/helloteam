-- CreateEnum
CREATE TYPE "OvertimeType" AS ENUM ('SHIFT_EXTENSION', 'OFF_SHIFT');

-- AlterTable
ALTER TABLE "overtime_requests" ADD COLUMN     "requestedEndTime" TEXT,
ADD COLUMN     "requestedStartTime" TEXT,
ADD COLUMN     "type" "OvertimeType" NOT NULL DEFAULT 'SHIFT_EXTENSION';
