// =========================================================
// Розклад Евентів: типи даних.
// Час зберігаємо як wall-clock (хвилини від локальної опівночі) —
// евент «19:00» лишається о 19:00 по обидва боки переведення годинника.
// =========================================================

/** Бітова маска днів тижня: біт 0 = Пн … біт 6 = Нд. */
export type WeekdayMask = number;

export const ALL_DAYS: WeekdayMask = 0b1111111;

export type EvtColor = 'gold' | 'sky' | 'green' | 'red' | 'violet' | 'orange';

export const EVT_COLORS: EvtColor[] = ['gold', 'sky', 'green', 'red', 'violet', 'orange'];

export type EvtRecur =
  | { kind: 'once'; date: string } // 'YYYY-MM-DD'
  | { kind: 'weekly'; days: WeekdayMask };

export interface EvtItem {
  id: string;
  title: string;
  emoji: string;
  color: EvtColor;
  /** Початок: хвилини від опівночі, крок 5 хв. */
  start: number;
  /** Тривалість у хвилинах, min 5; start + duration <= 1440 (без переходу через північ). */
  duration: number;
  recur: EvtRecur;
  /** Видалені окремі дні weekly-серії ('YYYY-MM-DD'). */
  skipDates?: string[];
  notes?: string;
  remind: boolean;
  /** За скільки хвилин нагадувати: 0 | 5 | 10 | 15 | 30. */
  leadMin: number;
  /** Порядок у стосі при однаковому старті (менший = вище). */
  order: number;
}

export interface EvtSettings {
  soundOn: boolean;
  preset: 'bell' | 'gong' | 'beep';
  volume: number; // 0..100
  defaultLead: number;
  useNotifApi: boolean;
}

/** Конкретна поява евента в конкретний день. */
export interface Occ {
  evt: EvtItem;
  dateKey: string; // 'YYYY-MM-DD'
  startMin: number;
  endMin: number;
}
