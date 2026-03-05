-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "governmentId2RejectNote" TEXT,
ADD COLUMN     "governmentId2Status" "KycStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "governmentIdRejectNote" TEXT,
ADD COLUMN     "governmentIdStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "proofOfAddressRejectNote" TEXT,
ADD COLUMN     "proofOfAddressStatus" "KycStatus" NOT NULL DEFAULT 'PENDING';
