-- AlterTable
ALTER TABLE "client_policies" ADD COLUMN     "paidHolidayType" TEXT NOT NULL DEFAULT 'federal',
ADD COLUMN     "unpaidHolidayType" TEXT NOT NULL DEFAULT 'federal';
