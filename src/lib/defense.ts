// =========================================================
// Формули бою (ПА/ПЗ, деф, різниця рівнів) — чисті функції,
// спільні для сторінки «Бій» (джерело: PWpedia/PWI wiki).
// =========================================================

/** Коефіцієнт ПА/ПЗ (Attack/Defense Level) за різницею Δ = ПА − ПЗ, за формулою PWI.
 *  Δ ≥ 0: 1 + Δ/100. Δ < 0: 1 / (1 + 1.2×|Δ|/100) — множник 1.2 на стороні захисту. */
export function paPzCoef(delta: number): number {
  if (delta >= 0) return 1 + delta / 100;
  return 1 / (1 + (1.2 * Math.abs(delta)) / 100);
}

/** Частка зрізаної шкоди від фіз/маг дефу: Деф / (40×Рівень + Деф − 25), кап 95%.
 *  Рівень — це рівень НАПАДНИКА (як у формулі Perfect World, що бере рівень атакуючого). */
export function armorReduction(def: number, level: number): number {
  if (!(def > 0)) return 0;
  const denom = 40 * level + def - 25;
  if (denom <= 0) return 0;
  return Math.max(0, Math.min(0.95, def / denom));
}

/** PvP-коефіцієнт за різницею рівнів (ціль − нападник), за таблицею PWI wiki.
 *  Урон ріжеться лише коли ціль вища за нападника; зворотний бік = 100%. */
export function pvpLevelCoef(targetMinusAttacker: number): number {
  const d = targetMinusAttacker;
  if (d < 3) return 1.0;
  if (d <= 5) return 0.9;
  if (d <= 8) return 0.8;
  if (d <= 11) return 0.7;
  if (d <= 15) return 0.6;
  if (d <= 20) return 0.5;
  return 0.25;
}

/** PvE-коефіцієнт: рівень_гравця / рівень_моба, не більше 1.0. */
export function pveLevelCoef(playerLevel: number, monsterLevel: number): number {
  if (!(monsterLevel > 0)) return 1;
  return Math.min(1, playerLevel / monsterLevel);
}

/** Текстове представлення коефіцієнта як % зміни шкоди. */
export function coefEffectText(k: number): string {
  if (k > 1) return '+' + ((k - 1) * 100).toFixed(0) + '% шкоди';
  if (k < 1) return '−' + ((1 - k) * 100).toFixed(0) + '% шкоди';
  return 'без змін';
}

export const DEF_DELTA_ROWS: Array<{ delta: number; note: string }> = [
  { delta: 150, note: 'Перевага ПА +150 — шкода ×2.5.' },
  { delta: 100, note: 'Перевага ПА +100 — шкода вдвічі.' },
  { delta: 50, note: 'Перевага ПА +50 — +50% до урону.' },
  { delta: 20, note: 'Невелика перевага атаки, +20% урону.' },
  { delta: 0, note: 'ПА = ПЗ → базова шкода без модифікаторів.' },
  { delta: -10, note: 'Початок захисту: −11% урону (з множником 1.2).' },
  { delta: -20, note: 'Перевага захисту: −19% урону.' },
  { delta: -50, note: 'Супротивник втрачає ~37% сили.' },
  { delta: -100, note: '«Точка розрізу» — урон зрізано більш ніж удвічі (−55%).' },
  { delta: -150, note: 'Diminishing returns: −64%, але кожна одиниця дешевшає.' },
  { delta: -200, note: 'Урон зменшено на ~71%.' },
  { delta: -300, note: 'Максимально досяжна порізка ~78% (важко в реальному бою).' },
];

export const DEF_ARMOR_VALUES = [0, 1000, 2000, 4200, 10000, 20000, 40000, 80000, 160000];

export const PVP_RANGES: Array<{ lo: number; hi: number | null; k: number }> = [
  { lo: 0, hi: 2, k: 1.0 },
  { lo: 3, hi: 5, k: 0.9 },
  { lo: 6, hi: 8, k: 0.8 },
  { lo: 9, hi: 11, k: 0.7 },
  { lo: 12, hi: 15, k: 0.6 },
  { lo: 16, hi: 20, k: 0.5 },
  { lo: 21, hi: null, k: 0.25 },
];
