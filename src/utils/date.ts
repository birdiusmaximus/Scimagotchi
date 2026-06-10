export function nowIso(): string {
  return new Date().toISOString();
}

/** Local YYYY-MM-DD key, used to group entries by day in the calendar. */
export function dayKey(iso: string = nowIso()): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function prettyTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function prettyDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return `${date} · ${prettyTime(iso)}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

/** Monday 00:00 of the week containing `d` (UK week starts Monday). */
export function startOfWeek(d: Date = new Date()): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (date.getDay() + 6) % 7; // Mon = 0
  date.setDate(date.getDate() - dow);
  return date;
}

export function weekKeyOf(d: Date = new Date()): string {
  const s = startOfWeek(d);
  const m = String(s.getMonth() + 1).padStart(2, '0');
  const day = String(s.getDate()).padStart(2, '0');
  return `${s.getFullYear()}-${m}-${day}`;
}

export function prettyWeekRange(weekStartIso: string): string {
  const s = new Date(weekStartIso);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const sm = s.toLocaleDateString([], { month: 'short' });
  const em = e.toLocaleDateString([], { month: 'short' });
  return sm === em
    ? `${s.getDate()}–${e.getDate()} ${sm}`
    : `${s.getDate()} ${sm} – ${e.getDate()} ${em}`;
}
