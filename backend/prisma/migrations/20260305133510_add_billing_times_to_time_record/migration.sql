-- AlterTable
ALTER TABLE "time_records" ADD COLUMN     "billingEnd" TIMESTAMP(3),
ADD COLUMN     "billingMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "billingStart" TIMESTAMP(3),
ADD COLUMN     "isLate" BOOLEAN NOT NULL DEFAULT false;
