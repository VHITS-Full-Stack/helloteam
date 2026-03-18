-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'CLIENT_PAID';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "clientPaidAt" TIMESTAMP(3),
ADD COLUMN     "clientPaidBy" TEXT;
