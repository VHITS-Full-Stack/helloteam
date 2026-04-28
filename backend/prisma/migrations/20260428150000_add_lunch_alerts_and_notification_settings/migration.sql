-- Create lunch_break_alerts table
CREATE TABLE IF NOT EXISTS "lunch_break_alerts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "minutesPast" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lunch_break_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lunch_break_alerts_employeeId_createdAt_idx" ON "lunch_break_alerts"("employeeId", "createdAt");

ALTER TABLE "lunch_break_alerts" ADD CONSTRAINT "lunch_break_alerts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS "notification_settings" (
    "id" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recipients" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_settings_notificationType_key" ON "notification_settings"("notificationType");

-- Seed the initial notification type
INSERT INTO "notification_settings" ("id", "notificationType", "label", "description", "isEnabled", "recipients", "updatedAt")
VALUES (
    gen_random_uuid(),
    'lunch_break_10min_past',
    'Employee 10+ minutes past lunch break end',
    'Alert sent when an employee is still on lunch break 10 or more minutes past their scheduled end time.',
    true,
    '{}',
    NOW()
) ON CONFLICT ("notificationType") DO NOTHING;
