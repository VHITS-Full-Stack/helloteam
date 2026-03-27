/**
 * Time formatting utilities — mirrors backend/src/utils/timezone.ts
 */

/** Convert minutes to decimal hours with 2-decimal precision */
export const minutesToHours = (minutes) => {
  return Math.round((minutes / 60) * 100) / 100;
};

/** Format minutes into human-readable duration (e.g., "2h 30m", "45m", "8h") */
export const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

/** Convert "HH:MM" (24h) or "HH:MM AM/PM" to "h:MM AM/PM EST" (12h) */
export const formatTime12 = (timeStr) => {
  if (!timeStr) return '';
  // Already 12h format — return as-is
  if (/AM|PM/i.test(timeStr)) return timeStr;
  // 24h "HH:MM" format — convert to 12h
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }
  return timeStr;
};

/** Format decimal hours into human-readable duration (e.g., "2h 30m", "45m", "8h") */
export const formatHours = (decimalHours) => {
  if (decimalHours === null || decimalHours === undefined || decimalHours === 0) return '0m';
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};
