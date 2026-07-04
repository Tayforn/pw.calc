// =========================================================
// ЛЯЛЬКА — бафи: зведення ефектів (ib) і тултіп бафа.
// Винесено з legacy index.ts; глобальний `state` → параметр `build`.
// =========================================================

import { escHtml } from '../../utils/format';
import {
  getBuffs,
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

/** Усі бафи у рядку: бафи поточного класу + додані вручну. */
export function shownBuffs(build: DollState): BuffDef[] {
  const list = (getBuffs()?.[String(XZ[build.cls] || 1)] || []).slice();
  for (const id of build.extraBuffs) {
    const b = getBuffById(id);
    if (b && !list.some((x) => x.id === id)) list.push(b);
  }
  return list;
}

/** ib-карта зведених ефектів увімкнених бафів (для рушія). */
export function deriveIb(build: DollState): Record<string, number> {
  const ib: Record<string, number> = {};
  for (const b of shownBuffs(build)) {
    const c = build.buffCfg[String(b.id)];
    if (!c || !c.on) continue;
    for (const e of buffEffects(b, c.lvl, c.side)) ib[e.type] = (ib[e.type] || 0) + e.val;
  }
  return ib;
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
