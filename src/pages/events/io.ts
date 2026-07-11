// =========================================================
// Розклад Евентів: експорт/імпорт JSON-файлом.
// Налаштування звуку навмисно не експортуються (девайс-локальні).
// =========================================================

import type { EvtItem } from './types';
import { sanitizeEvent } from './store';
import { ymd } from './dates';

const APP_TAG = 'pw-helper-events';

export function exportEvents(events: EvtItem[]): void {
  const payload = { app: APP_TAG, v: 1, exported: new Date().toISOString(), events };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pw-events-${ymd(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  events: EvtItem[];
  skipped: number;
}

/** Кидає Error з україномовним повідомленням при непридатному файлі. */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Файл не схожий на JSON.');
  }
  // Приймаємо і повний експорт, і голий масив евентів.
  let list: unknown[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as { events?: unknown[] }).events)) {
    const obj = raw as { app?: string; v?: number; events: unknown[] };
    if (obj.app !== undefined && obj.app !== APP_TAG) throw new Error('Це не файл евентів PW Хелпера.');
    if (typeof obj.v === 'number' && obj.v > 1) throw new Error('Файл з новішої версії — онови сторінку.');
    list = obj.events;
  } else {
    throw new Error('У файлі немає списку евентів.');
  }
  const events: EvtItem[] = [];
  let skipped = 0;
  for (const item of list) {
    const e = sanitizeEvent(item);
    if (e) events.push(e);
    else skipped += 1;
  }
  if (!events.length) throw new Error('У файлі не знайдено жодного валідного евента.');
  return { events, skipped };
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(new Error('Не вдалося прочитати файл.'));
    fr.readAsText(file);
  });
}
