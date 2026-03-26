-- CreateTable
CREATE TABLE "payroll_date_logs" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "previousDate" TIMESTAMP(3),
    "newDate" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_date_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_date_logs_periodId_idx" ON "payroll_date_logs"("periodId");
