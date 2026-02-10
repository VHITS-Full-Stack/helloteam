/*
  Warnings:

  - You are about to drop the column `color` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `groups` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "groups" DROP COLUMN "color",
DROP COLUMN "icon";
