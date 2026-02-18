-- AlterEnum
ALTER TYPE "LeaveType" ADD VALUE 'PAID_HOLIDAY';

-- AlterTable
ALTER TABLE "leave_balances" ADD COLUMN     "paidHolidayEntitled" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidHolidayPending" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidHolidayUsed" DECIMAL(5,2) NOT NULL DEFAULT 0;
