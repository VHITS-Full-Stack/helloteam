-- AlterTable
ALTER TABLE "notification_settings" ALTER COLUMN "recipients" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "lunch_break_alerts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "minutesPast" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lunch_break_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lunch_break_alerts_employeeId_createdAt_idx" ON "lunch_break_alerts"("employeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "lunch_break_alerts" ADD CONSTRAINT "lunch_break_alerts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
