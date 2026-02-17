-- AlterTable
ALTER TABLE "time_records" ADD COLUMN "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "time_records_invoiceId_idx" ON "time_records"("invoiceId");
