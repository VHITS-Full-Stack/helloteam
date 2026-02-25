/**
 * Common timezone utility functions.
 * All timezone-related helpers live here to avoid duplication across controllers and jobs.
 */

/** Get current hours/minutes and day-of-week in a given timezone */
export const getTimeInTimezone = (timezone: string, date: Date = new Date()) => {
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const timeParts = timeFmt.formatToParts(date);
  const hour = parseInt(timeParts.find((p) => p.type === 'hour')?.value || '0');
  const minute = parseInt(timeParts.find((p) => p.type === 'minute')?.value || '0');

  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' });
  const dayName = dayFmt.format(date);
  const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

  return {
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
    dayOfWeek: dayMap[dayName] ?? date.getDay(),
  };
};

/** Build a UTC Date for "today at HH:MM" in a given timezone. Derives "today" from refDate formatted in the timezone. */
export const buildScheduleTimestamp = (timezone: string, timeStr: string, refDate: Date = new Date()): Date => {
  const [h, m] = timeStr.split(':').map(Number);
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dp = dateFmt.formatToParts(refDate);
  const year = dp.find((p) => p.type === 'year')?.value;
  const month = dp.find((p) => p.type === 'month')?.value;
  const day = dp.find((p) => p.type === 'day')?.value;
  const isoAsUTC = new Date(`${year}-${month}-${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = refDate.toLocaleString('en-US', { timeZone: timezone });
  const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();
  return new Date(isoAsUTC.getTime() + offsetMs);
};

/** Build a UTC Date for "calendarDate at HH:MM" in a given timezone. Uses UTC date components directly — for @db.Date fields. */
export const buildTimestampFromDate = (calendarDate: Date, timeStr: string, timezone: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const y = calendarDate.getUTCFullYear();
  const m = String(calendarDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(calendarDate.getUTCDate()).padStart(2, '0');
  const naiveUTC = new Date(`${y}-${m}-${d}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);
  try {
    const utcStr = naiveUTC.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = naiveUTC.toLocaleString('en-US', { timeZone: timezone });
    const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();
    return new Date(naiveUTC.getTime() + offsetMs);
  } catch {
    return naiveUTC;
  }
};

/** Get day-of-week in a given timezone (0=Sun, 1=Mon, ..., 6=Sat) */
export const getDayOfWeekInTimezone = (timezone: string, refDate: Date = new Date()): number => {
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' });
  const dayName = dayFmt.format(refDate);
  const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  return dayMap[dayName] ?? refDate.getDay();
};

/** Convert "HH:MM" (24h) to "h:MM AM/PM" (12h) */
export const formatTime12 = (timeStr: string): string => {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr || '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

/** Get timezone abbreviation (e.g. "EST", "PST") */
export const getTimezoneAbbr = (date: Date, tz: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value || tz;
  } catch {
    return 'UTC';
  }
};

/** Format a Date as "h:mm am (EST)" in a given timezone */
export const formatTimeInTz = (date: Date, tz: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const timeStr = formatter.format(date).toLowerCase();
    const abbr = getTimezoneAbbr(date, tz);
    return `${timeStr} (${abbr})`;
  } catch {
    return date.toISOString();
  }
};

/** Get YYYY-MM-DD date key by converting a timestamp to client timezone */
export const getDateKeyInTz = (date: Date, tz: string): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
};

/**
 * Get YYYY-MM-DD from a Prisma @db.Date field.
 * These are stored as midnight UTC but represent a calendar date, NOT a point in time.
 * Must use UTC components directly — do NOT convert through timezone.
 */
export const getDateKeyFromDateField = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Format "YYYY-MM-DD" as long form: "January 12, 2026" using client timezone */
export const formatLongDate = (dateKey: string, tz: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const refDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return formatter.format(refDate);
};

/** Get ISO week number for a date */
export const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};
