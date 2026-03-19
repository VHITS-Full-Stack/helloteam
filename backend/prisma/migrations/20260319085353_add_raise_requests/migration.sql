-- CreateEnum
CREATE TYPE "RaiseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "raise_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "additionalAmount" DECIMAL(10,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "status" "RaiseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raise_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raise_requests_clientId_idx" ON "raise_requests"("clientId");

-- CreateIndex
CREATE INDEX "raise_requests_employeeId_idx" ON "raise_requests"("employeeId");

-- CreateIndex
CREATE INDEX "raise_requests_status_idx" ON "raise_requests"("status");

-- AddForeignKey
ALTER TABLE "raise_requests" ADD CONSTRAINT "raise_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raise_requests" ADD CONSTRAINT "raise_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
