-- AlterTable
ALTER TABLE "client_requests" ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvalProofFileName" TEXT,
ADD COLUMN     "approvalProofKey" TEXT,
ADD COLUMN     "approvalProofUrl" TEXT;
