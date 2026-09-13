import '../config/env';

// Calendar math in the suite time zone. env.ts pins process.env.TZ to TEST_TIMEZONE and the browser
// runs with the same `timezoneId`, so local Date fields here match what the app computes. Never
// derive a calendar date from toISOString(): that is the UTC date, which differs from the local one
// for part of every day outside UTC.

type Scheduled = { appointment_date: string; time_slot: string };

/** The calendar date `days` from today in the suite time zone, as YYYY-MM-DD. */
export function dateAfter(days: number, from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Start of a stored appointment in the suite time zone; Invalid Date for impossible slots such as 25:99. */
export function appointmentStart({ appointment_date, time_slot }: Scheduled): Date {
  return new Date(`${appointment_date}T${time_slot}`);
}

/** Proposed dashboard rule: an active or pending appointment that starts now or later. */
export function isUpcoming(row: Scheduled & { status: string }, now = new Date()): boolean {
  return ['active', 'pending'].includes(row.status) && appointmentStart(row) >= now;
}
