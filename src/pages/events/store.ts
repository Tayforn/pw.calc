// =========================================================
// Розклад Евентів: localStorage-персист (патерн GeniePage).
// sanitizeEvent — єдиний валідатор для load і import.
// =========================================================

import type { EvtColor, EvtItem, EvtRecur, EvtSettings } from './types';
import { ALL_DAYS, EVT_COLORS } from './types';
import { buildDefaultEvents } from './defaults';

const LS_KEY = 'pwc-events';

export const LEAD_OPTIONS = [0, 5, 10, 15, 30];

export const DEFAULT_SETTINGS: EvtSettings = {
  soundOn: true,
  preset: 'bell',
  volume: 70,
  defaultLead: 5,
  useNotifApi: false,
  dayFrom: 0,
  dayTo: 24,
};

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Крок 5 хв + межі доби. */
function snapStart(v: unknown): number {
  const num = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(1435, Math.round(num / 5) * 5));
}

function sanitizeRecur(raw: unknown): EvtRecur | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === 'once' && typeof r.date === 'string' && DATE_RE.test(r.date)) {
    return { kind: 'once', date: r.date };
  }
  if (r.kind === 'weekly' && typeof r.days === 'number') {
    const days = r.days & ALL_DAYS;
    if (days > 0) return { kind: 'weekly', days };
  }
  return null;
}

/** Поле за полем; null — якщо запис непридатний. */
export function sanitizeEvent(raw: unknown): EvtItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const recur = sanitizeRecur(r.recur);
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, 120) : '';
  if (!recur || !title) return null;
  const start = snapStart(r.start);
  const durRaw = typeof r.duration === 'number' && Number.isFinite(r.duration) ? Math.round(r.duration / 5) * 5 : 30;
  const duration = Math.max(5, Math.min(1440 - start, durRaw));
  return {
    id: typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : newId(),
    title,
    emoji: typeof r.emoji === 'string' ? r.emoji.slice(0, 8) : '',
    color: EVT_COLORS.includes(r.color as EvtColor) ? (r.color as EvtColor) : 'gold',
    start,
    duration,
    recur,
    skipDates: Array.isArray(r.skipDates) ? r.skipDates.filter((s): s is string => typeof s === 'string' && DATE_RE.test(s)).slice(0, 400) : undefined,
    notes: typeof r.notes === 'string' && r.notes.trim() ? r.notes.slice(0, 500) : undefined,
    remind: r.remind === true,
    leadMin: LEAD_OPTIONS.includes(r.leadMin as number) ? (r.leadMin as number) : 5,
    order: typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : 0,
  };
}

function sanitizeSettings(raw: unknown): EvtSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  const hour = (v: unknown, lo: number, hi: number, dflt: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : dflt;
  let dayFrom = hour(r.dayFrom, 0, 23, DEFAULT_SETTINGS.dayFrom);
  let dayTo = hour(r.dayTo, 1, 24, DEFAULT_SETTINGS.dayTo);
  if (dayFrom >= dayTo) {
    dayFrom = DEFAULT_SETTINGS.dayFrom;
    dayTo = DEFAULT_SETTINGS.dayTo;
  }
  return {
    soundOn: typeof r.soundOn === 'boolean' ? r.soundOn : DEFAULT_SETTINGS.soundOn,
    preset: r.preset === 'gong' || r.preset === 'beep' ? r.preset : 'bell',
    volume: typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.max(0, Math.min(100, Math.round(r.volume))) : DEFAULT_SETTINGS.volume,
    defaultLead: LEAD_OPTIONS.includes(r.defaultLead as number) ? (r.defaultLead as number) : DEFAULT_SETTINGS.defaultLead,
    useNotifApi: r.useNotifApi === true,
    dayFrom,
    dayTo,
  };
}

export interface EvtStore {
  events: EvtItem[];
  settings: EvtSettings;
}

export function loadStore(): EvtStore {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (raw && typeof raw === 'object' && Array.isArray(raw.events)) {
      return {
        events: raw.events.map(sanitizeEvent).filter((e: EvtItem | null): e is EvtItem => e !== null),
        settings: sanitizeSettings(raw.settings),
      };
    }
  } catch {
    /* ignore */
  }
  return { events: buildDefaultEvents(), settings: { ...DEFAULT_SETTINGS } };
}

export function saveStore(events: EvtItem[], settings: EvtSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, events, settings }));
  } catch {
    /* ignore */
  }
}
