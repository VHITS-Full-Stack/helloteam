-- Add separate 2 weeks notice toggles for paid and unpaid leave
ALTER TABLE "client_policies" ADD COLUMN "requireTwoWeeksNoticePaidLeave" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "client_policies" ADD COLUMN "requireTwoWeeksNoticeUnpaidLeave" BOOLEAN NOT NULL DEFAULT true;

-- Copy existing value to both new columns
UPDATE "client_policies" SET
  "requireTwoWeeksNoticePaidLeave" = "requireTwoWeeksNotice",
  "requireTwoWeeksNoticeUnpaidLeave" = "requireTwoWeeksNotice";
