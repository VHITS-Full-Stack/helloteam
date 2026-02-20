import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

interface LogRateChangeParams {
  employeeId: string;
  clientId?: string | null;
  changedBy: string;
  changedByName?: string;
  rateType: 'BILLING_RATE' | 'PAYABLE_RATE' | 'HOURLY_RATE' | 'OVERTIME_RATE';
  oldValue: Decimal | number | string | null | undefined;
  newValue: Decimal | number | string | null | undefined;
  source: 'EMPLOYEE_PROFILE' | 'CLIENT_ASSIGNMENT';
  notes?: string;
}

function toDecimalOrNull(val: Decimal | number | string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return typeof val === 'object' && 'toNumber' in val ? val.toNumber() : Number(val);
}

export async function logRateChange(params: LogRateChangeParams): Promise<void> {
  const oldNum = toDecimalOrNull(params.oldValue);
  const newNum = toDecimalOrNull(params.newValue);

  // Skip if no actual change
  if (oldNum === newNum) return;
  if (oldNum === null && newNum === null) return;

  try {
    await prisma.rateChangeHistory.create({
      data: {
        employeeId: params.employeeId,
        clientId: params.clientId || null,
        changedBy: params.changedBy,
        changedByName: params.changedByName || null,
        rateType: params.rateType,
        oldValue: oldNum,
        newValue: newNum,
        source: params.source,
        notes: params.notes || null,
      },
    });
  } catch (error) {
    console.error('Failed to log rate change:', error);
    // Don't throw - rate change logging should not block the main operation
  }
}
