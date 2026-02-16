-- CreateTable
CREATE TABLE "auto_approval_logs" (
    "id" TEXT NOT NULL,
    "timeRecordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "recordDate" DATE NOT NULL,
    "scheduledEnd" TEXT NOT NULL,
    "approvalDelay" INTEGER NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "clientTimezone" TEXT NOT NULL DEFAULT 'UTC',

    CONSTRAINT "auto_approval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_approval_logs_clientId_idx" ON "auto_approval_logs"("clientId");

-- CreateIndex
CREATE INDEX "auto_approval_logs_employeeId_idx" ON "auto_approval_logs"("employeeId");

-- CreateIndex
CREATE INDEX "auto_approval_logs_approvedAt_idx" ON "auto_approval_logs"("approvedAt");

-- AddForeignKey
ALTER TABLE "auto_approval_logs" ADD CONSTRAINT "auto_approval_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_approval_logs" ADD CONSTRAINT "auto_approval_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
