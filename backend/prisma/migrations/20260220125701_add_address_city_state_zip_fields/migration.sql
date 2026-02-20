-- AlterTable
ALTER TABLE "client_agreements" ADD COLUMN     "businessCity" TEXT,
ADD COLUMN     "businessState" TEXT,
ADD COLUMN     "businessZip" TEXT,
ADD COLUMN     "signerCity" TEXT,
ADD COLUMN     "signerState" TEXT,
ADD COLUMN     "signerZip" TEXT;
