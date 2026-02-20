-- AlterEnum
ALTER TYPE "ApprovalStatus" ADD VALUE 'REVISION_REQUESTED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REVISION_REQUESTED';

-- AlterTable
ALTER TABLE "time_records" ADD COLUMN "revisionReason" TEXT;
ALTER TABLE "time_records" ADD COLUMN "revisionRequestedBy" TEXT;
ALTER TABLE "time_records" ADD COLUMN "revisionRequestedAt" TIMESTAMP(3);
