-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "kycRejectionNote" TEXT,
ADD COLUMN     "kycReviewedAt" TIMESTAMP(3),
ADD COLUMN     "kycReviewerId" TEXT,
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING';
