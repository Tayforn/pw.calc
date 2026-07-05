// =========================================================
// Генератор даних станів для «Ляльки»: із дампу вмінь mypers (`?a=sb&k=yo`)
// будує buffs.json (pg="rk") і debuffs.json (pg="hb"), згруповані за do_by
// (клас-кастер; "0" = глобальні). Назви — з lang.yo[код][mi].
//
// Джерела (не в репо — дамп із залогіненого рефа + розібраний lang.js):
//   SRC_YO  — відповідь ?a=sb&k=yo  (масив вмінь із lm/qc/states/do_by)
//   SRC_LANG— обʼєкт lang (lang.js), потрібен lang.yo
// Запуск:  node scripts/gen-buffs.mjs <yo.json> <lang.json> <outDir>
// Вихід — byte-стабільний JSON (для чинних бафів lm/qc/types незмінні).
// =========================================================

import { readFileSync, writeFileSync } from 'node:fs';

const [yoPath, langPath, outDir] = process.argv.slice(2);
if (!yoPath || !langPath || !outDir) {
  console.error('usage: node scripts/gen-buffs.mjs <yo.json> <lang.json> <outDir>');
  process.exit(1);
}

const yo = JSON.parse(readFileSync(yoPath, 'utf8')).data;
const lang = JSON.parse(readFileSync(langPath, 'utf8'));
const LY = lang.yo || {};
// Коди ефектів-статів (словник станів) — лише вони йдуть у types (решта в lm — це
// скіл-параметри й дамаг-компоненти, які не впливають на характеристики персонажа).
const FU = new Set(Object.keys(JSON.parse(readFileSync(outDir + '/fustate.json', 'utf8'))));

// sm → код класу mypers (як у XZ в data.ts).
const CODE = {
  1: 'by', 2: 'ga', 3: 'ya', 4: 'rl', 5: 'ij', 6: 'js', 7: 'fx',
  8: 'sj', 9: 'ej', 10: 'rg', 11: 'uf', 12: 'he', 13: 'paladin', 14: 'gunner',
};
const ALL_CODES = [...Object.values(CODE), 'by'];

/** Запис словника назв для mi: класовий стан — lang.yo[код][mi];
 *  глобальний — напряму lang.yo[mi] (числовий ключ); далі — по всіх класах. */
function langEntry(doBy, mi) {
  const primary = CODE[doBy] && LY[CODE[doBy]] && LY[CODE[doBy]][mi];
  if (primary) return primary;
  const direct = LY[String(mi)];
  if (direct && direct.mi) return direct;
  for (const c of ALL_CODES) if (LY[c] && LY[c][mi]) return LY[c][mi];
  return null;
}

// Скіл-параметри (є у fustate як підписи, але це не ефекти-стати персонажа).
const PARAMS = new Set(['oj_for_fu', 've', 'mp', 'channel', 'vy', 'vw', 'vj']);
/** Ефект-коди стану = ключі lm зі словника станів fustate, окрім параметрів. */
function extractTypes(lm) {
  return Object.keys(lm || {}).filter((k) => FU.has(k) && !PARAMS.has(k));
}

/** id стейтів для взаємовиключності (варіанти на кшталт «Вспышка ци/…»). */
function extractEx(states) {
  const t0 = states && states[0];
  if (!Array.isArray(t0)) return [];
  const ids = [];
  for (const e of t0) if (e && e.id != null) ids.push(e.id);
  return [...new Set(ids)];
}

function build(pg) {
  const out = {}; // do_by ("0"=global) → BuffDef[]
  const seen = new Set();
  for (const s of yo) {
    if (s.pg !== pg) continue;
    if (!Array.isArray(s.states && s.states[0]) || !s.states[0].length) continue; // не стан (без стейтів)
    const types = extractTypes(s.lm);
    if (!types.length) continue; // без ефект-статів (напр. чистий дамаг-скіл)
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const le = langEntry(s.do_by, s.mi);
    const name = (le && le.mi) || '#' + s.id;
    const def = { id: s.id, an: s.an, name, types, lm: s.lm || {}, qc: s.qc || {} };
    if (le && le['mi rs']) def.nameRs = le['mi rs'];
    if (le && le['mi je']) def.nameJe = le['mi je'];
    if (s.do_by != null) def.do_by = s.do_by;
    const ex = extractEx(s.states);
    if (ex.length) def.ex = ex;
    const key = s.do_by != null ? String(s.do_by) : '0';
    (out[key] = out[key] || []).push(def);
  }
  return out;
}

const buffs = build('rk');
const debuffs = build('hb');

// Порядок ключів: 0 (глобальні), потім 1..14.
function ordered(obj) {
  const o = {};
  for (const k of ['0', ...Array.from({ length: 14 }, (_, i) => String(i + 1))]) if (obj[k]) o[k] = obj[k];
  return o;
}

writeFileSync(outDir + '/buffs.json', JSON.stringify(ordered(buffs)));
writeFileSync(outDir + '/debuffs.json', JSON.stringify(ordered(debuffs)));

const count = (o) => Object.values(o).reduce((s, a) => s + a.length, 0);
console.log('buffs:', count(buffs), 'у', Object.keys(buffs).length, 'групах | debuffs:', count(debuffs), 'у', Object.keys(debuffs).length, 'групах');
