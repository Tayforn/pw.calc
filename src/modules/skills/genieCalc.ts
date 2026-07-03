// =========================================================
// СКІЛБАЗА — калькулятор джина (спорідненість стихій)
// Порт asterpw.github.io/pw/geniecalculator: вибір до 8 умінь,
// розрахунок мінімального рівня джина, потрібної удачі та
// вимог спорідненості. Дані вмінь (назви/іконки/описи) — genie.json,
// таблиця вимог — реверс asterpw, джойн за ref.
// =========================================================

import { escHtml } from '../../utils/format';
import type { GenieSkill } from './data';

// ---- статичні дані asterpw --------------------------------
// [ref, потрібний рівень, метал, дерево, земля, вода, вогонь,
//  класи (бітмаска, 0 = всі), місцевість (бітмаска, 0 = всюди)]
const ROWS: number[][] = [
  [10001, 1, 0, 0, 0, 0, 0, 0x0, 0x0], // Venom Stinger
  [10151, 1, 0, 0, 0, 0, 0, 0x0, 0x0], // Earthflame
  [10141, 1, 0, 0, 0, 0, 0, 0x0, 0x10000], // Wind Force
  [10241, 1, 0, 0, 0, 0, 0, 0x0, 0x0], // Eruption Fist
  [9681, 1, 1, 0, 0, 0, 0, 0x0, 0x0], // Adrenaline Surge
  [9751, 1, 0, 1, 0, 0, 0, 0x0, 0x0], // Qi Manipulation
  [9791, 1, 0, 0, 1, 0, 0, 0x0, 0x4000], // Blinding Sand
  [9871, 4, 0, 0, 0, 1, 0, 0x2, 0x8000], // Healing Ripple of Rebirth
  [9941, 1, 0, 0, 0, 0, 1, 0x0, 0x0], // Explosion
  [9581, 5, 0, 0, 0, 1, 0, 0x0, 0x0], // Cauterize
  [9601, 5, 1, 0, 0, 0, 0, 0x0, 0x0], // Blood Clot
  [9621, 6, 2, 0, 0, 0, 0, 0x0, 0x10000], // Gale
  [9741, 5, 0, 2, 0, 0, 0, 0x0, 0x0], // Virulent Poison
  [9841, 5, 0, 0, 2, 0, 0, 0x0, 0x4000], // Earthquake
  [9911, 5, 0, 0, 0, 2, 0, 0x0, 0x8000], // Aiding Ripple of Luck
  [9931, 8, 0, 0, 0, 0, 2, 0x0, 0x0], // Spark
  [9951, 35, 0, 0, 0, 0, 2, 0x0, 0x0], // Searing Heat
  [10011, 9, 0, 1, 1, 0, 0, 0x4, 0x0], // Solid Shield
  [10021, 5, 0, 0, 1, 1, 0, 0x0, 0x0], // Tangling Mire
  [10041, 5, 1, 0, 0, 0, 1, 0x0, 0x0], // Blade of Supreme Heat
  [9631, 13, 3, 0, 0, 0, 0, 0x0, 0x14000], // Wind Shield
  [9731, 10, 0, 3, 0, 0, 0, 0x0, 0x0], // Nullify Poison
  [9821, 11, 0, 0, 3, 0, 0, 0x20, 0x0], // Sand Shield
  [9851, 15, 0, 0, 0, 3, 0, 0x14, 0x0], // Dissolve
  [9971, 10, 0, 0, 0, 0, 3, 0x0, 0x0], // Smoldering Burst
  [10051, 10, 1, 1, 0, 1, 0, 0x0, 0x0], // Leaf Dance
  [10271, 10, 0, 1, 1, 1, 0, 0x0, 0x0], // Second Wind
  [10071, 10, 0, 0, 1, 1, 1, 0x0, 0x0], // Soul of Fire
  [9651, 10, 4, 0, 0, 0, 0, 0x0, 0x0], // Heart of Steel
  [9721, 15, 0, 4, 0, 0, 0, 0x0, 0x0], // Extreme Poison
  [9811, 15, 0, 0, 4, 0, 0, 0x0, 0x0], // Tai Chi
  [9921, 10, 0, 0, 0, 4, 0, 0x0, 0x0], // Impact
  [9961, 16, 0, 0, 0, 0, 4, 0x0, 0x0], // Ying Yang Seal
  [10101, 15, 2, 0, 0, 0, 2, 0x0, 0x0], // Celestial Sword
  [10111, 18, 0, 2, 0, 2, 0, 0x0, 0x8000], // Acidic Ripple of Poison
  [10121, 15, 1, 0, 1, 2, 0, 0x0, 0x0], // Whirlwind
  [10131, 10, 1, 0, 0, 1, 2, 0x0, 0x0], // Remove Paralysis
  [10161, 22, 2, 0, 2, 1, 0, 0x0, 0x0], // Wind Prison
  [9761, 21, 0, 5, 0, 0, 0, 0x0, 0x0], // Fortify
  [9771, 20, 0, 0, 5, 0, 0, 0x0, 0x0], // Evil Ward
  [10191, 23, 0, 2, 2, 0, 1, 0x0, 0x0], // Relentless Courage
  [10511, 20, 0, 0, 0, 0, 5, 0x5, 0x0], // Piercing Flames
  [9611, 22, 5, 0, 0, 0, 0, 0x0, 0x0], // Lightning Chaser
  [10171, 20, 0, 0, 1, 2, 2, 0x0, 0x4000], // Mantle Ripple of Death
  [10181, 20, 1, 0, 0, 2, 2, 0x2, 0x0], // Rainbow Blessing
  [9591, 25, 0, 0, 0, 5, 0, 0x0, 0x0], // Oxygen Bubble
  [9641, 29, 6, 0, 0, 0, 0, 0x200f, 0x10000], // Air Strand
  [9701, 25, 0, 6, 0, 0, 0, 0x0, 0x0], // Will Surge
  [9781, 25, 0, 0, 6, 0, 0, 0x0, 0x0], // Frenzy
  [9881, 25, 0, 0, 0, 6, 0, 0x0, 0x0], // Life Drain
  [9981, 28, 0, 0, 0, 0, 6, 0x0, 0x0], // Earthblaze
  [10201, 28, 0, 0, 3, 0, 3, 0x4, 0x0], // Mantle Ripple of Rage
  [10211, 30, 0, 0, 3, 3, 0, 0x1, 0x0], // Stunning Blast
  [10221, 25, 2, 2, 2, 0, 0, 0x0, 0x0], // Holy Path
  [10231, 29, 3, 0, 0, 3, 0, 0x14, 0x0], // True Emptiness
  [9661, 31, 7, 0, 0, 0, 0, 0x37, 0x10000], // Rumbling Thunder
  [9691, 30, 0, 7, 0, 0, 0, 0x0, 0x0], // Poisonous Swarm
  [9831, 30, 0, 0, 7, 0, 0, 0x0, 0x4000], // Earth Strand
  [9861, 30, 0, 0, 0, 7, 0, 0x0, 0x0], // Occult Ice
  [9991, 31, 0, 0, 0, 0, 7, 0x0, 0x0], // Thunderstorm
  [10261, 30, 3, 0, 4, 0, 0, 0x0, 0x0], // Law Breaker
  [10061, 31, 0, 3, 0, 4, 0, 0x0, 0x0], // Tree of Protection
  [10281, 31, 4, 0, 0, 0, 3, 0x0, 0x0], // Badge of Courage
  [10291, 10, 0, 0, 3, 0, 4, 0x0, 0x4000], // Earth Claw
  [9671, 35, 8, 0, 0, 0, 0, 0x0, 0x10000], // Electro Dance
  [9711, 36, 0, 8, 0, 0, 0, 0x0, 0x0], // Elemental Weakness
  [9801, 37, 0, 0, 8, 0, 0, 0x0, 0x0], // Dust Storm
  [9891, 35, 0, 0, 0, 8, 0, 0x0, 0x8000], // Battle Ripple of Oblivion
  [10301, 38, 0, 0, 0, 4, 4, 0x20, 0x0], // Aquaflame Armor
  [10311, 35, 0, 4, 4, 0, 0, 0x200f, 0x0], // Seal
  [10501, 35, 0, 4, 4, 0, 0, 0x8, 0x4000], // Hollow Fist
  [10841, 41, 4, 0, 0, 0, 5, 0x10, 0x0], // Balance
  [10321, 40, 0, 5, 4, 0, 0, 0x0, 0x0], // Alpha Male
  [10331, 41, 0, 0, 3, 3, 3, 0x20, 0x0], // Mage Star
  [10521, 41, 0, 5, 0, 3, 1, 0x14, 0x0], // Reflective Aura
  [10341, 45, 0, 0, 5, 0, 5, 0x0, 0x0], // Blazing Shield
  [10351, 46, 5, 0, 0, 5, 0, 0x0, 0x0], // Weakness
  [10441, 47, 0, 0, 0, 5, 5, 0x0, 0x0], // Aquaflame Shot
  [10361, 52, 0, 0, 5, 6, 0, 0x0, 0x8000], // Frozen Domain
  [10371, 50, 0, 6, 0, 0, 5, 0x0, 0x0], // Dampen Magic Curse
  [10481, 52, 5, 0, 0, 6, 0, 0x0, 0x0], // Expel
  [10381, 55, 0, 4, 0, 4, 4, 0x3, 0x0], // Phoenix Dance
  [10391, 55, 4, 0, 4, 4, 0, 0x0, 0x0], // Absolute Domain
  [10471, 55, 7, 0, 5, 0, 0, 0x0, 0x0], // Cloud Eruption
  [10401, 60, 6, 0, 7, 0, 0, 0x0, 0x4000], // Bramble Rage
  [10411, 60, 0, 0, 0, 6, 7, 0x0, 0x4000], // Dragon Fire
  [10461, 60, 0, 0, 7, 0, 6, 0x0, 0x4000], // Inflame
  [10421, 60, 0, 0, 7, 7, 0, 0x0, 0x0], // Chi Siphon
  [10431, 60, 0, 7, 0, 0, 7, 0x0, 0x0], // Ice Blast
  [10451, 60, 7, 7, 0, 0, 0, 0x8, 0x0], // Chaotic Spirit
  [10491, 60, 0, 7, 0, 0, 7, 0x0, 0x0], // Faith
];

// Початкові навики (перший ряд дерева) — джин має рівно один.
const INITIAL_REFS = new Set([10001, 10151, 10141, 10241]);

export interface CalcSkill {
  ref: number;
  level: number;
  aff: number[]; // [метал, дерево, земля, вода, вогонь]
  cls: number;
  ter: number;
}

const CALC = new Map<number, CalcSkill>(
  ROWS.map((r) => [r[0], { ref: r[0], level: r[1], aff: r.slice(2, 7), cls: r[7], ter: r[8] }]),
);

export const ELEMENTS = [
  { name: 'Метал', cls: 'gc-el-m' },
  { name: 'Дерево', cls: 'gc-el-w' },
  { name: 'Земля', cls: 'gc-el-e' },
  { name: 'Вода', cls: 'gc-el-wa' },
  { name: 'Вогонь', cls: 'gc-el-f' },
];

// Класи сервера → біти обмежень asterpw.
const CLASS_OPTS: [number, string][] = [
  [0x10, 'Воин'],
  [0x20, 'Маг'],
  [0x1, 'Лучник'],
  [0x2, 'Жрец'],
  [0x4, 'Оборотень'],
  [0x8, 'Друид'],
  [0x40, 'Убийца'],
  [0x80, 'Шаман'],
  [0x100, 'Страж'],
  [0x200, 'Мистик'],
];
const TERRAIN_OPTS: [number, string][] = [
  [0x4000, 'Суша'],
  [0x8000, 'Вода'],
  [0x10000, 'Повітря'],
];

// ---- формули asterpw --------------------------------------

/** Очки спорідненості, доступні на рівні джина: +1 за кожні 5 рівнів, після 100 — +1 за рівень (макс +4). */
export function affPointsAtLevel(genieLevel: number): number {
  return 1 + Math.floor(genieLevel / 5) + Math.min(4, Math.max(0, genieLevel - 100));
}

/** Вимоги спорідненості набору вмінь — максимум по кожній стихії. */
function affRequirements(sel: CalcSkill[]): number[] {
  const req = [0, 0, 0, 0, 0];
  for (const s of sel) for (let i = 0; i < 5; i++) req[i] = Math.max(req[i], s.aff[i]);
  return req;
}

const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);

/** Мінімальний рівень джина для набору вмінь. */
function minGenieLevel(sel: CalcSkill[]): number {
  let lvl = 1;
  for (const s of sel) lvl = Math.max(lvl, s.level);
  const byCount = sel.length >= 5 && sel.length <= 8 ? [60, 80, 90, 100][sel.length - 5] : 0;
  lvl = Math.max(lvl, byCount);
  const pts = sum(affRequirements(sel));
  lvl = Math.max(lvl, pts <= 21 ? (pts - 1) * 5 : pts - 21 + 100);
  return lvl;
}

/** Потрібна удача (Lucky Points) для набору вмінь на цьому рівні. */
function neededLucky(genieLevel: number, count: number): number {
  let lp = [0, 0, 0, 0, 0, 51, 71, 81, 91][Math.min(count, 8)];
  if (count > 8) lp = 1000; // більше 8 умінь не буває
  return Math.max(lp, Math.floor(genieLevel / 10));
}

// ---- стан -------------------------------------------------
const LS_KEY = 'pwc-genie-calc';

let SKILLS = new Map<number, GenieSkill>(); // ref → дані genie.json
let picked: number[] = []; // вибрані ref-и (в порядку кліків)
let onChange: () => void = () => {};

const num = (id: string): number => {
  const el = document.getElementById(id) as HTMLInputElement | null;
  const v = parseInt(el?.value ?? '', 10);
  return Number.isNaN(v) ? NaN : v;
};

function userLucky(): number {
  const v = num('gcLucky');
  return Number.isNaN(v) ? 91 : Math.max(0, Math.min(100, v));
}
function userLevel(): number {
  const v = num('gcLevel');
  return Number.isNaN(v) ? Math.min(105, userLucky() * 10) : Math.max(1, Math.min(105, v));
}
function selClass(): number {
  return parseInt((document.getElementById('gcClass') as HTMLSelectElement)?.value ?? '0', 10) || 0;
}
function selTerrain(): number {
  return parseInt((document.getElementById('gcTerrain') as HTMLSelectElement)?.value ?? '0', 10) || 0;
}

function pickedSkills(): CalcSkill[] {
  return picked.map((r) => CALC.get(r)!).filter(Boolean);
}

export function gcIsPicked(ref: number): boolean {
  return picked.includes(ref);
}

/** Чи недоступне вміння за фільтрами та поточними рівнем/удачею (для непозначених). */
export function gcIsDisabled(ref: number): boolean {
  if (picked.includes(ref)) return false;
  const c = CALC.get(ref);
  if (!c) return true;

  const cls = selClass();
  if (cls && c.cls && (c.cls & cls) === 0) return true;
  const ter = selTerrain();
  if (ter && c.ter && (c.ter & ter) === 0) return true;

  const sel = pickedSkills();
  if (INITIAL_REFS.has(ref) && sel.some((s) => INITIAL_REFS.has(s.ref))) return true;

  const trial = [...sel, c];
  if (minGenieLevel(trial) > userLevel()) return true;
  if (neededLucky(userLevel(), trial.length) > userLucky()) return true;
  return false;
}

/** Клік по вмінню в сітці: додає/знімає. Повертає true, якщо вибір змінився. */
export function gcToggle(ref: number): boolean {
  if (picked.includes(ref)) {
    picked = picked.filter((r) => r !== ref);
  } else {
    if (gcIsDisabled(ref) || !CALC.has(ref)) return false;
    picked.push(ref);
  }
  save();
  gcRender();
  return true;
}

/** Рядок вимог спорідненості для деталки вміння. */
export function gcSkillAffHtml(ref: number): string {
  const c = CALC.get(ref);
  if (!c) return '';
  const chips = ELEMENTS.map((el, i) =>
    c.aff[i] > 0 ? `<span class="gc-aff ${el.cls}">${el.name} ${c.aff[i]}</span>` : '',
  ).join('');
  const val = chips || '<span class="gc-aff gc-aff-none">без вимог</span>';
  return (
    `<div class="skl-info"><span class="skl-info-l">Спорідненість</span>` +
    `<span class="skl-info-v gc-affline">${val}</span></div>`
  );
}

// ---- збереження -------------------------------------------
function save(): void {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        sel: picked,
        lvl: (document.getElementById('gcLevel') as HTMLInputElement)?.value ?? '',
        lp: (document.getElementById('gcLucky') as HTMLInputElement)?.value ?? '',
        cls: selClass(),
        ter: selTerrain(),
      }),
    );
  } catch { /* локальне сховище недоступне — не критично */ }
}

function restore(): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw) as { sel?: number[]; lvl?: string; lp?: string; cls?: number; ter?: number };
    picked = (d.sel ?? []).filter((r) => CALC.has(r)).slice(0, 8);
    const lvl = document.getElementById('gcLevel') as HTMLInputElement | null;
    const lp = document.getElementById('gcLucky') as HTMLInputElement | null;
    if (lvl && d.lvl) lvl.value = d.lvl;
    if (lp && d.lp) lp.value = d.lp;
    const cls = document.getElementById('gcClass') as HTMLSelectElement | null;
    const ter = document.getElementById('gcTerrain') as HTMLSelectElement | null;
    if (cls && d.cls) cls.value = String(d.cls);
    if (ter && d.ter) ter.value = String(d.ter);
  } catch { /* зіпсовані дані — стартуємо з чистого стану */ }
}

// ---- рендер підсумку --------------------------------------
export function gcRender(): void {
  const box = document.getElementById('gcResult');
  if (!box) return;

  const sel = pickedSkills();
  const lvl = userLevel();
  const minLvl = minGenieLevel(sel);
  const needLp = neededLucky(minLvl, sel.length);
  const maxLpAtMin = 10 * Math.floor(minLvl / 10);
  const req = affRequirements(sel);
  const reqPts = sum(req);
  const havePts = affPointsAtLevel(lvl);
  const free = havePts - reqPts;

  const lvlErr = minLvl > lvl;
  const lpErr = needLp > userLucky();

  const affChips = ELEMENTS.map(
    (el, i) => `<span class="gc-aff ${el.cls}${req[i] ? '' : ' gc-aff-zero'}">${el.name} <b>${req[i]}</b></span>`,
  ).join('');

  const chips = sel
    .map((c) => {
      const name = SKILLS.get(c.ref)?.name ?? String(c.ref);
      return (
        `<button type="button" class="gc-chip" data-ref="${c.ref}" title="Прибрати">` +
        `${escHtml(name)}<span class="gc-chip-x">✕</span></button>`
      );
    })
    .join('');

  box.innerHTML =
    `<div class="gc-stats">` +
    `<div class="gc-stat"><span class="gc-stat-l">Умінь</span><span class="gc-stat-v">${sel.length}/8</span></div>` +
    `<div class="gc-stat"><span class="gc-stat-l">Мін. рівень джина</span><span class="gc-stat-v${lvlErr ? ' gc-err' : ''}">${minLvl}</span></div>` +
    `<div class="gc-stat"><span class="gc-stat-l">Потрібно удачі</span><span class="gc-stat-v${lpErr ? ' gc-err' : ''}">${needLp}<small class="gc-stat-sub"> / макс. ${maxLpAtMin}</small></span></div>` +
    `<div class="gc-stat"><span class="gc-stat-l">Очок спорідненості</span><span class="gc-stat-v${free < 0 ? ' gc-err' : ''}">${reqPts} з ${havePts}<small class="gc-stat-sub"> (вільно ${free})</small></span></div>` +
    `</div>` +
    `<div class="gc-affrow">${affChips}</div>` +
    (sel.length
      ? `<div class="gc-chips">${chips}<button type="button" class="gc-clear" id="gcClear">Скинути все</button></div>`
      : `<p class="muted gc-hint-empty">Клікай уміння в сітці нижче, щоб зібрати білд джина (до 8 умінь, лише один початковий навик).</p>`);

  box.querySelectorAll<HTMLButtonElement>('.gc-chip').forEach((b) =>
    b.addEventListener('click', () => {
      gcToggle(+b.dataset.ref!);
      onChange();
    }),
  );
  document.getElementById('gcClear')?.addEventListener('click', () => {
    picked = [];
    save();
    gcRender();
    onChange();
  });
}

// ---- ініціалізація ----------------------------------------

/** Викликається після завантаження genie.json. */
export function gcSetSkills(list: GenieSkill[]): void {
  SKILLS = new Map(list.map((s) => [s.ref, s]));
  gcRender();
}

/** Разова ініціалізація статичних контролів (onGridRefresh — перерендер сітки вмінь). */
export function gcInit(onGridRefresh: () => void): void {
  onChange = onGridRefresh;

  const cls = document.getElementById('gcClass') as HTMLSelectElement | null;
  if (cls)
    cls.innerHTML =
      '<option value="0">Будь-який</option>' +
      CLASS_OPTS.map(([bit, name]) => `<option value="${bit}">${name}</option>`).join('');
  const ter = document.getElementById('gcTerrain') as HTMLSelectElement | null;
  if (ter)
    ter.innerHTML =
      '<option value="0">Будь-яка</option>' +
      TERRAIN_OPTS.map(([bit, name]) => `<option value="${bit}">${name}</option>`).join('');

  restore();

  const refresh = (): void => {
    save();
    gcRender();
    onChange();
  };
  for (const id of ['gcLevel', 'gcLucky'])
    document.getElementById(id)?.addEventListener('input', refresh);
  for (const id of ['gcClass', 'gcTerrain'])
    document.getElementById(id)?.addEventListener('change', refresh);

  gcRender();
}
