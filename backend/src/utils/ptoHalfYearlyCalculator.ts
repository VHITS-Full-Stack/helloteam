/** Calculate inclusive days between two dates */
export function calculateLeaveDays(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay)) + 1;
}

/**
 * PTO Half-Yearly Accumulation Calculator
 *
 * Rules:
 * - Employee earns `daysPerBlock` PTO days for every 6-month period worked.
 * - First block (months 0–5) = 0 days. Days unlock AFTER completing the first 6 months.
 * - Block 1 (months 6–11) = daysPerBlock, Block 2 (months 12–17) = daysPerBlock, etc.
 * - Days do NOT roll over. Unused days from a previous block are forfeited.
 */

export interface HalfYearlyBlockInfo {
  /** 0-indexed block number (block 0 = first 6 months, not yet eligible) */
  blockNumber: number;
  /** Start date of the current block */
  blockStart: Date;
  /** End date (exclusive) of the current block */
  blockEnd: Date;
  /** Whether the employee has completed enough time for PTO */
  isEligible: boolean;
  /** Days entitled in this block (0 if not eligible) */
  entitledDays: number;
}

/**
 * Add `months` whole months to a date, preserving the day-of-month
 * (clamped to the last day of the target month if necessary).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // If the day overflowed (e.g. Jan 31 + 1 month → Mar 3), clamp to last day
  if (result.getDate() !== date.getDate()) {
    result.setDate(0); // last day of previous month
  }
  return result;
}

/**
 * Calculate which 6-month block an employee is currently in,
 * based on their hire date.
 */
export function calculateCurrentBlock(
  hireDate: Date,
  currentDate: Date,
  daysPerBlock: number
): HalfYearlyBlockInfo {
  const hire = new Date(hireDate);
  hire.setHours(0, 0, 0, 0);
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);

  // If current date is before hire date, not eligible
  if (now < hire) {
    return {
      blockNumber: 0,
      blockStart: hire,
      blockEnd: addMonths(hire, 6),
      isEligible: false,
      entitledDays: 0,
    };
  }

  // Calculate how many full 6-month periods have elapsed since hire
  // We iterate blocks because month arithmetic with varying month lengths
  // is safest done incrementally.
  let blockNumber = 0;
  while (true) {
    const blockEnd = addMonths(hire, (blockNumber + 1) * 6);
    if (now < blockEnd) break;
    blockNumber++;
  }

  const blockStart = addMonths(hire, blockNumber * 6);
  const blockEnd = addMonths(hire, (blockNumber + 1) * 6);

  // Block 0 (first 6 months) is NOT eligible — days unlock after completing it
  const isEligible = blockNumber >= 1;
  const entitledDays = isEligible ? daysPerBlock : 0;

  return {
    blockNumber,
    blockStart,
    blockEnd,
    isEligible,
    entitledDays,
  };
}
