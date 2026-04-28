-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recipients" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lunch_break_alerts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "minutesPast" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lunch_break_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_notificationType_key" ON "notification_settings"("notificationType");

-- CreateIndex
CREATE INDEX "lunch_break_alerts_employeeId_createdAt_idx" ON "lunch_break_alerts"("employeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "lunch_break_alerts" ADD CONSTRAINT "lunch_break_alerts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
