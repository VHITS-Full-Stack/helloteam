-- CreateTable
CREATE TABLE "schedule_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clientTimezone" TEXT,
    "storedStart" TEXT,
    "storedEnd" TEXT,
    "isOffShift" BOOLEAN NOT NULL DEFAULT false,
    "effectiveStart" TEXT,
    "effectiveEnd" TEXT,
    "arrivalStatus" TEXT,
    "otRequestId" TEXT,
    "otRequestStart" TEXT,
    "otRequestEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_logs_sessionId_idx" ON "schedule_logs"("sessionId");

-- CreateIndex
CREATE INDEX "schedule_logs_employeeId_idx" ON "schedule_logs"("employeeId");

-- CreateIndex
CREATE INDEX "schedule_logs_date_idx" ON "schedule_logs"("date");

-- CreateIndex
CREATE INDEX "schedule_logs_createdAt_idx" ON "schedule_logs"("createdAt");
