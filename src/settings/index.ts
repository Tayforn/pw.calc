// =========================================================
// НАЛАШТУВАННЯ
// =========================================================

import type { Settings } from '../types';
import { applyDefaultEggPrice, isEggPriceTouched } from './eggPrice';

// Дефолти для ComebackPW-подібних серверів. Камені — 0.9 г (bulk-ціна 10 шт за
// 9 г). Налаштування тимчасові — кожне оновлення сторінки скидає до дефолтів
// (без localStorage).
export const DEFAULTS: Settings = {
  goldPrice: 600000,
  miragePrice: 70000,
  underPrice: 0.9,
  skyPrice: 0.9,
  worldPrice: 0.44,
};

// Фіксована ціна 1 ★1 шара в голдах (не редагується в UI).
export const SHARD_PRICE_GOLD = 2;

// Цілочислові монетні поля (у SettingsPage мають маску розрядки тисяч);
// ціни каменів — десяткові в голді, без маски.
export const MASKED_PRICE_FIELDS: Array<keyof Settings> = ['goldPrice', 'miragePrice'];

let settings: Settings = { ...DEFAULTS };
let goldPriceTouched = false;

// Підписка для React-сторінок (useSyncExternalStore): нотифікується при
// будь-якій зміні налаштувань (input/reset). Версія — «снепшот» стора.
let settingsVer = 0;
const settingsListeners = new Set<() => void>();
export function subscribeSettings(fn: () => void): () => void {
  settingsListeners.add(fn);
  return () => settingsListeners.delete(fn);
}
export function settingsVersion(): number {
  return settingsVer;
}
function notifySettings(): void {
  settingsVer++;
  settingsListeners.forEach((fn) => fn());
}

export function getSettings(): Settings {
  return settings;
}

export function isGoldPriceTouched(): boolean {
  return goldPriceTouched;
}

/** Змінити одне налаштування (валідне невідʼємне число). Керує сайд-ефектами
 *  ціни голди (дефолт яйця, «touched») і нотифікує підписників. */
export function setSetting(key: keyof Settings, value: number): void {
  if (!Number.isFinite(value) || value < 0) return;
  if (key === 'goldPrice') goldPriceTouched = true;
  settings[key] = value;
  if (key === 'goldPrice' && !isEggPriceTouched()) applyDefaultEggPrice();
  notifySettings();
}

/** Скинути всі налаштування до дефолтів. */
export function resetSettings(): void {
  settings = { ...DEFAULTS };
  goldPriceTouched = false;
  applyDefaultEggPrice();
  notifySettings();
}

export { applyDefaultEggPrice, isEggPriceTouched, setEggPriceTouched } from './eggPrice';
