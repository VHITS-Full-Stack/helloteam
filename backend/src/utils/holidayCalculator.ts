/**
 * US Federal Holiday Calculator
 * Computes correct dates for federal holidays each year,
 * including floating holidays and observed date rules.
 */

export interface HolidayRule {
  key: string;
  name: string;
  type: 'fixed' | 'floating';
  month: number; // 0-indexed (Jan=0, Dec=11)
  day?: number; // For fixed holidays
  weekday?: number; // 0=Sun, 1=Mon, ..., 6=Sat — for floating holidays
  occurrence?: number; // 1st, 2nd, 3rd, 4th — for floating holidays
  isLast?: boolean; // true = last occurrence of weekday in month (e.g., Memorial Day)
}

export interface ComputedHoliday {
  key: string;
  name: string;
  date: string; // YYYY-MM-DD
  observed?: string; // YYYY-MM-DD if different from actual date
}

export const US_FEDERAL_HOLIDAYS: HolidayRule[] = [
  { key: 'new_years', name: "New Year's Day", type: 'fixed', month: 0, day: 1 },
  { key: 'mlk', name: 'Birthday of Martin Luther King, Jr.', type: 'floating', month: 0, weekday: 1, occurrence: 3 },
  { key: 'presidents', name: "Washington's Birthday (Presidents' Day)", type: 'floating', month: 1, weekday: 1, occurrence: 3 },
  { key: 'memorial', name: 'Memorial Day', type: 'floating', month: 4, weekday: 1, isLast: true },
  { key: 'juneteenth', name: 'Juneteenth National Independence Day', type: 'fixed', month: 5, day: 19 },
  { key: 'independence', name: 'Independence Day', type: 'fixed', month: 6, day: 4 },
  { key: 'labor', name: 'Labor Day', type: 'floating', month: 8, weekday: 1, occurrence: 1 },
  { key: 'columbus', name: 'Columbus Day', type: 'floating', month: 9, weekday: 1, occurrence: 2 },
  { key: 'veterans', name: 'Veterans Day', type: 'fixed', month: 10, day: 11 },
  { key: 'thanksgiving', name: 'Thanksgiving Day', type: 'floating', month: 10, weekday: 4, occurrence: 4 },
  { key: 'christmas', name: 'Christmas Day', type: 'fixed', month: 11, day: 25 },
];

/**
 * Get the Nth occurrence of a weekday in a given month/year.
 * e.g., 3rd Monday of January 2026
 */
function getNthWeekday(year: number, month: number, weekday: number, occurrence: number): Date {
  const firstDay = new Date(year, month, 1);
  let firstOccurrence = firstDay.getDay();
  let dayOfMonth = 1 + ((weekday - firstOccurrence + 7) % 7);
  // dayOfMonth is now the first occurrence of `weekday` in the month
  dayOfMonth += (occurrence - 1) * 7;
  return new Date(year, month, dayOfMonth);
}

/**
 * Get the last occurrence of a weekday in a given month/year.
 * e.g., last Monday of May 2026
 */
function getLastWeekday(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0); // Last day of month
  const lastDayOfWeek = lastDay.getDay();
  const diff = (lastDayOfWeek - weekday + 7) % 7;
  return new Date(year, month, lastDay.getDate() - diff);
}

/**
 * Get the observed date for a federal holiday.
 * If falls on Saturday → observed Friday; if Sunday → observed Monday.
 */
function getObservedDate(date: Date): Date {
  const day = date.getDay();
  if (day === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1); // Saturday → Friday
  if (day === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1); // Sunday → Monday
  return date;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate the date for a single holiday rule in a given year.
 */
export function calculateHolidayDate(rule: HolidayRule, year: number): ComputedHoliday {
  let actualDate: Date;

  if (rule.type === 'fixed') {
    actualDate = new Date(year, rule.month, rule.day!);
  } else if (rule.isLast) {
    actualDate = getLastWeekday(year, rule.month, rule.weekday!);
  } else {
    actualDate = getNthWeekday(year, rule.month, rule.weekday!, rule.occurrence!);
  }

  const observedDate = rule.type === 'fixed' ? getObservedDate(actualDate) : actualDate;
  const actual = formatDate(actualDate);
  const observed = formatDate(observedDate);

  return {
    key: rule.key,
    name: rule.name,
    date: observed, // Use observed date as the effective date
    ...(actual !== observed ? { observed } : {}),
  };
}

/**
 * Get all US federal holidays for a given year.
 */
export function getFederalHolidays(year: number): ComputedHoliday[] {
  return US_FEDERAL_HOLIDAYS.map((rule) => calculateHolidayDate(rule, year));
}

/**
 * Get selected federal holidays for a given year.
 * @param selectedKeys - Array of holiday keys (e.g., ['new_years', 'mlk', 'christmas'])
 * @param year - The year to compute dates for
 */
export function getSelectedFederalHolidays(selectedKeys: string[], year: number): ComputedHoliday[] {
  return US_FEDERAL_HOLIDAYS
    .filter((rule) => selectedKeys.includes(rule.key))
    .map((rule) => calculateHolidayDate(rule, year));
}
