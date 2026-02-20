-- CreateTable
CREATE TABLE "rate_change_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedByName" TEXT,
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rateType" TEXT NOT NULL,
    "oldValue" DECIMAL(10,2),
    "newValue" DECIMAL(10,2),
    "source" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "rate_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_change_history_employeeId_idx" ON "rate_change_history"("employeeId");

-- CreateIndex
CREATE INDEX "rate_change_history_clientId_idx" ON "rate_change_history"("clientId");

-- CreateIndex
CREATE INDEX "rate_change_history_changeDate_idx" ON "rate_change_history"("changeDate");

-- AddForeignKey
ALTER TABLE "rate_change_history" ADD CONSTRAINT "rate_change_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
