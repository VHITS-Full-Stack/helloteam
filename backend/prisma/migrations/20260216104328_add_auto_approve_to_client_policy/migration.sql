-- AlterTable
ALTER TABLE "client_policies" ADD COLUMN     "autoApproveMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "autoApproveTimesheets" BOOLEAN NOT NULL DEFAULT false;
