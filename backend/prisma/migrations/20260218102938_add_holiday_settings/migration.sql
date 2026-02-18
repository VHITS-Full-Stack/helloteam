-- AlterTable
ALTER TABLE "client_policies" ADD COLUMN     "allowPaidHolidays" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowUnpaidHolidays" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "numberOfPaidHolidays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "numberOfUnpaidHolidays" INTEGER NOT NULL DEFAULT 0;
