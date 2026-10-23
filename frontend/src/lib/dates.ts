/**
 * Explicit Europe/London timezone date and time formatting utilities.
 * All backend timestamps are timezone-aware ISO strings.
 * Formatting explicitly enforces timeZone: "Europe/London".
 */

const londonDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const londonDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const londonTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const londonShortDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Format an ISO timestamp to "15 Jan 2026, 09:20 GMT" in Europe/London.
 */
export function formatLondonDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "Invalid date";
  return `${londonDateTimeFormatter.format(d)} GMT`;
}

/**
 * Format an ISO timestamp to "15 Jan 2026" in Europe/London.
 */
export function formatLondonDate(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "Invalid date";
  return londonDateFormatter.format(d);
}

/**
 * Format an ISO timestamp to "09:20 GMT" in Europe/London.
 */
export function formatLondonTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "Invalid time";
  return `${londonTimeFormatter.format(d)} GMT`;
}

/**
 * Format an ISO timestamp or epoch milliseconds to "15 Jan, 09:20" in Europe/London.
 */
export function formatLondonShortDateTime(val: string | number): string {
  const d = new Date(val);
  if (isNaN(d.getTime())) return "Invalid date";
  return londonShortDateTimeFormatter.format(d);
}

/**
 * Format delivery hour 0..23 to "00:00" .. "23:00".
 */
export function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

/**
 * Format forecast age in minutes to "Xh Ym" or "Ym".
 */
export function formatForecastAge(minutes: number): string {
  if (minutes < 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours === 0) return `${remainingMins}m`;
  return `${hours}h ${remainingMins}m`;
}
