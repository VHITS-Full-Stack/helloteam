CREATE TABLE "notification_settings" (
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

CREATE UNIQUE INDEX "notification_settings_notificationType_key" ON "notification_settings"("notificationType");

-- Seed the initial notification type
INSERT INTO "notification_settings" ("id", "notificationType", "label", "description", "isEnabled", "recipients", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LUNCH_OVERDUE_10MIN',
  'Employee 10+ minutes past lunch break end',
  'Alert sent when an employee is still on lunch break 10 or more minutes past their scheduled end time.',
  true,
  '{}',
  NOW()
);
