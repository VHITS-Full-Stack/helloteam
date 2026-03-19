/*
  Warnings:

  - You are about to drop the column `additionalAmount` on the `raise_requests` table. All the data in the column will be lost.
  - Added the required column `billRate` to the `raise_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payRate` to the `raise_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "raise_requests" DROP COLUMN "additionalAmount",
ADD COLUMN     "billRate" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "payRate" DECIMAL(10,2) NOT NULL;
