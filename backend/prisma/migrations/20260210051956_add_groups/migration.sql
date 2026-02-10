/*
  Warnings:

  - You are about to drop the column `paidLeaveType` on the `client_policies` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employeeId,clientId,date]` on the table `time_records` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `description` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `action` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaidLeaveEntitlementType" AS ENUM ('NONE', 'FIXED', 'FIXED_HALF_YEARLY', 'ACCRUED', 'MILESTONE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPROVAL_REQUIRED', 'APPROVAL_RECEIVED', 'TIME_APPROVED', 'TIME_REJECTED', 'LEAVE_REQUEST', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'OVERTIME_REQUEST', 'OVERTIME_APPROVED', 'OVERTIME_REJECTED', 'PAYROLL_REMINDER', 'SCHEDULE_CHANGE', 'SYSTEM_ALERT');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('OPEN', 'PENDING_APPROVAL', 'LOCKED', 'FINALIZED');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "userId" SET NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" "AuditAction" NOT NULL;

-- AlterTable
ALTER TABLE "client_employees" ADD COLUMN     "hourlyRate" DECIMAL(10,2),
ADD COLUMN     "overtimeRate" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "client_policies" DROP COLUMN "paidLeaveType",
ADD COLUMN     "accrualRatePerMonth" DECIMAL(5,2),
ADD COLUMN     "carryoverExpiryMonths" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
ADD COLUMN     "defaultHourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "defaultOvertimeRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "maxCarryoverDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "milestoneBonusDays" INTEGER,
ADD COLUMN     "milestoneYearsRequired" INTEGER,
ADD COLUMN     "notifyInvoice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLeaveRequests" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOvertimeAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyTimeEntrySubmissions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWeeklySummary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overtimeThreshold" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "paidLeaveEntitlementType" "PaidLeaveEntitlementType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "timeFormat" TEXT NOT NULL DEFAULT '12-hour',
ADD COLUMN     "workWeekStart" TEXT NOT NULL DEFAULT 'Sunday';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "billingRate" DECIMAL(10,2),
ADD COLUMN     "notifyLeaveApprovals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPushMessages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyScheduleChanges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyShiftReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWeeklySummary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payableRate" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "data" JSONB,
DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "work_sessions" ADD COLUMN     "ipAddress" TEXT;

-- CreateTable
CREATE TABLE "session_logs" (
    "id" TEXT NOT NULL,
    "workSessionId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_adjustments" (
    "id" TEXT NOT NULL,
    "timeRecordId" TEXT NOT NULL,
    "adjustedBy" TEXT NOT NULL,
    "adjustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "oldTotalMinutes" INTEGER,
    "newTotalMinutes" INTEGER,
    "minutesDifference" INTEGER,
    "requiresReapproval" BOOLEAN NOT NULL DEFAULT true,
    "clientReapprovedBy" TEXT,
    "clientReapprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "paidLeaveEntitled" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "paidLeaveUsed" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "paidLeaveCarryover" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "paidLeavePending" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unpaidLeaveTaken" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unpaidLeavePending" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lastAccrualDate" TIMESTAMP(3),
    "accruedToDate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance_adjustments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedBy" TEXT NOT NULL,
    "adjustedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requestedMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'OPEN',
    "totalHours" DECIMAL(10,2),
    "totalOvertimeHours" DECIMAL(10,2),
    "approvedHours" DECIMAL(10,2),
    "pendingHours" DECIMAL(10,2),
    "finalizedAt" TIMESTAMP(3),
    "finalizedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_employees" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_logs_workSessionId_createdAt_idx" ON "session_logs"("workSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "time_adjustments_timeRecordId_idx" ON "time_adjustments"("timeRecordId");

-- CreateIndex
CREATE INDEX "time_adjustments_adjustedBy_idx" ON "time_adjustments"("adjustedBy");

-- CreateIndex
CREATE INDEX "time_adjustments_adjustedAt_idx" ON "time_adjustments"("adjustedAt");

-- CreateIndex
CREATE INDEX "leave_balances_employeeId_year_idx" ON "leave_balances"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employeeId_clientId_year_key" ON "leave_balances"("employeeId", "clientId", "year");

-- CreateIndex
CREATE INDEX "leave_balance_adjustments_employeeId_year_idx" ON "leave_balance_adjustments"("employeeId", "year");

-- CreateIndex
CREATE INDEX "overtime_requests_clientId_status_idx" ON "overtime_requests"("clientId", "status");

-- CreateIndex
CREATE INDEX "overtime_requests_employeeId_date_idx" ON "overtime_requests"("employeeId", "date");

-- CreateIndex
CREATE INDEX "payroll_periods_clientId_status_idx" ON "payroll_periods"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_clientId_periodStart_periodEnd_key" ON "payroll_periods"("clientId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_category_key_key" ON "system_settings"("category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "group_employees_groupId_employeeId_key" ON "group_employees"("groupId", "employeeId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "time_records_employeeId_clientId_date_key" ON "time_records"("employeeId", "clientId", "date");

-- AddForeignKey
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "work_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_adjustments" ADD CONSTRAINT "time_adjustments_timeRecordId_fkey" FOREIGN KEY ("timeRecordId") REFERENCES "time_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_adjustments" ADD CONSTRAINT "time_adjustments_adjustedBy_fkey" FOREIGN KEY ("adjustedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_employees" ADD CONSTRAINT "group_employees_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_employees" ADD CONSTRAINT "group_employees_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
