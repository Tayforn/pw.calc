// =========================================================
// Симулятор крафта Р8: чисті функції (дані — window.R8_DATA).
// =========================================================

import { fmt2 } from '../utils/format';

export interface R8Char {
  name: string;
  value: string[];
  um: string;
  weight: number;
}
export interface R8Item {
  name: string;
  static_char: string;
  chars: R8Char[];
}
export interface R8Roll {
  name: string;
  value: string;
  um: string;
}

export const R8S_HUNT_CAP = 5000000;

/** Випадкове значення стата з діапазону [min,max] або [val]. */
export function r8sRandValue(arr: string[]): string {
  if (!arr || arr.length === 0) return '0';
  if (arr.length === 1) return arr[0];
  const min = parseFloat(arr[0]);
  const max = parseFloat(arr[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return arr[0];
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/** k зважених виборів статів з повтором (як у грі — 3 рядки). */
export function r8sPickStats(chars: R8Char[], k: number): R8Roll[] {
  const total = chars.reduce((s, c) => s + c.weight, 0);
  const out: R8Roll[] = [];
  for (let i = 0; i < k; i++) {
    let r = Math.random() * total;
    let pick = chars[chars.length - 1];
    for (const c of chars) {
      r -= c.weight;
      if (r < 0) {
        pick = c;
        break;
      }
    }
    out.push({ name: pick.name, value: r8sRandValue(pick.value), um: pick.um });
  }
  return out;
}

/** Унікальні стати предмета з сумарною вагою кожного. */
export function r8sStatTotals(item: R8Item | null): { map: Map<string, { name: string; weight: number }>; total: number } {
  const map = new Map<string, { name: string; weight: number }>();
  let total = 0;
  if (item) {
    for (const c of item.chars) {
      total += c.weight;
      const cur = map.get(c.name);
      if (cur) cur.weight += c.weight;
      else map.set(c.name, { name: c.name, weight: c.weight });
    }
  }
  return { map, total };
}

/** Точна ймовірність, що кожен обраний стат трапиться серед 3 кидків. */
export function r8sComboProb(item: R8Item | null, targetNames: string[]): number {
  const { map, total } = r8sStatTotals(item);
  if (!total || targetNames.length === 0) return 0;

  const need = new Map<string, number>();
  for (const n of targetNames) need.set(n, (need.get(n) || 0) + 1);
  for (const n of need.keys()) {
    const e = map.get(n);
    if (!e || e.weight <= 0) return 0;
  }

  const names = [...map.values()].map((s) => ({ name: s.name, p: s.weight / total }));
  let prob = 0;
  for (let i = 0; i < names.length; i++)
    for (let j = 0; j < names.length; j++)
      for (let k = 0; k < names.length; k++) {
        const cnt = new Map<string, number>();
        cnt.set(names[i].name, (cnt.get(names[i].name) || 0) + 1);
        cnt.set(names[j].name, (cnt.get(names[j].name) || 0) + 1);
        cnt.set(names[k].name, (cnt.get(names[k].name) || 0) + 1);
        let ok = true;
        for (const [nm, req] of need) {
          if ((cnt.get(nm) || 0) < req) {
            ok = false;
            break;
          }
        }
        if (ok) prob += names[i].p * names[j].p * names[k].p;
      }
  return Math.max(0, Math.min(1, prob));
}

/** Формат ймовірності у %, з дрібним хвостом для малих значень. */
export function pct(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '0%';
  const v = p * 100;
  if (v >= 1) return fmt2(v) + '%';
  return (
    v
      .toFixed(v < 0.01 ? 4 : 3)
      .replace(/0+$/, '')
      .replace(/\.$/, '')
      .replace('.', ',') + '%'
  );
}
