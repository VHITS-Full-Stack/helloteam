-- AlterTable
ALTER TABLE "client_policies" ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "notes" TEXT;
