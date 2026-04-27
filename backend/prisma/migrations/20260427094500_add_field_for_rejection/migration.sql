-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "documentUrls" TEXT[];
