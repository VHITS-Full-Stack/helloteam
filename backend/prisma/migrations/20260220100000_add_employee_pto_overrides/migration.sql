-- AlterTable
ALTER TABLE "client_employees" ADD COLUMN "ptoAllowPaidLeave" BOOLEAN;
ALTER TABLE "client_employees" ADD COLUMN "ptoEntitlementType" "PaidLeaveEntitlementType";
ALTER TABLE "client_employees" ADD COLUMN "ptoAnnualDays" INTEGER;
ALTER TABLE "client_employees" ADD COLUMN "ptoAccrualRatePerMonth" DECIMAL(5,2);
ALTER TABLE "client_employees" ADD COLUMN "ptoMaxCarryoverDays" INTEGER;
ALTER TABLE "client_employees" ADD COLUMN "ptoCarryoverExpiryMonths" INTEGER;
ALTER TABLE "client_employees" ADD COLUMN "ptoAllowUnpaidLeave" BOOLEAN;
