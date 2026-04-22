/**
 * Single entrypoint for all frontend date + time formatting helpers.
 *
 * NOTE: This file intentionally contains the implementations (not re-exports)
 * so the rest of the app imports from one place.
 */

// -------------------------
// Date helpers
// -------------------------

const DEFAULT_EMPTY_VALUE = "-";

const normalizeDateInput = (input, { dateOnlyAsUTC = false } = {}) => {
  if (!input) return null;
  if (input instanceof Date) return input;

  const s = String(input);
  // Normalize ISO date-only to avoid timezone shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return dateOnlyAsUTC ? new Date(`${s}T00:00:00Z`) : new Date(`${s}T00:00:00`);
  }
  return new Date(s);
};

const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

const formatSingleDate = (
  dateStr,
  { includeWeekday, includeYear, timeZone, dateOnlyAsUTC },
) => {
  const d = normalizeDateInput(dateStr, { dateOnlyAsUTC });
  if (!isValidDate(d)) return null;

  return d.toLocaleDateString("en-US", {
    weekday: includeWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone,
  });
};

/**
 * Format date-only / ISO strings, or a range like "YYYY-MM-DD to YYYY-MM-DD".
 */
export const formatDate = (
  dateStr,
  {
    emptyValue = DEFAULT_EMPTY_VALUE,
    includeWeekday = false,
    includeYear = true,
    timeZone,
    dateOnlyAsUTC = false,
  } = {},
) => {
  if (!dateStr) return emptyValue;

  // Handle date ranges represented as: "2026-02-03 to 2026-02-05"
  if (typeof dateStr === "string" && dateStr.includes(" to ")) {
    const [startStr, endStr] = dateStr.split(" to ");
    const startFormatted = formatSingleDate(startStr, {
      includeWeekday: false,
      includeYear,
      timeZone,
      dateOnlyAsUTC,
    });
    const endFormatted = formatSingleDate(endStr, {
      includeWeekday: false,
      includeYear,
      timeZone,
      dateOnlyAsUTC,
    });
    if (!startFormatted || !endFormatted) return emptyValue;
    if (startStr.trim() === endStr.trim()) return startFormatted;
    return `${startFormatted} - ${endFormatted}`;
  }

  const formatted = formatSingleDate(dateStr, {
    includeWeekday,
    includeYear,
    timeZone,
    dateOnlyAsUTC,
  });
  return formatted || emptyValue;
};

export const formatDateTime = (
  dateStr,
  {
    emptyValue = DEFAULT_EMPTY_VALUE,
    timeZone,
    includeWeekday = false,
    includeYear = false,
    dateOnlyAsUTC = false,
  } = {},
) => {
  if (!dateStr) return emptyValue;
  const d = normalizeDateInput(dateStr, { dateOnlyAsUTC });
  if (!isValidDate(d)) return emptyValue;

  return d.toLocaleString("en-US", {
    weekday: includeWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    year: includeYear ? "numeric" : undefined,
    ...(timeZone ? { timeZone } : null),
  });
};

// -------------------------
// Time helpers
// -------------------------

/** Format minutes into human-readable duration (e.g., "2h 30m", "45m", "8h") */
export const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return "0m";
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

/** Convert "HH:MM" (24h) or "HH:MM AM/PM" to "h:MM AM/PM" (12h) */
export const formatTime12 = (timeStr) => {
  if (!timeStr) return "";
  // Already 12h format — return as-is
  if (/AM|PM/i.test(timeStr)) return timeStr;
  // 24h "HH:MM" format — convert to 12h
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  }
  return timeStr;
};

export const formatTimeInTimeZone = (
  dateString,
  timeZone = "America/New_York",
  { hour12 = true } = {},
) => {
  if (!dateString) return "--:--";
  // Plain HH:MM string — no timezone conversion needed, just reformat
  if (typeof dateString === "string" && /^\d{1,2}:\d{2}$/.test(dateString)) {
    return formatTime12(dateString);
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "--:--";
  if (!hour12) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
    const hh = (parts.find(p => p.type === "hour")?.value || "00").replace(/^24/, "00");
    const mm = parts.find(p => p.type === "minute")?.value || "00";
    return `${hh}:${mm}`;
  }
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
};

/** Format decimal hours into human-readable duration (e.g., "2h 30m", "45m", "8h") */
export const formatHours = (decimalHours) => {
  const value = Number(decimalHours);
  if (!Number.isFinite(value) || value === 0) return "0m";
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

