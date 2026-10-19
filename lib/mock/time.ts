/**
 * Mock timestamps are generated relative to today in Berlin wall-clock time,
 * so the feed always has something upcoming no matter when it is opened.
 */

const tz = "Europe/Berlin";

const pad = (n: number) => String(n).padStart(2, "0");

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: tz,
});

/** "+02:00" in summer, "+01:00" in winter. */
function berlinOffset(instant: Date): string {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).format(instant);
  const match = label.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "+01:00";
}

/** Berlin-local timestamp, `dayOffset` days from today at `hh:mm`. */
export function at(dayOffset: number, hh: number, mm = 0): string {
  const base = new Date();
  base.setDate(base.getDate() + dayOffset);
  const ymd = ymdFmt.format(base);
  const probe = new Date(`${ymd}T${pad(hh)}:${pad(mm)}:00Z`);
  return `${ymd}T${pad(hh)}:${pad(mm)}:00${berlinOffset(probe)}`;
}

/** `minutes` before now, for chat history and notification rows. */
export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

export function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

export function daysAgo(days: number): string {
  return minutesAgo(days * 24 * 60);
}

/** Next occurrence of a weekday (1 = Monday … 7 = Sunday), today excluded. */
export function nextWeekday(weekday: number, hh: number, mm = 0): string {
  const today = new Date();
  const current = today.getDay() === 0 ? 7 : today.getDay();
  const offset = ((weekday - current + 7 - 1) % 7) + 1;
  return at(offset, hh, mm);
}
