-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'APPROVED', 'DECLINED', 'ERROR', 'VOIDED', 'REFUNDED');

-- AlterTable
ALTER TABLE "client_agreements" ADD COLUMN     "solaAchToken" TEXT,
ADD COLUMN     "solaCardLastFour" TEXT,
ADD COLUMN     "solaCardToken" TEXT,
ADD COLUMN     "solaCardType" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL,
    "solaRefNum" TEXT,
    "solaAuthCode" TEXT,
    "solaAuthAmount" DECIMAL(10,2),
    "solaMaskedCard" TEXT,
    "solaCardType" TEXT,
    "solaToken" TEXT,
    "solaBatch" TEXT,
    "solaError" TEXT,
    "solaErrorCode" TEXT,
    "solaResult" TEXT,
    "solaDate" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_clientId_idx" ON "payments"("clientId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_solaRefNum_idx" ON "payments"("solaRefNum");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
