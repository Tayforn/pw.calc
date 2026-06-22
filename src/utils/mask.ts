// Маска «розрядка тисяч» для числових інпутів + читання числа з маски.

import { groupDigits } from './format';

// Числове значення з маскованого інпута (пробіли ігноруються).
export function mcNum(el: HTMLInputElement | null): number {
  if (!el) return NaN;
  const v = parseFloat(String(el.value).replace(/\s/g, ''));
  return Number.isFinite(v) ? v : NaN;
}

// Маска «розрядка тисяч» з відновленням позиції каретки.
export function maskNumericInput(el: HTMLInputElement | null): void {
  if (!el) return;
  el.addEventListener('input', () => {
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
    const formatted = groupDigits(raw);
    el.value = formatted;
    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < digitsBefore) {
      const code = formatted.charCodeAt(pos);
      if (code >= 48 && code <= 57) seen++;
      pos++;
    }
    try {
      el.setSelectionRange(pos, pos);
    } catch (_) {
      /* ignore */
    }
  });
}
