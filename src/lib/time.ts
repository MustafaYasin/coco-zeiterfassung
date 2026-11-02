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

/** Running clock of an open entry as [hours, "mm", "ss"], net of breaks. */
export function elapsedParts(
  entry: TimeEntry,
  now = new Date(),
): [number, string, string] {
  const start = new Date(entry.started_at).getTime();
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - start) / 1000) - entry.break_minutes * 60,
  );
  return [
    Math.floor(seconds / 3600),
    String(Math.floor(seconds / 60) % 60).padStart(2, "0"),
    String(seconds % 60).padStart(2, "0"),
  ];
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

/** "Dienstag, 27. Oktober" */
export function fmtToday(date: Date): string {
  return format(date, "EEEE, d. MMMM", { locale: de });
}

/** ["Di", "27.10."] for compact list rows. */
export function fmtDayParts(iso: string): [string, string] {
  const date = new Date(iso);
  return [format(date, "EEE", { locale: de }), format(date, "d.M.")];
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
