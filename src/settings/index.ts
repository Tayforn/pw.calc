// =========================================================
// НАЛАШТУВАННЯ
// =========================================================

import type { Settings } from '../types';
import { $ } from '../utils/dom';
import { fmt, groupDigits } from '../utils/format';
import { maskNumericInput } from '../utils/mask';
import { applyDefaultEggPrice, isEggPriceTouched } from './eggPrice';

// Дефолти для ComebackPW-подібних серверів. Камені — 0.9 г (bulk-ціна 10 шт за
// 9 г). Налаштування тимчасові — кожне оновлення сторінки скидає до дефолтів
// (без localStorage).
export const DEFAULTS: Settings = {
  goldPrice: 318400,
  miragePrice: 40000,
  underPrice: 0.9,
  skyPrice: 0.9,
  worldPrice: 0.44,
};

// Фіксована ціна 1 ★1 шара в голдах (не редагується в UI).
export const SHARD_PRICE_GOLD = 2;

// Цілочислові монетні поля — на них вішається маска з розрядкою тисяч.
// Ціни каменів (десяткові, у голді) НЕ маскуються — дріб був би зламаний.
const MASKED_PRICE_FIELDS: Array<keyof Settings> = ['goldPrice', 'miragePrice'];

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

function applySettingsToInputs(): void {
  (Object.keys(DEFAULTS) as Array<keyof Settings>).forEach((key) => {
    const el = document.getElementById(key) as HTMLInputElement | null;
    if (!el) return;
    el.value = MASKED_PRICE_FIELDS.includes(key)
      ? groupDigits(String(settings[key]))
      : String(settings[key]);
  });
  updateGoldIndicator();
  updateDefaultIndicators();
}

function updateGoldIndicator(): void {
  const ind = $('#goldIndicator');
  const txt = ind ? $('.gold-indicator-text', ind) : null;
  if (txt) {
    txt.innerHTML = `1 <span>голда</span> = ${fmt(settings.goldPrice)} <span>монет</span>`;
  }
}

function updateDefaultIndicators(): void {
  const isDefault = !goldPriceTouched;
  const goldEl = $('#goldIndicator');
  if (goldEl) goldEl.classList.toggle('is-default', isDefault);
  const settingsTab = document.querySelector('.tab[data-tab="settings"]');
  if (settingsTab) settingsTab.classList.toggle('needs-attention', isDefault);
  const fieldBadge = $('#goldPriceBadge');
  if (fieldBadge) fieldBadge.classList.toggle('is-shown', isDefault);
}

export function initSettings(onRender: () => void): void {
  applySettingsToInputs();

  const form = $('#settingsForm');
  if (form) {
    form.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const id = target.id as keyof Settings;
      if (!(id in settings)) return;
      const v = parseFloat(String(target.value).replace(/\s/g, ''));
      if (!Number.isFinite(v) || v < 0) return;
      if (id === 'goldPrice') {
        goldPriceTouched = true;
        updateDefaultIndicators();
      }
      settings[id] = v;
      updateGoldIndicator();
      if (id === 'goldPrice' && !isEggPriceTouched()) applyDefaultEggPrice();
      notifySettings();
      onRender();
    });
  }

  const reset = $('#resetSettings');
  if (reset) {
    reset.addEventListener('click', () => {
      settings = { ...DEFAULTS };
      goldPriceTouched = false;
      applySettingsToInputs();
      applyDefaultEggPrice();
      notifySettings();
      onRender();
    });
  }

  // Маска з розрядкою тисяч на цілочислові монетні поля налаштувань.
  MASKED_PRICE_FIELDS.forEach((id) =>
    maskNumericInput(document.getElementById(id) as HTMLInputElement | null),
  );
}

export { applyDefaultEggPrice, isEggPriceTouched, setEggPriceTouched } from './eggPrice';
