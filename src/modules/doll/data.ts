// =========================================================
// ЛЯЛЬКА — шар даних: слоти, лінивий лоадер, іконки, мітки
// =========================================================

export interface Item {
  id: number;
  an: number; // індекс іконки у спрайті категорії
  mi: number | string;
  name: string;
  hf?: number | string; // вимога по рівню
  ir?: string; // обмеження (клас/тип зброї/тип броні)
  type?: string;
  pg?: string;
  // інші поля (стати) лишаються як є — використаються в Етапі 2
  [k: string]: unknown;
}

export interface SlotDef {
  slot: string; // унікальний ключ слота
  cat: string; // категорія даних (для рингів cr/cd → oq)
  label: string; // UA-підпис
}

/** Категорії з гендерним спрайтом (вигляд відрізняється для ч/ж, індекс `an` той самий). */
export const GENDERED = new Set(['ft', 'rv', 'tg', 'rx', 'mj']);

/** Слоти ляльки (порядок = порядок у сітці). */
export const SLOTS: SlotDef[] = [
  { slot: 'ft', cat: 'ft', label: 'Шолом' },
  { slot: 'vx', cat: 'vx', label: 'Намисто' },
  { slot: 'rv', cat: 'rv', label: 'Нагрудник' },
  { slot: 'st', cat: 'st', label: 'Пояс' },
  { slot: 'tg', cat: 'tg', label: 'Поножі' },
  { slot: 'rx', cat: 'rx', label: 'Взуття' },
  { slot: 'wy', cat: 'wy', label: 'Накидка' },
  { slot: 'mj', cat: 'mj', label: 'Браслети' },
  { slot: 'cr', cat: 'oq', label: 'Кільце (л)' },
  { slot: 'cd', cat: 'oq', label: 'Кільце (п)' },
  { slot: 'ta', cat: 'ta', label: 'Зброя' },
  { slot: 'it', cat: 'it', label: 'Боєприпаси' },
  { slot: 'qn', cat: 'qn', label: 'Книга' },
  { slot: 'pp', cat: 'pp', label: 'Збірник' },
  { slot: 'pk', cat: 'pk', label: 'Джинн' },
  { slot: 'gv', cat: 'gv', label: 'Тома' },
  { slot: 'ic', cat: 'ic', label: 'Політ' },
];

const BASE = (import.meta.env.BASE_URL || './') + 'assets/';
export const ASSET_BASE = BASE;

const itemCache: Record<string, Item[]> = {};
let labels: Record<string, Record<string, string>> | null = null;

/** Лінива загрузка предметів категорії. */
export async function loadCat(cat: string): Promise<Item[]> {
  if (itemCache[cat]) return itemCache[cat];
  const res = await fetch(BASE + 'data/mypers/' + cat + '.json');
  const data = (await res.json()) as Item[];
  itemCache[cat] = data;
  return data;
}

/** Загрузка словників-міток (один раз). */
export async function loadLabels(): Promise<Record<string, Record<string, string>>> {
  if (labels) return labels;
  const res = await fetch(BASE + 'data/mypers/labels.json');
  labels = (await res.json()) as Record<string, Record<string, string>>;
  return labels;
}

// Кастомні допи (характеристики), які можна додати на річ у редакторі (як «допы» в mypers).
export const ADDON_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'ld_min', label: 'Фіз. атака (мін)' },
  { code: 'ld_max', label: 'Фіз. атака (макс)' },
  { code: 'xq_min', label: 'Маг. атака (мін)' },
  { code: 'xq_max', label: 'Маг. атака (макс)' },
  { code: 'lw_eq', label: 'Захист від металу' },
  { code: 'mo_eq', label: 'Захист від дерева' },
  { code: 'dn_eq', label: 'Захист від води' },
  { code: 'vt_eq', label: 'Захист від вогню' },
  { code: 'sp_eq', label: 'Захист від землі' },
  { code: 'co', label: 'Макс. HP (%)' },
  { code: 'cc', label: 'Макс. MP (%)' },
  { code: 'cx', label: 'Віднов. HP' },
  { code: 'mp_recovery', label: 'Віднов. MP' },
  { code: 'max_oi_av', label: 'Макс. фіз. атака' },
  { code: 'max_xq', label: 'Макс. маг. атака' },
  { code: 'bu', label: 'Зменш. фіз. урону (%)' },
  { code: 'ia', label: 'Зменш. маг. урону (%)' },
  { code: 'bonus_hf', label: 'Бонус рівня' },
  { code: 'hp', label: 'Здоровʼя' },
  { code: 'mp', label: 'Мана' },
  { code: 'om', label: 'Сила' },
  { code: 'lf', label: 'Тілобудова' },
  { code: 'uy', label: 'Спритність' },
  { code: 'tx', label: 'Інтелект' },
  { code: 'mk', label: 'Сила духу' },
  { code: 'mr', label: 'Бойовий дух' },
  { code: 'ld', label: 'Фіз. атака' },
  { code: 'xq', label: 'Маг. атака' },
  { code: 'wf', label: 'Фіз. захист' },
  { code: 'ab_gq', label: 'Маг. захист' },
  { code: 'ad', label: 'Рівень атаки' },
  { code: 'sx', label: 'Рівень захисту' },
  { code: 'ae', label: 'Меткість' },
  { code: 'qe', label: 'Ухилення' },
  { code: 'cl', label: 'Швидкість' },
  { code: 'ci', label: 'Час співу (%)' },
  { code: 'ed', label: 'Шанс криту (%)' },
  { code: 'pec', label: 'Фіз. пробивання' },
  { code: 'kdn', label: 'Маг. пробивання' },
  { code: 'wz', label: 'Захист від монстрів' },
  { code: 'su', label: 'Урон монстрам' },
];

// Стани (бафи): %-модифікатори фінальних стат. Користувач задає відсоток.
export const BUFFS: Array<{ key: string; label: string }> = [
  { key: 'yh', label: 'Фіз. атака' },
  { key: 'sq', label: 'Маг. атака' },
  { key: 'tb', label: 'Фіз. захист' },
  { key: 'xk', label: 'Маг. захист' },
  { key: 'fw', label: 'Макс. HP' },
  { key: 'jk', label: 'Шанс криту' },
  { key: 'bx', label: 'Меткість' },
  { key: 'br', label: 'Ухилення' },
];

export interface SetDef {
  name: string;
  zn: Record<string, { type: string; val: number }>; // поріг (к-сть деталей) → бонус
  pieces: number;
}
let sets: Record<string, SetDef> | null = null;
export async function loadSets(): Promise<Record<string, SetDef>> {
  if (sets) return sets;
  const res = await fetch(BASE + 'data/mypers/sets.json');
  sets = (await res.json()) as Record<string, SetDef>;
  return sets;
}
export function getSets(): Record<string, SetDef> | null {
  return sets;
}

export interface BuffDef {
  id: number;
  an: number;
  name: string;
  nameRs?: string; // назва світлої сторони (мудрець)
  nameJe?: string; // назва темної сторони (демон)
  types: string[]; // коди ефектів (gs_oi_av, tb, fw, …)
  lm: Record<string, number>; // базові значення + параметри (oj_for_fu, ve, mp, channel, vy, vw)
  qc: Record<string, unknown>; // масштабування за рівнем (0..11, rs=світл/je=темн)
}
let buffs: Record<string, BuffDef[]> | null = null;
let buffById: Record<number, BuffDef> | null = null;
let fuState: Record<string, string> | null = null;
export async function loadBuffs(): Promise<void> {
  if (!buffs) {
    buffs = (await (await fetch(BASE + 'data/mypers/buffs.json')).json()) as Record<string, BuffDef[]>;
    buffById = {};
    for (const sm in buffs) for (const b of buffs[sm]) buffById[b.id] = b;
  }
  if (!fuState) fuState = (await (await fetch(BASE + 'data/mypers/fustate.json')).json()) as Record<string, string>;
}
export function getBuffs(): Record<string, BuffDef[]> | null {
  return buffs;
}
export function getBuffById(id: number): BuffDef | null {
  return (buffById && buffById[id]) || null;
}

/** Значення ефекту бафа на заданому рівні (0..11) і стороні (rs=світл/je=темн). */
/** Максимальний рівень бафа = найбільший числовий ключ у qc (понад 0). */
export function buffMaxLevel(b: BuffDef): number {
  let max = 1;
  for (const k in b.qc) {
    const q = b.qc[k] as Record<string, unknown> | unknown[];
    const keys = Array.isArray(q) ? q.map((_, i) => i) : Object.keys(q).map(Number);
    for (const n of keys) if (n > max) max = n;
  }
  return max;
}
/**
 * Значення стату на рівні/стороні — точна формула mypers `hs`:
 *   value = lm[key] + qc[key][0]·(рівень−1) + qc[key][рівень]?.[side]
 */
export function buffVal(b: BuffDef, key: string, level: number, side: string): number {
  let s = typeof b.lm[key] === 'number' ? b.lm[key] : 0;
  const q = b.qc[key] as Record<string, unknown> | undefined;
  if (q) {
    const L = Math.max(1, Math.min(buffMaxLevel(b), level));
    const inc = q['0'] != null ? Number(q['0']) : 0; // приріст за рівень
    let at = 0; // значення саме на цьому рівні (де визначене, напр. макс)
    const lv = (q as Record<string, unknown>)[String(L)];
    if (lv != null) at = typeof lv === 'object' ? Number((lv as Record<string, number>)[side]) || 0 : Number(lv) || 0;
    s += inc * (L - 1) + at;
  }
  // ціле, або 1 знак якщо дробове
  return Math.round(s * 10) / 10;
}
/** Ефекти бафа як {type,val} на рівні/стороні (для рушія й опису). */
export function buffEffects(b: BuffDef, level: number, side: string): Array<{ type: string; val: number }> {
  return b.types.map((t) => ({ type: t, val: buffVal(b, t, level, side) }));
}
/** Чи має баф варіанти світла/темна (rs/je в qc) — тобто вибір сторони має сенс. */
export function buffHasSides(b: BuffDef): boolean {
  for (const k in b.qc) {
    const q = b.qc[k];
    if (!q || typeof q !== 'object') continue;
    for (const lv of Object.values(q as Record<string, unknown>)) {
      if (lv && typeof lv === 'object') {
        const o = lv as Record<string, unknown>;
        if ('rs' in o || 'je' in o) return true;
      }
    }
  }
  return false;
}
/** Назва бафа з урахуванням сторони (світл/темн) — як на рефі. */
export function buffDisplayName(b: BuffDef, side: string): string {
  if (side === 'rs' && b.nameRs) return b.nameRs;
  if (side === 'je' && b.nameJe) return b.nameJe;
  return b.name;
}

/** Опис ефекту стану (з підстановкою значення у {code}). */
export function buffDesc(code: string, val: number): string {
  const tpl = fuState && fuState[code];
  if (!tpl) return code + ' +' + val;
  return tpl.replace(new RegExp('\\{' + code + '\\}', 'g'), String(val));
}

export interface SkillDef {
  id: number;
  an: number;
  name: string;
  thw: number; // множник базової атаки (к-сть «ударів зброї»)
  flat: number; // плоский урон скіла
  mag: number; // 1 = магічний скіл
}
let skills: Record<string, SkillDef[]> | null = null;
export async function loadSkills(): Promise<void> {
  if (!skills) skills = (await (await fetch(BASE + 'data/mypers/skills.json')).json()) as Record<string, SkillDef[]>;
}
export function getSkills(): Record<string, SkillDef[]> | null {
  return skills;
}

/** Назви класів за sm-індексом (відповідає XZ: by=1…gunner=14). */
export const CLASS_BY_SM: Record<number, string> = {
  1: 'Воїн', 2: 'Маг', 3: 'Оборотень', 4: 'Друїд', 5: 'Жрець', 6: 'Лучник',
  7: 'Убивця', 8: 'Шаман', 9: 'Страж', 10: 'Містик', 11: 'Призрак', 12: 'Жнець',
  13: 'Паладин', 14: 'Стрілок',
};
/** CSS іконки бафа зі спрайта вмінь yo.png (6 колонок, 32px). */
export function buffIconStyle(an: number): string {
  const col = an % 6;
  const row = Math.floor(an / 6);
  return "background-image:url('" + BASE + "items/yo.png');background-position:-" + col * 32 + 'px -' + row * 32 + 'px';
}

export function lbl(dict: string, key: string | number | undefined): string {
  if (key == null || !labels || !labels[dict]) return String(key ?? '');
  return labels[dict][String(key)] ?? String(key);
}

// Елементальні захисти (порядок: метал, дерево, вода, вогонь, земля).
export const ELEM = ['lw_eq', 'mo_eq', 'dn_eq', 'vt_eq', 'sp_eq'] as const;

// Базові формули PW (з mypers `sd`): HP = коеф×(Тілобудова + 2×(рівень−1)),
// MP = коеф×(Інтелект + 2×(рівень−1)). Коефіцієнт — на клас.
export const HP_VIT: Record<string, number> = {
  by: 15, ej: 15, paladin: 15, ya: 17, rl: 12, js: 13, fx: 13, uf: 13, gunner: 13,
  ga: 10, ij: 10, sj: 10, rg: 10, he: 10,
};
export const MP_MAG: Record<string, number> = {
  by: 9, ej: 9, paladin: 9, ya: 7, rl: 12, js: 11, fx: 11, uf: 11, gunner: 11,
  ga: 14, ij: 14, sj: 14, rg: 14, he: 14,
};
// Меткість / ухилення = коеф × Спритність (на клас).
export const ACC_DEX: Record<string, number> = {
  by: 10, ej: 10, paladin: 10, ya: 8, rl: 7, js: 8, fx: 8, rg: 8, uf: 8, gunner: 8,
  ga: 5, ij: 5, sj: 5, he: 5,
};
export const EVA_DEX: Record<string, number> = {
  by: 10, ej: 10, paladin: 10, ya: 8, rl: 6, js: 6, fx: 6, rg: 6, uf: 6, gunner: 6,
  ga: 2, ij: 2, sj: 2, he: 2,
};
// Клас → індекс sm (визначає per-level фактор атаки в mypers).
export const XZ: Record<string, number> = {
  by: 1, ga: 2, ya: 3, rl: 4, ij: 5, js: 6, fx: 7, sj: 8, ej: 9, rg: 10, uf: 11, he: 12, paladin: 13, gunner: 14,
};
// Типи зброї, що рахують фіз. атаку від Спритності (інші — від Сили).
export const DEX_WEAPONS = new Set(['ne', 'eb', 'fo', 'firearm']);

// Слоти з гніздами під камені. Зброя — рівно 2; решта — від 2 до 4 (регульовано).
export const SOCKETABLE = new Set(['ta', 'ft', 'rv', 'tg', 'rx', 'vx', 'st', 'wy', 'mj', 'oq']);
export function defaultSockets(cat: string): number {
  return SOCKETABLE.has(cat) ? 2 : 0;
}
export function maxSockets(cat: string): number {
  if (!SOCKETABLE.has(cat)) return 0;
  return cat === 'ta' ? 2 : 4;
}

// Заточка (+1..+12): бонус головної стати = round(база gh[1] × множник рівня).
export const GH_PERC = [1, 2, 3.05, 4.3, 5.75, 7.55, 9.95, 13, 17.05, 22.03, 29, 37.5];
export function refineVal(ghBase: number, level: number): number {
  if (level < 1 || level > 12) return 0;
  return Math.round(ghBase * GH_PERC[level - 1]);
}

// Аліаси кодів стат до канонічних.
export const STAT_ALIAS: Record<string, string> = { mana: 'mp', co: 'hp', cc: 'mp', oi_eq: 'wf', ab_eq: 'ab_gq' };

export interface StatRow {
  key: string;
  label: string;
  range?: boolean; // діапазон min–max (атака)
  suf?: string; // суфікс (%, /сек)
}
export interface StatGroup {
  title: string;
  rows: StatRow[];
}

/** Групи характеристик для панелі (порядок і підписи; коди — з даних mypers). */
export const STAT_GROUPS: StatGroup[] = [
  {
    title: 'Атака',
    rows: [
      { key: 'ld', label: 'Фіз. атака', range: true },
      { key: 'max_oi_av', label: 'Макс. фіз. атака' },
      { key: 'xq', label: 'Маг. атака', range: true },
      { key: 'max_xq', label: 'Макс. маг. атака' },
      { key: 'ad', label: 'Рівень атаки' },
      { key: 'ed', label: 'Шанс криту', suf: '%' },
      { key: 'pec', label: 'Фіз. пробивання', suf: '%' },
      { key: 'kdn', label: 'Маг. пробивання', suf: '%' },
      { key: 'sy', label: 'Атак/сек' },
    ],
  },
  {
    title: 'Захист',
    rows: [
      { key: 'wf', label: 'Фіз. захист' },
      { key: 'lw_eq', label: 'Захист: метал' },
      { key: 'mo_eq', label: 'Захист: дерево' },
      { key: 'dn_eq', label: 'Захист: вода' },
      { key: 'vt_eq', label: 'Захист: вогонь' },
      { key: 'sp_eq', label: 'Захист: земля' },
      { key: 'sx', label: 'Рівень захисту' },
      { key: 'qe', label: 'Ухилення' },
      { key: 'bu', label: 'Зменш. фіз. урону', suf: '%' },
      { key: 'ia', label: 'Зменш. маг. урону', suf: '%' },
    ],
  },
  {
    title: 'Основні',
    rows: [
      { key: 'hp', label: 'Здоровʼя' },
      { key: 'mp', label: 'Мана' },
      { key: 'om', label: 'Сила' },
      { key: 'lf', label: 'Тілобудова' },
      { key: 'uy', label: 'Спритність' },
      { key: 'tx', label: 'Інтелект' },
      { key: 'ae', label: 'Влучність' },
      { key: 'cl', label: 'Швидкість' },
      { key: 'mr', label: 'Бойовий дух' },
      { key: 'mk', label: 'Сила духу' },
      { key: 'cx', label: 'Віднов. HP' },
      { key: 'mp_recovery', label: 'Віднов. MP' },
    ],
  },
  {
    title: 'Інше',
    rows: [
      { key: 'ci', label: 'Час співу', suf: '%' },
      { key: 'su', label: 'Урон монстрам' },
      { key: 'wz', label: 'Захист від монстрів' },
      { key: 'exp', label: 'Досвід', suf: '%' },
      { key: 'bonus_hf', label: 'Бонус рівня' },
      { key: 'cp', label: 'Міцність' },
    ],
  },
];

/** CSS для іконки предмета: спрайт категорії (гендерний для броні) + позиція з `an`. */
export function iconStyle(item: Item, cat: string, gender: 'm' | 'f'): string {
  const an = Number(item.an) || 0;
  const col = an % 6;
  const row = Math.floor(an / 6);
  const path = 'items/fe/' + cat + '/' + (GENDERED.has(cat) ? gender + '/' : '') + cat + '-hii.png';
  return (
    "background-image:url('" + BASE + path + "');" +
    'background-position:-' + col * 32 + 'px -' + row * 32 + 'px'
  );
}
