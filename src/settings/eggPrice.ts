// Спільне поле «ціна яйця» на табах compare/eggs/craft. Усі інпути з класом
// .egg-price-input синхронізуються між собою, getEggPrice() читає перший
// валідний. eggPriceTouched тримається тут (а не в Settings), бо це стан UI.

import { getSettings } from './index';

let eggPriceTouched = false;

export function isEggPriceTouched(): boolean {
  return eggPriceTouched;
}

export function setEggPriceTouched(v: boolean): void {
  eggPriceTouched = v;
}

// Читає першу валідну ціну яйця з полів; інакше — дефолт (2 × ціна голди).
export function getEggPrice(): number {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('.egg-price-input'),
  );
  for (const inp of inputs) {
    const v = parseFloat(inp.value);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 2 * getSettings().goldPrice;
}

export function applyDefaultEggPrice(): void {
  const v = 2 * getSettings().goldPrice;
  document.querySelectorAll<HTMLInputElement>('.egg-price-input').forEach((el) => {
    el.value = String(v);
  });
}

// Делеговане синхронізування полів ціни яйця між табами + перерендер.
export function initEggPriceSync(onRender: () => void): void {
  document.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement | null;
    if (!(t && t.classList && t.classList.contains('egg-price-input'))) return;
    eggPriceTouched = true;
    const v = parseFloat(t.value);
    if (Number.isFinite(v) && v > 0) {
      document.querySelectorAll<HTMLInputElement>('.egg-price-input').forEach((el) => {
        if (el !== t) el.value = String(v);
      });
    }
    onRender();
  });
}
