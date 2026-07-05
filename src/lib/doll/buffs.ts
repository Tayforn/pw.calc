// =========================================================
// ЛЯЛЬКА — бафи: зведення ефектів (ib) і тултіп бафа.
// Винесено з legacy index.ts; глобальний `state` → параметр `build`.
// =========================================================

import { escHtml } from '../../utils/format';
import {
  getBuffs,
  getDebuffs,
  getBuffById,
  buffEffects,
  buffVal,
  buffMaxLevel,
  buffDesc,
  XZ,
  type BuffDef,
} from '../../modules/doll/data';
import type { DollState } from './types';

/** Налаштування бафа (без мутації стану): існуюче або дефолт. */
export function buffCfgRead(build: DollState, id: number): { on: boolean; lvl: number; side: string } {
  return build.buffCfg[String(id)] || { on: false, lvl: 10, side: '' };
}

// Класи-джерела пати-бафів (Воїн/Оборотень/Жрець) — їхні бафи показуємо в рядку
// для БУДЬ-ЯКОГО класу (щоб не лізти в попап за спільними пати-бафами).
const PARTY_SM = [1, 3, 5];
/** Стани (баф/дебаф) у рядку: свій клас (do_by==sm) + пати-класи (дедуп за назвою) +
 *  додані вручну (extraBuffs) + активні. Глобальні/інші класи — через попап. */
function shownStates(build: DollState, data: Record<string, BuffDef[]> | null): BuffDef[] {
  if (!data) return [];
  const sm = XZ[build.cls] || 1;
  const byId: Record<number, BuffDef> = {};
  for (const k in data) for (const b of data[k]) byId[b.id] = b;
  const list: BuffDef[] = [];
  const ids = new Set<number>();
  const names = new Set<string>();
  // Свій клас — першим (його версія спільного бафа має пріоритет), далі пати-класи.
  for (const key of [...new Set([sm, ...PARTY_SM])]) {
    for (const b of data[String(key)] || []) {
      if (ids.has(b.id) || names.has(b.name)) continue;
      list.push(b);
      ids.add(b.id);
      names.add(b.name);
    }
  }
  // Додані вручну (по id — навіть якщо назва вже є) і активні, що ще не в переліку.
  for (const id of build.extraBuffs) {
    const b = byId[id];
    if (b && !ids.has(id)) {
      list.push(b);
      ids.add(id);
      names.add(b.name);
    }
  }
  for (const k in build.buffCfg) {
    if (!build.buffCfg[k].on) continue;
    const b = byId[Number(k)];
    if (b && !ids.has(b.id)) {
      list.push(b);
      ids.add(b.id);
    }
  }
  return list;
}
/** Бафи (pg=rk) у рядку. */
export function shownBuffs(build: DollState): BuffDef[] {
  return shownStates(build, getBuffs());
}
/** Дебафи (pg=hb) у рядку. */
export function shownDebuffs(build: DollState): BuffDef[] {
  return shownStates(build, getDebuffs());
}

/** ib-карта зведених ефектів УСІХ увімкнених станів (бафи+дебафи) з buffCfg. */
export function deriveIb(build: DollState): Record<string, number> {
  const ib: Record<string, number> = {};
  for (const k in build.buffCfg) {
    const c = build.buffCfg[k];
    if (!c || !c.on) continue;
    const b = getBuffById(Number(k));
    if (!b) continue;
    for (const e of buffEffects(b, c.lvl, c.side)) ib[e.type] = (ib[e.type] || 0) + e.val;
  }
  return ib;
}

/** id активних станів, що конфліктують з активованим (спільний ex-стейт) — їх треба вимкнути
 *  (варіанти на кшталт «Вспышка ци / Высшая / Демона» — взаємовиключні, як на рефі). */
export function conflictingActive(build: DollState, activated: BuffDef): number[] {
  if (!activated.ex || !activated.ex.length) return [];
  const ex = new Set(activated.ex);
  const out: number[] = [];
  for (const k in build.buffCfg) {
    if (!build.buffCfg[k].on) continue;
    const id = Number(k);
    if (id === activated.id) continue;
    const b = getBuffById(id);
    if (b && b.ex && b.ex.some((e) => ex.has(e))) out.push(id);
  }
  return out;
}

/** HTML тултіпа бафа (повна інфа: рівень, параметри, опис) — 1:1 з legacy showBuffTip. */
export function buffTipHtml(build: DollState, b: BuffDef): string {
  const c = buffCfgRead(build, b.id);
  const lvl = Math.min(buffMaxLevel(b), c.lvl); // ефективний рівень (з капом)
  // Параметри масштабуються за рівнем/стороною (формула mypers hs).
  const p = (k: string) => (b.lm[k] != null || b.qc[k] != null ? buffVal(b, k, lvl, c.side) : undefined);
  const line = (val: unknown, label: string) =>
    '<div class="doll-tip-bp"><span>' + label + ':</span> <b>' + escHtml(String(val)) + '</b></div>';
  const out: string[] = [];
  out.push('<div>Рівень: ' + lvl + '</div>');
  if (p('oj_for_fu') != null) out.push(line(p('oj_for_fu'), 'Требуємий рівень'));
  if (p('ve') != null) out.push(line(p('ve') + ' м', 'Дальність'));
  if (p('mp') != null) out.push(line(p('mp'), 'Маг. енергія'));
  if (p('channel') != null) out.push(line(p('channel') + ' сек', 'Час активації'));
  if (p('vy') != null) out.push(line(p('vy') + ' сек', 'Призивання'));
  if (p('vw') != null) out.push(line(p('vw') + ' сек', 'Перезарядка'));
  const desc = buffEffects(b, lvl, c.side)
    .filter((e) => e.val)
    .map((e) => buffDesc(e.type, e.val))
    .join('. ');
  return (
    '<div class="doll-tip-name">' + escHtml(b.name) + '</div>' +
    out.join('') +
    (desc ? '<div class="doll-tip-sep"></div><div>' + escHtml(desc) + '</div>' : '')
  );
}
