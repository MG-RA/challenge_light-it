import '../config/env';

// Calendar math in the suite time zone. env.ts pins process.env.TZ to TEST_TIMEZONE and the browser
// runs with the same `timezoneId`, so local Date fields here match what the app computes. Never
// derive a calendar date from toISOString(): that is the UTC date, which differs from the local one
// for part of every day outside UTC.

/** The calendar date `days` from today in the suite time zone, as YYYY-MM-DD. */
export function dateAfter(days: number, from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** How the app displays a calendar date, e.g. '2026-09-03' → '9/3/2026' (en-US, no leading zeros). */
export function displayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${Number(month)}/${Number(day)}/${Number(year)}`;
}

/**
 * The calendar date of an API appointment. The API sends UTC-midnight timestamps instead of the
 * documented YYYY-MM-DD (Part 1, BUG-03), so only the date part is meaningful.
 */
export function apiCalendarDate(value: string): string {
  return value.slice(0, 10);
}
