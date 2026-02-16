-- Fix time_records.date field that was stored with wrong date due to timezone bug
-- The date was being set using setHours(0,0,0,0) which creates midnight local (IST),
-- but when sent to PostgreSQL it was converted to UTC, shifting the date back by 1 day.
--
-- This script recalculates the date from actualStart (stored in UTC) by adding IST offset (+5:30).

-- Preview the changes first (run this SELECT to verify before running UPDATE):
-- SELECT id, date AS old_date, ("actualStart" + INTERVAL '5 hours 30 minutes')::date AS new_date, "actualStart"
-- FROM time_records
-- WHERE "actualStart" IS NOT NULL;

-- Apply the fix:
UPDATE time_records
SET date = ("actualStart" + INTERVAL '5 hours 30 minutes')::date
WHERE "actualStart" IS NOT NULL;
