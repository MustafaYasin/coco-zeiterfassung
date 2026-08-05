import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { TimeEntry } from "@/lib/types";

/** Net worked minutes of a finished entry (or elapsed so far if running). */
export function workedMinutes(entry: TimeEntry, now = new Date()): number {
  const start = new Date(entry.started_at).getTime();
  const end = entry.ended_at
    ? new Date(entry.ended_at).getTime()
    : now.getTime();
  const gross = Math.round((end - start) / 60_000);
  return Math.max(0, gross - entry.break_minutes);
}

export function sumMinutes(entries: TimeEntry[]): number {
  return entries
    .filter((entry) => entry.ended_at)
    .reduce((total, entry) => total + workedMinutes(entry), 0);
}

/** "7:35 h" */
export function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.abs(minutes % 60);
  return `${h}:${String(m).padStart(2, "0")} h`;
}

export function fmtDay(iso: string): string {
  return format(new Date(iso), "EEE, d. MMM yyyy", { locale: de });
}

export function fmtTime(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

export function monthLabel(date: Date): string {
  return format(date, "MMMM yyyy", { locale: de });
}

/** [inclusive start, exclusive end] ISO strings for the month of `date`. */
export function monthRange(date: Date): [string, string] {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return [start.toISOString(), end.toISOString()];
}

export function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** Build an ISO timestamp from date + time inputs; rolls to next day if end < start. */
export function combineDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`);
}
