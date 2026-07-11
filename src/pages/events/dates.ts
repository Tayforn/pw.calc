// =========================================================
// Розклад Евентів: дата-математика і розгортання повторень (pure).
// Дні рахуємо тільки через setDate (не +n*86400e3) — DST-safe.
// =========================================================

import type { EvtItem, Occ } from './types';

export const DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
export const DOW_FULL = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
export const MONTH_NOM = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
export const MONTH_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** День тижня ISO: Пн = 0 … Нд = 6. */
export function isoDow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - isoDow(r));
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function minToHM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** 'HH:MM' → хвилини від опівночі; NaN-safe (null якщо не парситься). */
export function hmToMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 1440 ? v : null;
}

/** Появи евентів у день d, відсортовані за стартом. */
export function occurrencesForDay(events: EvtItem[], d: Date): Occ[] {
  const key = ymd(d);
  const dow = isoDow(d);
  const out: Occ[] = [];
  for (const evt of events) {
    const hit =
      evt.recur.kind === 'once'
        ? evt.recur.date === key
        : (evt.recur.days & (1 << dow)) !== 0 && !evt.skipDates?.includes(key);
    if (hit) out.push({ evt, dateKey: key, startMin: evt.start, endMin: evt.start + evt.duration });
  }
  out.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.evt.order - b.evt.order);
  return out;
}

/** Момент початку появи як Date (локальний конструктор — DST-safe для wall-clock). */
export function occurrenceDate(occ: Occ): Date {
  const d = parseYmd(occ.dateKey);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, occ.startMin);
}
