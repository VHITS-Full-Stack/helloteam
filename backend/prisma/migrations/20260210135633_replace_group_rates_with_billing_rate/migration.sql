/*
  Warnings:

  - You are about to drop the column `hourlyRate` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `overtimeRate` on the `groups` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "groups" DROP COLUMN "hourlyRate",
DROP COLUMN "overtimeRate",
ADD COLUMN     "billingRate" DECIMAL(10,2);
