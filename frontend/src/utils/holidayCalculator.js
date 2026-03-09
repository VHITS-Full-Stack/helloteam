/**
 * US Federal Holiday Calculator (Frontend)
 * Computes correct dates for federal holidays each year.
 */

const US_FEDERAL_HOLIDAYS = [
  { key: 'new_years', name: "New Year's Day", type: 'fixed', month: 0, day: 1 },
  { key: 'mlk', name: 'Martin Luther King Jr. Day', type: 'floating', month: 0, weekday: 1, occurrence: 3 },
  { key: 'presidents', name: "Presidents' Day", type: 'floating', month: 1, weekday: 1, occurrence: 3 },
  { key: 'memorial', name: 'Memorial Day', type: 'floating', month: 4, weekday: 1, isLast: true },
  { key: 'juneteenth', name: 'Juneteenth', type: 'fixed', month: 5, day: 19 },
  { key: 'independence', name: 'Independence Day', type: 'fixed', month: 6, day: 4 },
  { key: 'labor', name: 'Labor Day', type: 'floating', month: 8, weekday: 1, occurrence: 1 },
  { key: 'columbus', name: 'Columbus Day', type: 'floating', month: 9, weekday: 1, occurrence: 2 },
  { key: 'veterans', name: 'Veterans Day', type: 'fixed', month: 10, day: 11 },
  { key: 'thanksgiving', name: 'Thanksgiving Day', type: 'floating', month: 10, weekday: 4, occurrence: 4 },
  { key: 'christmas', name: 'Christmas Day', type: 'fixed', month: 11, day: 25 },
];

function getNthWeekday(year, month, weekday, occurrence) {
  const firstDay = new Date(year, month, 1);
  const firstOccurrence = firstDay.getDay();
  let dayOfMonth = 1 + ((weekday - firstOccurrence + 7) % 7);
  dayOfMonth += (occurrence - 1) * 7;
  return new Date(year, month, dayOfMonth);
}

function getLastWeekday(year, month, weekday) {
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastDay.getDay();
  const diff = (lastDayOfWeek - weekday + 7) % 7;
  return new Date(year, month, lastDay.getDate() - diff);
}

function getObservedDate(date) {
  const day = date.getDay();
  if (day === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  if (day === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return date;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function getFederalHolidaysForYear(year) {
  return US_FEDERAL_HOLIDAYS.map((rule) => {
    let actualDate;
    if (rule.type === 'fixed') {
      actualDate = new Date(year, rule.month, rule.day);
    } else if (rule.isLast) {
      actualDate = getLastWeekday(year, rule.month, rule.weekday);
    } else {
      actualDate = getNthWeekday(year, rule.month, rule.weekday, rule.occurrence);
    }

    const observedDate = rule.type === 'fixed' ? getObservedDate(actualDate) : actualDate;

    return {
      key: rule.key,
      name: rule.name,
      date: formatDate(observedDate),
      displayDate: formatDisplayDate(observedDate),
      isObserved: formatDate(actualDate) !== formatDate(observedDate),
    };
  });
}

export { US_FEDERAL_HOLIDAYS };
