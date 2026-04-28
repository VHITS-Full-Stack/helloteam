-- Add lunch duration to ClientPolicy (default 30 minutes)
ALTER TABLE "client_policies" ADD COLUMN "lunchDurationMinutes" INTEGER NOT NULL DEFAULT 30;

-- Add lunch duration override to ClientEmployee
ALTER TABLE "client_employees" ADD COLUMN "lunchDurationMinutes" INTEGER;

-- Add lunch break tracking fields to Break
ALTER TABLE "breaks"
  ADD COLUMN "isLunch"                  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduledDurationMinutes" INTEGER,
  ADD COLUMN "paidMinutes"              INTEGER,
  ADD COLUMN "unpaidMinutes"            INTEGER,
  ADD COLUMN "lunchStatus"              TEXT,
  ADD COLUMN "warningFiredAt"           TIMESTAMP(3),
  ADD COLUMN "alertEmailSent"           BOOLEAN NOT NULL DEFAULT false;
