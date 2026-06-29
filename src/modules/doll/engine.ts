// =========================================================
// КУКЛА — рушій характеристик (формули PW, реверс із mypers `sd`)
// =========================================================
// Без бафів/дебафів і без заточки/каменів (ib={}); це база від класу/рівня/
// атрибутів + внесок спорядження (gear totals з index.ts).

import { HP_VIT, MP_MAG, ACC_DEX, EVA_DEX, XZ, DEX_WEAPONS, ELEM } from './data';

export interface Range {
  min: number;
  max: number;
}
export interface ElemDef {
  def: number;
  perc: number;
}
export interface CharStats {
  hp: number;
  mp: number;
  physAtk: Range;
  magAtk: Range;
  physDef: number;
  physDefPerc: number;
  magDef: number; // середня по 5 стихіях
  magDefPerc: number;
  elem: Record<string, ElemDef>; // lw/mo/dn/vt/sp
  acc: number;
  eva: number;
  crit: number; // %
  attr: { str: number; vit: number; dex: number; mag: number }; // ефективні
}

export interface CharInput {
  cls: string;
  level: number;
  str: number;
  dex: number;
  vit: number;
  mag: number;
  weaponIr?: string; // тип зброї (ir) для вибору атрибута фіз. атаки
}

const r = Math.round;

/** Базова інтерполяція mypers (стати від атрибутів+рівня). */
function ts(t: number, i: number, s: number, e: number[]): number {
  return r((i + s - e[1]) / e[2]) + r(t * (e[3] + r((e[1] * i + e[4] * s) / e[5]) / e[6])) + e[0];
}

/** % зрізання урону від захисту: def/(40×рівень + def − 25), кап 95%. */
export function defPerc(def: number, level: number): number {
  const d = 40 * level + def - 25;
  if (d <= 0) return 0;
  return Math.min(95, (def / d) * 100);
}

/** Per-level фактор атаки (nm) за sm та атрибутом. */
function nm(attr: 'om' | 'uy' | 'tx', sm: number): number {
  if (attr === 'tx') {
    if (sm === 4) return 0.6;
    if ([1, 3, 6, 7, 9, 11].includes(sm)) return 0.0095;
    return 1;
  }
  if (sm === 4) return 0.6;
  if ([2, 5, 8, 10, 12].includes(sm)) return 0.21;
  return 1;
}

/** Бонус маг. атаки (ua) для маг-класів. */
function uaTx(sm: number, vuTx: number): number {
  return [2, 5, 8, 10, 12].includes(sm) ? r(vuTx / 1720) : 0;
}

type Totals = Record<string, number>;

export function computeChar(inp: CharInput, t: Totals, buffs: Record<string, number> = {}): CharStats {
  const bf = (k: string): number => buffs[k] || 0;
  const cls = inp.cls;
  const hf = inp.level || 1;
  const sm = XZ[cls] || 1;
  const vu = {
    om: inp.str + (t.om || 0),
    uy: inp.dex + (t.uy || 0),
    lf: inp.vit + (t.lf || 0),
    tx: inp.mag + (t.tx || 0),
  };

  const hp = (HP_VIT[cls] ?? 13) * (vu.lf + 2 * (hf - 1)) + (t.hp || 0);
  const mp = (MP_MAG[cls] ?? 11) * (vu.tx + 2 * (hf - 1)) + (t.mp || 0);
  const acc = (ACC_DEX[cls] ?? 8) * vu.uy + (t.ae || 0);
  const eva = (EVA_DEX[cls] ?? 6) * vu.uy + (t.qe || 0);
  const crit = 1 + Math.floor(vu.uy / 20) + (t.ed || 0);

  // Фіз. атака: база — урон зброї + допи, фактори від Сили (або Спритності для дальньої).
  const pAttr: 'om' | 'uy' = DEX_WEAPONS.has(inp.weaponIr || '') ? 'uy' : 'om';
  const pi = t.ld_min || 0;
  const ps = (t.ld_max || 0) + (t.max_oi_av || 0);
  const pe = vu[pAttr] / 100 + 1;
  const pa = nm(pAttr, sm);
  const pl = r(vu[pAttr] / 3);
  const physAtk: Range = {
    min: Math.max(0, r(pi * pe + r(hf * pa) * pe - ((pi + r(hf * pa)) / 100) * pl)),
    max: Math.max(0, r(ps * pe + r(hf * pa) * pe - ((ps + r(hf * pa)) / 100) * pl)),
  };

  // Маг. атака: база — маг. урон зброї + допи, фактори від Інтелекту.
  const mi = t.xq_min || 0;
  const ms = (t.xq_max || 0) + (t.max_xq || 0);
  const ma = vu.tx / 100 + 1;
  const me = nm('tx', sm);
  const mn = uaTx(sm, vu.tx);
  const magAtk: Range = {
    min: Math.max(0, r(ma * mi) + r(r(hf * me) * ma + mn)),
    max: Math.max(0, r(ma * ms) + r(r(hf * me) * ma + mn)),
  };

  // Фіз. захист: база від Тілобудови+Сили + внесок споряди (×рівень/100).
  const physBase = ts(hf, vu.lf, vu.om, [1, 2, 4, 1, 3, 25, 100]);
  const physDef = Math.max(0, physBase + r((hf / 100) * (t.wf || 0)));
  const physDefPerc = defPerc(physDef, hf);

  // Маг. захист: per-element від Тілобудови+Інтелекту + стихійний захист споряди.
  const elem: Record<string, ElemDef> = {};
  let magSum = 0;
  for (const eKey of ELEM) {
    const short = eKey.replace('_eq', ''); // lw/mo/dn/vt/sp
    const base = ts(hf, vu.lf, vu.tx, [0, 2, 4, 1, 3, 25, 100]);
    const def = Math.max(0, base + r((hf / 100) * (t[eKey] || 0)));
    elem[short] = { def, perc: defPerc(def, hf) };
    magSum += def;
  }
  const magDef = r(magSum / 5);

  // Бафи/дебафи (стани): зведені %-модифікатори з ib-карти.
  const wtBuff = inp.weaponIr ? bf('gs_oi_' + inp.weaponIr + '_av_eg') : 0; // бонус % за типом зброї
  const physPct = bf('yh') - bf('xp') + wtBuff;
  const flatPhys = bf('gs_oi_av');
  const magPct =
    bf('sq') - bf('so') + bf('gs_ab_lw_av_eg') + bf('gs_ab_mo_av_eg') + bf('gs_ab_dn_av_eg') + bf('gs_ab_vt_av_eg') + bf('gs_ab_sp_av_eg');
  const flatMag = bf('gs_xq');
  const physDefPct = bf('tb') + bf('od') - bf('va');
  const magDefPct = bf('xk') + bf('og') - bf('pt');
  const hpPct = bf('fw') - bf('eh');
  const accPct = bf('bx') - bf('yr');
  const evaPct = bf('br') - bf('na');

  const physAtkB: Range = {
    min: r((physAtk.min + flatPhys) * (1 + physPct / 100)),
    max: r((physAtk.max + flatPhys) * (1 + physPct / 100)),
  };
  const magAtkB: Range = {
    min: r((magAtk.min + flatMag) * (1 + magPct / 100)),
    max: r((magAtk.max + flatMag) * (1 + magPct / 100)),
  };
  const physDefB = r(physDef * (1 + physDefPct / 100));
  const elemB: Record<string, ElemDef> = {};
  let magSumB = 0;
  for (const k in elem) {
    const def = r(elem[k].def * (1 + magDefPct / 100));
    elemB[k] = { def, perc: defPerc(def, hf) };
    magSumB += def;
  }
  const magDefB = r(magSumB / 5);

  return {
    hp: r(hp * (1 + hpPct / 100)),
    mp: r(mp),
    physAtk: physAtkB,
    magAtk: magAtkB,
    physDef: physDefB,
    physDefPerc: defPerc(physDefB, hf),
    magDef: magDefB,
    magDefPerc: defPerc(magDefB, hf),
    elem: elemB,
    acc: r(acc * (1 + accPct / 100)),
    eva: r(eva * (1 + evaPct / 100)),
    crit: crit + bf('jk'),
    attr: { str: vu.om, vit: vu.lf, dex: vu.uy, mag: vu.tx },
  };
}
