import { PaidLeaveEntitlementType } from '@prisma/client';

export interface EffectivePtoConfig {
  allowPaidLeave: boolean;
  paidLeaveEntitlementType: PaidLeaveEntitlementType;
  annualPaidLeaveDays: number;
  accrualRatePerMonth: number | null;
  maxCarryoverDays: number;
  carryoverExpiryMonths: number | null;
  allowUnpaidLeave: boolean;
  allowPaidHolidays: boolean;
  allowUnpaidHolidays: boolean;
  source: 'employee_override' | 'client_policy' | 'none';
}

interface ClientPolicyInput {
  allowPaidLeave: boolean;
  paidLeaveEntitlementType: PaidLeaveEntitlementType;
  annualPaidLeaveDays: number;
  accrualRatePerMonth: any; // Prisma Decimal
  maxCarryoverDays: number;
  carryoverExpiryMonths: number | null;
  allowUnpaidLeave: boolean;
  allowPaidHolidays: boolean;
  allowUnpaidHolidays: boolean;
}

interface ClientEmployeeInput {
  ptoAllowPaidLeave: boolean | null;
  ptoEntitlementType: PaidLeaveEntitlementType | null;
  ptoAnnualDays: number | null;
  ptoAccrualRatePerMonth: any; // Prisma Decimal
  ptoMaxCarryoverDays: number | null;
  ptoCarryoverExpiryMonths: number | null;
  ptoAllowUnpaidLeave: boolean | null;
  ptoAllowPaidHolidays: boolean | null;
  ptoAllowUnpaidHolidays: boolean | null;
}

export function resolveEffectivePtoConfig(
  clientPolicy: ClientPolicyInput | null | undefined,
  clientEmployee: ClientEmployeeInput | null | undefined
): EffectivePtoConfig {
  // No policy at all
  if (!clientPolicy) {
    return {
      allowPaidLeave: false,
      paidLeaveEntitlementType: 'NONE' as PaidLeaveEntitlementType,
      annualPaidLeaveDays: 0,
      accrualRatePerMonth: null,
      maxCarryoverDays: 0,
      carryoverExpiryMonths: null,
      allowUnpaidLeave: true,
      allowPaidHolidays: false,
      allowUnpaidHolidays: false,
      source: 'none',
    };
  }

  const hasOverride = clientEmployee && (
    clientEmployee.ptoAllowPaidLeave !== null ||
    clientEmployee.ptoEntitlementType !== null ||
    clientEmployee.ptoAnnualDays !== null ||
    clientEmployee.ptoAccrualRatePerMonth !== null ||
    clientEmployee.ptoMaxCarryoverDays !== null ||
    clientEmployee.ptoCarryoverExpiryMonths !== null ||
    clientEmployee.ptoAllowUnpaidLeave !== null ||
    clientEmployee.ptoAllowPaidHolidays !== null ||
    clientEmployee.ptoAllowUnpaidHolidays !== null
  );

  return {
    allowPaidLeave: clientEmployee?.ptoAllowPaidLeave ?? clientPolicy.allowPaidLeave,
    paidLeaveEntitlementType: clientEmployee?.ptoEntitlementType ?? clientPolicy.paidLeaveEntitlementType,
    annualPaidLeaveDays: clientEmployee?.ptoAnnualDays ?? clientPolicy.annualPaidLeaveDays,
    accrualRatePerMonth: clientEmployee?.ptoAccrualRatePerMonth != null
      ? Number(clientEmployee.ptoAccrualRatePerMonth)
      : (clientPolicy.accrualRatePerMonth != null ? Number(clientPolicy.accrualRatePerMonth) : null),
    maxCarryoverDays: clientEmployee?.ptoMaxCarryoverDays ?? clientPolicy.maxCarryoverDays,
    carryoverExpiryMonths: clientEmployee?.ptoCarryoverExpiryMonths ?? clientPolicy.carryoverExpiryMonths ?? null,
    allowUnpaidLeave: clientEmployee?.ptoAllowUnpaidLeave ?? clientPolicy.allowUnpaidLeave,
    allowPaidHolidays: clientEmployee?.ptoAllowPaidHolidays ?? clientPolicy.allowPaidHolidays,
    allowUnpaidHolidays: clientEmployee?.ptoAllowUnpaidHolidays ?? clientPolicy.allowUnpaidHolidays,
    source: hasOverride ? 'employee_override' : 'client_policy',
  };
}
