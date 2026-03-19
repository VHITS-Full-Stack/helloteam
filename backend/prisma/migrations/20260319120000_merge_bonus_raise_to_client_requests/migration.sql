-- CreateEnum
CREATE TYPE "ClientRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ClientRequestType" AS ENUM ('BONUS', 'RAISE');

-- CreateTable
CREATE TABLE "client_requests" (
    "id" TEXT NOT NULL,
    "type" "ClientRequestType" NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "amount" DECIMAL(10,2),
    "payRate" DECIMAL(10,2),
    "billRate" DECIMAL(10,2),
    "effectiveDate" DATE,
    "reason" TEXT,
    "status" "ClientRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_requests_pkey" PRIMARY KEY ("id")
);

-- Migrate data from raise_requests to client_requests
INSERT INTO "client_requests" ("id", "type", "employeeId", "clientId", "requestedBy", "payRate", "billRate", "effectiveDate", "status", "adminNotes", "reviewedBy", "reviewedAt", "createdAt", "updatedAt")
SELECT "id", 'RAISE'::"ClientRequestType", "employeeId", "clientId", "requestedBy", "payRate", "billRate", "effectiveDate",
  CASE "status"
    WHEN 'PENDING' THEN 'PENDING'::"ClientRequestStatus"
    WHEN 'APPROVED' THEN 'APPROVED'::"ClientRequestStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"ClientRequestStatus"
  END,
  "adminNotes", "reviewedBy", "reviewedAt", "createdAt", "updatedAt"
FROM "raise_requests";

-- CreateIndexes
CREATE INDEX "client_requests_clientId_idx" ON "client_requests"("clientId");
CREATE INDEX "client_requests_employeeId_idx" ON "client_requests"("employeeId");
CREATE INDEX "client_requests_status_idx" ON "client_requests"("status");
CREATE INDEX "client_requests_type_idx" ON "client_requests"("type");

-- AddForeignKeys
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "raise_requests";

-- DropEnum (if not used elsewhere)
DROP TYPE IF EXISTS "RaiseRequestStatus";
