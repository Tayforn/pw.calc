// =========================================================
// ЛЯЛЬКА — функціональний редактор спорядження (Етап 1)
// =========================================================

import { escHtml } from '../../utils/format';
import { computeChar, defPerc, type CharStats } from './engine';
import {
  SLOTS,
  GENDERED,
  ELEM,
  STAT_ALIAS,
  ADDON_OPTIONS,
  XZ,
  defaultSockets,
  maxSockets,
  refineVal,
  QN_REFINE_ADDONS,
  loadCat,
  loadLabels,
  loadSets,
  getSets,
  loadBuffs,
  getBuffs,
  getBuffById,
  buffEffects,
  buffVal,
  buffMaxLevel,
  buffHasSides,
  buffIconStyle,
  buffDesc,
  buffDisplayName,
  loadSkills,
  getSkills,
  CLASS_BY_SM,
  type SkillDef,
  lbl,
  iconStyle,
  ASSET_BASE,
  type Item,
  type SlotDef,
  type BuffDef,
} from './data';

const LS_KEY = 'pwDollBuild';

interface BackpackEntry {
  item: Item;
  slot: string; // оригінальний слот
  cat: string; // категорія (для іконки)
  gems: Array<Item | null>;
  refine: number;
  addons: Array<{ type: string; val: number }>;
}

interface DollState {
  cls: string;
  gender: 'm' | 'f';
  level: number;
  str: number;
  dex: number;
  vit: number;
  mag: number;
  server: string;
  equipped: Record<string, Item>;
  gems: Record<string, Array<Item | null>>; // slot → камені в гніздах
  refine: Record<string, number>; // slot → рівень заточки (0..12)
  addons: Record<string, Array<{ type: string; val: number }>>; // slot → кастомні допи
  buffCfg: Record<string, { on: boolean; lvl: number; side: string }>; // id бафа → налаштування
  extraBuffs: number[]; // додані вручну (через пошук) бафи інших класів
  backpack: Array<BackpackEntry | null>; // інвентар (позиційний, не враховується)
}

const state: DollState = {
  cls: 'by',
  gender: 'm',
  level: 105,
  str: 5,
  dex: 5,
  vit: 5,
  mag: 5,
  server: 'noServer',
  equipped: {},
  gems: {},
  refine: {},
  addons: {},
  buffCfg: {},
  extraBuffs: [],
  backpack: [],
};

function save(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
function load(): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch {
    /* ignore */
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

// ---------- Вимоги речей / бюджет статів ----------

interface ReqCheck {
  ok: boolean;
  lvl: boolean;
  str: boolean;
  dex: boolean;
  mag: boolean;
}
/** Бонуси атрибутів (om/uy/lf/tx) від активного спорядження — кеш останнього computeStats. */
let gearAttr: Record<string, number> = {};
/** Чи відповідає персонаж вимогам речі (рівень + Сила/Спритн/Інт).
 *  Атрибути — з урахуванням бонусів від речей (як у грі: трактат +45 інт дозволяє зброю з 297). */
function meetsReq(it: Item, gear: Record<string, number> = gearAttr): ReqCheck {
  const lvl = state.level >= (Number(it.oj) || 0);
  const str = state.str + (gear.om || 0) >= (Number(it.om_uo) || 0);
  const dex = state.dex + (gear.uy || 0) >= (Number(it.uy_uo) || 0);
  const mag = state.mag + (gear.tx || 0) >= (Number((it as Record<string, unknown>).tx_uo) || 0);
  return { ok: lvl && str && dex && mag, lvl, str, dex, mag };
}

const ATTR_BASE = 5; // базове значення кожного атрибута
/** Доступно вільних очок статів: 5 за рівень (понад 1-й) мінус витрачені. */
function availPoints(): number {
  const budget = 5 * Math.max(0, (state.level || 1) - 1);
  const spent =
    state.str - ATTR_BASE + (state.dex - ATTR_BASE) + (state.vit - ATTR_BASE) + (state.mag - ATTR_BASE);
  return budget - spent;
}

// ---------- Іконка / клітинка ----------

function cellInner(slot: SlotDef): string {
  const it = state.equipped[slot.slot];
  if (!it) return '';
  return '<span class="doll-icon" style="' + iconStyle(it, slot.cat, state.gender) + '"></span>';
}

function slotHtml(slot: SlotDef): string {
  const it = state.equipped[slot.slot];
  const filled = it ? ' is-filled' : '';
  const bad = it && !meetsReq(it).ok ? ' is-bad' : '';
  const tip = slot.label + (it ? ': ' + it.name : '');
  return (
    '<div class="doll-slot' + filled + bad + '" data-slot="' + slot.slot + '" tabindex="0" role="button" ' +
    'draggable="' + (it ? 'true' : 'false') + '" title="' + escHtml(tip) + '" aria-label="' + escHtml(tip) + '">' +
    '<span class="doll-cell">' + cellInner(slot) + '</span>' +
    '<span class="doll-slot-label">' + escHtml(slot.label) + '</span>' +
    '</div>'
  );
}

function renderDoll(): void {
  const grid = $('dollGrid');
  if (!grid) return;
  const t = computeStats(); // спершу стати — щоб is-bad слотів бачив свіжі бонуси атрибутів
  grid.innerHTML = SLOTS.map(slotHtml).join('');
  renderSummary(t);
  renderBuffs();
  renderHistory();
  renderOpponent();
  if (dmgCheckOn) renderSkillGrid();
  renderDmgLog();
  renderBackpack();
  updateAvail();
}

// ---------- Характеристики (агрегація зі спорядження) ----------

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

/** Додати стат до тоталів з урахуванням діапазонів/стихій. */
function applyStat(add: (k: string, v: number) => void, type: string, v: number): void {
  if (type === 'ld') {
    add('ld_min', v);
    add('ld_max', v);
  } else if (type === 'xq') {
    add('xq_min', v);
    add('xq_max', v);
  } else if (type === 'ab_gq') {
    for (const e of ELEM) add(e, v);
  } else {
    add(type, v);
  }
}

/** Базові стати речі як редагований список {type,val} (для вкладки «Характеристики»). */
function flattenItemStats(it: Item): Array<{ type: string; val: number }> {
  const o = it as Record<string, unknown>;
  const out: Array<{ type: string; val: number }> = [];
  // ld/xq: у зброї — діапазон [min,max], у біжутерії/поясів/боєприпасів/томів — плоске число (+N до обох меж)
  if (Array.isArray(it.ld)) {
    out.push({ type: 'ld_min', val: num(it.ld[0]) });
    out.push({ type: 'ld_max', val: num(it.ld[1]) });
  } else if (num(it.ld)) {
    out.push({ type: 'ld_min', val: num(it.ld) });
    out.push({ type: 'ld_max', val: num(it.ld) });
  }
  if (Array.isArray(it.xq)) {
    out.push({ type: 'xq_min', val: num(it.xq[0]) });
    out.push({ type: 'xq_max', val: num(it.xq[1]) });
  } else if (num(it.xq)) {
    out.push({ type: 'xq_min', val: num(it.xq) });
    out.push({ type: 'xq_max', val: num(it.xq) });
  }
  if (typeof it.wf === 'number' && it.wf) out.push({ type: 'wf', val: it.wf });
  const ab = it.ab_gq;
  if (typeof ab === 'number' && ab) out.push({ type: 'ab_gq', val: ab });
  else if (ab && typeof ab === 'object') {
    const m = ab as Record<string, unknown>;
    for (const e of ELEM) if (m[e] != null) out.push({ type: e, val: num(m[e]) });
  }
  if (typeof it.hp === 'number' && it.hp) out.push({ type: 'hp', val: it.hp });
  if (typeof o.mana === 'number' && o.mana) out.push({ type: 'mp', val: num(o.mana) });
  if (typeof it.qe === 'number' && it.qe) out.push({ type: 'qe', val: it.qe });
  const nw = it.nw as { wu?: Array<{ type?: string; val?: unknown }> } | undefined;
  if (nw && Array.isArray(nw.wu)) for (const w of nw.wu) if (w && w.type) out.push({ type: w.type, val: num(w.val) });
  return out;
}

/** Сумарні стати зі вказаних слотів (редаговані властивості + камені + заточка + сети). */
function aggregateStats(active: ReadonlySet<string>): Record<string, number> {
  const t: Record<string, number> = {};
  const add = (k: string, v: number): void => {
    const key = STAT_ALIAS[k] || k;
    t[key] = (t[key] || 0) + v;
  };
  for (const slot in state.equipped) {
    const it = state.equipped[slot];
    if (!active.has(slot)) continue; // непридатна річ (не вистачає рівня/статів) — не враховується
    if (typeof it.sy === 'number') t.sy = Math.max(t.sy || 0, it.sy); // АПС — з предмета
    // Властивості речі (редаговані per-instance; якщо не задані — з бази предмета).
    const ad = state.addons[slot];
    const stats = ad && ad.length ? ad : flattenItemStats(it);
    for (const a of stats) if (a && a.type) applyStat(add, a.type, num(a.val));
    // Камені в гніздах (у зброї діє obDops[0], інакше — obDops[1]).
    const ob = state.gems[slot];
    if (Array.isArray(ob)) {
      for (const g of ob) {
        const dops = g && (g.obDops as unknown);
        if (!Array.isArray(dops)) continue;
        const pick = (slot === 'ta' ? dops[0] : dops[1]) || dops[0];
        if (Array.isArray(pick)) applyStat(add, String(pick[0]), parseFloat(String(pick[1])) || 0);
      }
    }
    // Заточка (+N): бонус головної стати за типом gh[0] (книги мають власну таблицю поправок).
    const lvl = state.refine[slot] || 0;
    const gh = it.gh as unknown;
    const isBook = slot === 'qn';
    if (lvl > 0 && Array.isArray(gh) && typeof gh[1] === 'number') {
      const rv = refineVal(gh[1], lvl, isBook);
      const types = Array.isArray(gh[0]) ? (gh[0] as string[]) : [String(gh[0])];
      for (const rt of types) {
        if (rt === 'av') {
          if (Array.isArray(it.ld) || num(it.ld)) {
            add('ld_min', rv);
            add('ld_max', rv);
          }
          if (Array.isArray(it.xq) || num(it.xq)) {
            add('xq_min', rv);
            add('xq_max', rv);
          }
        } else {
          applyStat(add, rt, rv);
        }
      }
    }
    // Бонуси заточки книг (mypers ghAddons.qn): кумулятивні пороги +3/+6/+9/+12.
    if (isBook && lvl > 0) {
      for (const thr in QN_REFINE_ADDONS) {
        if (Number(thr) > lvl) continue;
        for (const [code, val] of Object.entries(QN_REFINE_ADDONS[Number(thr)])) {
          if (code === 'ld') {
            add('ld_min', val);
            add('ld_max', val);
          } else if (code === 'xq') {
            add('xq_min', val);
            add('xq_max', val);
          } else {
            add(code, val);
          }
        }
      }
    }
  }
  // Бонуси комплектів (сетів): рахуємо деталі за спільним ps, додаємо zn для порогів ≤ к-сті.
  const sd = getSets();
  if (sd) {
    const psCount = setPieceCount(active);
    for (const ps in psCount) {
      const set = sd[ps];
      if (!set || !set.zn) continue;
      for (const k in set.zn) {
        if (Number(k) <= psCount[ps]) {
          const b = set.zn[k];
          if (b.type === 'ab_gq') {
            for (const e of ELEM) add(e, b.val);
          } else if (b.type === 'ld') {
            add('ld_min', b.val);
            add('ld_max', b.val);
          } else if (b.type === 'xq') {
            add('xq_min', b.val);
            add('xq_max', b.val);
          } else {
            add(b.type, b.val);
          }
        }
      }
    }
  }
  return t;
}

/** Набір слотів, чиї вимоги виконані. Атрибути від уже активних речей ідуть у залік
 *  (трактат +45 інт «вмикає» зброю з вимогою 297) — ітеруємо до фікспоінта. */
function computeActiveSlots(): Set<string> {
  const slots = Object.keys(state.equipped);
  const active = new Set<string>();
  for (let pass = 0; pass < slots.length; pass++) {
    const t = aggregateStats(active);
    let changed = false;
    for (const slot of slots) {
      if (!active.has(slot) && meetsReq(state.equipped[slot], t).ok) {
        active.add(slot);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return active;
}

/** Сумарні стати з усіх придатних надітих предметів (+ оновлює кеш gearAttr для meetsReq). */
function computeStats(): Record<string, number> {
  const t = aggregateStats(computeActiveSlots());
  gearAttr = { om: t.om || 0, uy: t.uy || 0, lf: t.lf || 0, tx: t.tx || 0 };
  return t;
}

/** Скільки деталей кожного сета (за спільним ps) надіто.
 *  Як у mypers: лише речі, що проходять вимоги, і без дублів (та сама річ двічі — 1 деталь). */
function setPieceCount(active: ReadonlySet<string>): Record<string, number> {
  const c: Record<string, number> = {};
  const seen = new Set<string>();
  for (const slot in state.equipped) {
    const it = state.equipped[slot];
    if (!active.has(slot)) continue;
    const ps = (it as Record<string, unknown>).ps;
    if (ps == null) continue;
    const cat = SLOTS.find((s) => s.slot === slot)?.cat || slot;
    const key = cat + ':' + it.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const k = String(ps);
    c[k] = (c[k] || 0) + 1;
  }
  return c;
}

/** Підсумок персонажа: повний розрахунок стат (база + спорядження). */
function renderSummary(t: Record<string, number>): void {
  const box = $('dollSummary');
  if (!box) return;
  const ib = deriveIb();
  const c = computeChar(
    {
      cls: state.cls,
      level: state.level || 1,
      str: state.str,
      dex: state.dex,
      vit: state.vit,
      mag: state.mag,
      weaponIr: typeof state.equipped.ta?.ir === 'string' ? state.equipped.ta.ir : undefined,
    },
    t,
    ib,
  );
  const f = (n: number) => Math.round(n).toLocaleString('uk');
  const rng = (rr: { min: number; max: number }) => f(rr.min) + '–' + f(rr.max);
  const row = (l: string, v: string) => '<div class="doll-stat"><span>' + l + '</span><b>' + v + '</b></div>';
  // Атрибут із бонусом від спорядження: підсвітка зеленим + скільки додалося до чистих статів
  const attrRow = (l: string, total: number, bonus: number) =>
    bonus
      ? '<div class="doll-stat"><span>' + l + '</span><b class="up">' + f(total) +
        ' <i>(' + (bonus > 0 ? '+' : '−') + f(Math.abs(bonus)) + ')</i></b></div>'
      : row(l, f(total));
  const ELEM_LABEL: Record<string, string> = { lw: 'Метал', mo: 'Дерево', dn: 'Вода', vt: 'Вогонь', sp: 'Земля' };
  const elemRows = Object.entries(c.elem)
    .map(([k, e]) => row('  ' + ELEM_LABEL[k], f(e.def) + ' (−' + e.perc.toFixed(1) + '%)'))
    .join('');

  // Зведене значення стата: спорядження (t) + бафи (ib).
  const g = (...keys: string[]): number => keys.reduce((s, k) => s + (t[k] || 0) + (ib[k] || 0), 0);
  const aps = t.sy || 0;
  const critDmg = 200 + g('gs_crit_rage_ghk'); // база 200% + бонуси крит. урону
  const atkLvl = g('ad', 'gs_ad'); // рівень атаки (спорядження + бафи)
  const defLvl = g('sx', 'gs_sx'); // рівень захисту
  const physPen = g('pec', 'zjz'); // фіз. пробивання %
  const magPen = g('kdn', 'xwp'); // маг. пробивання %
  const physDmgRed = g('bu', 'zen'); // зменш. фіз. урону %
  const magDmgRed = g('ia', 'sfy'); // зменш. маг. урону %
  const channel = g('ci') - g('re') + g('xj'); // час співу % (re швидше, xj повільніше)
  const spirit = g('mr', 'vln'); // бойовий дух
  const soulforce = g('mk'); // сила духу
  const speed = g('cl', 'gs_cl'); // швидкість руху (бонус)
  const mobDmg = g('su', 'qgc'); // урон монстрам
  const mobDef = g('wz', 'wkl'); // захист від монстрів
  const hpRec = g('cx', 'bl'); // віднов. HP/сек
  const mpRec = g('mp_recovery', 'vl'); // віднов. MP/сек
  const pct = (n: number) => (n > 0 ? '+' : '') + f(n) + '%';
  box.innerHTML =
    '<div class="doll-stat-group"><h4>Бій</h4>' +
    row('Фіз. атака', rng(c.physAtk)) +
    row('Маг. атака', rng(c.magAtk)) +
    row('Рівень атаки', f(atkLvl)) +
    row('Шанс криту', c.crit + '%') +
    row('Крит. урон', critDmg + '%') +
    row('Атак/сек', aps ? aps.toFixed(2) : '—') +
    row('Час співу', pct(channel)) +
    row('Фіз. пробивання', pct(physPen)) +
    row('Маг. пробивання', pct(magPen)) +
    '</div>' +
    '<div class="doll-stat-group"><h4>Захист</h4>' +
    row('Фіз. захист', f(c.physDef) + ' (−' + c.physDefPerc.toFixed(1) + '%)') +
    row('Маг. захист (сер.)', f(c.magDef) + ' (−' + c.magDefPerc.toFixed(1) + '%)') +
    elemRows +
    row('Рівень захисту', f(defLvl)) +
    row('Зменш. фіз. урону', pct(physDmgRed)) +
    row('Зменш. маг. урону', pct(magDmgRed)) +
    '</div>' +
    '<div class="doll-stat-group"><h4>Здоровʼя / Мана</h4>' +
    row('Здоровʼя', f(c.hp)) +
    row('Мана', f(c.mp)) +
    row('Віднов. HP/сек', f(hpRec)) +
    row('Віднов. MP/сек', f(mpRec)) +
    '</div>' +
    '<div class="doll-stat-group"><h4>Основні</h4>' +
    row('Меткість', f(c.acc)) +
    row('Ухилення', f(c.eva)) +
    row('Швидкість', pct(speed)) +
    row('Бойовий дух', f(spirit)) +
    row('Сила духу', f(soulforce)) +
    row('Урон монстрам', f(mobDmg)) +
    row('Захист від монстрів', f(mobDef)) +
    '</div>' +
    '<div class="doll-stat-group"><h4>Атрибути</h4>' +
    attrRow('Сила', c.attr.str, t.om || 0) +
    attrRow('Тілобудова', c.attr.vit, t.lf || 0) +
    attrRow('Спритність', c.attr.dex, t.uy || 0) +
    attrRow('Інтелект', c.attr.mag, t.tx || 0) +
    '</div>';

  // Бейдж «+N» біля інпутів атрибутів у шапці (чистий стат + бонус від речей).
  const attrPlus = (id: string, base: number, bonus: number) => {
    const el = $(id);
    if (!el) return;
    el.textContent = bonus ? '+' + f(bonus) : '';
    el.title = bonus ? f(base) + ' чистих + ' + f(bonus) + ' від речей = ' + f(base + bonus) : '';
  };
  attrPlus('dollStrPlus', state.str, t.om || 0);
  attrPlus('dollDexPlus', state.dex, t.uy || 0);
  attrPlus('dollVitPlus', state.vit, t.lf || 0);
  attrPlus('dollMagPlus', state.mag, t.tx || 0);
}

function renderStats(): void {
  renderSummary(computeStats());
}

// ---------- Редактор речі (камені / заточка / допи) ----------

type EditorTarget = { kind: 'slot'; slot: string } | { kind: 'bp'; idx: number };
let editorTarget: EditorTarget | null = null;
let editorTab: 'gems' | 'addons' = 'gems';
let dragSrc: { kind: 'slot'; slot: string } | { kind: 'bp'; idx: number } | null = null;

function edItem(): Item | null {
  if (!editorTarget) return null;
  return editorTarget.kind === 'slot'
    ? state.equipped[editorTarget.slot] || null
    : state.backpack[editorTarget.idx]?.item || null;
}
function edCat(): string {
  if (!editorTarget) return '';
  if (editorTarget.kind === 'slot') {
    const slot = editorTarget.slot;
    const d = SLOTS.find((s) => s.slot === slot);
    return d ? d.cat : '';
  }
  return state.backpack[editorTarget.idx]?.cat || '';
}
/** Приводить масив гнізд до фіксованої довжини (старі збереження мали 2 для броні). */
function normGems(arr: Array<Item | null>, cat: string): Array<Item | null> {
  const want = defaultSockets(cat);
  while (arr.length < want) arr.push(null);
  if (arr.length > want) arr.length = want;
  return arr;
}
function edGems(): Array<Item | null> {
  if (!editorTarget) return [];
  if (editorTarget.kind === 'slot') {
    if (!Array.isArray(state.gems[editorTarget.slot])) state.gems[editorTarget.slot] = [];
    return normGems(state.gems[editorTarget.slot], edCat());
  }
  const e = state.backpack[editorTarget.idx];
  if (!e) return [];
  if (!Array.isArray(e.gems)) e.gems = [];
  return normGems(e.gems, e.cat);
}
function edRefine(): number {
  if (!editorTarget) return 0;
  return editorTarget.kind === 'slot' ? state.refine[editorTarget.slot] || 0 : state.backpack[editorTarget.idx]?.refine || 0;
}
function edAddons(): Array<{ type: string; val: number }> {
  if (!editorTarget) return [];
  const it = edItem();
  if (editorTarget.kind === 'slot') {
    const cur = state.addons[editorTarget.slot];
    if ((!Array.isArray(cur) || !cur.length) && it) state.addons[editorTarget.slot] = flattenItemStats(it);
    return state.addons[editorTarget.slot] || (state.addons[editorTarget.slot] = []);
  }
  const e = state.backpack[editorTarget.idx];
  if (!e) return [];
  if ((!Array.isArray(e.addons) || !e.addons.length) && it) e.addons = flattenItemStats(it);
  if (!Array.isArray(e.addons)) e.addons = [];
  return e.addons;
}

function openEditor(target: EditorTarget): void {
  editorTarget = target;
  editorTab = 'gems';
  renderEditor();
  const m = $('dollEditor');
  if (m) m.hidden = false;
}
function closeEditor(): void {
  const m = $('dollEditor');
  if (m) m.hidden = true;
  editorTarget = null;
}

function renderEditor(): void {
  const box = $('dollEditorBody');
  if (!box || !editorTarget) return;
  const it = edItem();
  if (!it) {
    closeEditor();
    return;
  }
  const cat = edCat();
  const isBp = editorTarget.kind === 'bp';
  const max = maxSockets(cat);
  const gems = edGems();

  const head =
    '<div class="doll-ed-head">' +
    '<span class="doll-ref-ctrl" title="Рівень заточки (0–12)">+<input type="number" id="dollEdRefine" min="0" max="12" value="' + edRefine() + '"></span>' +
    '<span class="doll-cell"><span class="doll-icon" style="' + iconStyle(it, cat, state.gender) + '"></span></span>' +
    '<span class="doll-ed-name">' + escHtml(it.name) + '</span></div>';

  const acts = isBp
    ? '<button type="button" class="btn btn-primary" id="dollEdToChar">На персонажа</button>' +
      '<button type="button" class="btn btn-ghost" id="dollEdDel">Видалити</button>'
    : '<button type="button" class="btn btn-ghost" id="dollEdChange">Змінити річ</button>' +
      '<button type="button" class="btn btn-ghost" id="dollEdToBp">У рюкзак</button>' +
      '<button type="button" class="btn btn-ghost" id="dollEdRemove">Зняти</button>';

  const tabs =
    '<div class="doll-ed-tabs">' +
    '<button type="button" class="doll-ed-tab' + (editorTab === 'gems' ? ' active' : '') + '" data-tab="gems">Камені</button>' +
    '<button type="button" class="doll-ed-tab' + (editorTab === 'addons' ? ' active' : '') + '" data-tab="addons">Характеристики</button></div>';

  let body = '';
  if (editorTab === 'gems') {
    if (max === 0) body = '<div class="muted" style="padding:8px 0">Ця річ не має гнізд під камені.</div>';
    else {
      const cells = gems
        .map(
          (g, i) =>
            '<button type="button" class="doll-socket' + (g ? ' is-filled' : '') + '" data-gidx="' + i +
            '" title="' + (g ? escHtml(g.name) : 'Порожнє гніздо') + '"><span class="doll-cell sm">' +
            (g ? '<span class="doll-icon" style="' + iconStyle(g, 'ob', state.gender) + '"></span>' : '') + '</span></button>',
        )
        .join('');
      body = '<div class="doll-sockets">' + cells + '</div>';
    }
  } else {
    const addonRows = edAddons()
      .map((a, i) => {
        const sel =
          '<select class="doll-addon-type" data-i="' + i + '">' +
          ADDON_OPTIONS.map((o) => '<option value="' + o.code + '"' + (o.code === a.type ? ' selected' : '') + '>' + escHtml(o.label) + '</option>').join('') +
          '</select>';
        return '<div class="doll-addon-row">' + sel + '<input type="number" class="doll-addon-val" data-i="' + i + '" value="' + a.val + '"><button type="button" class="doll-addon-del" data-i="' + i + '">✕</button></div>';
      })
      .join('');
    body = '<div class="doll-addons">' + addonRows + '</div><button type="button" class="btn btn-ghost" id="dollEdAddAddon">+ Дод. характеристику</button>';
  }

  box.innerHTML = head + '<div class="doll-ed-acts">' + acts + '</div>' + tabs + '<div class="doll-ed-tabbody">' + body + '</div>';
}

// Підписи кодів стат (для бонусів сетів).
const CODE_LABEL: Record<string, string> = {
  hp: 'Здоровʼя', mp: 'Мана', om: 'Сила', lf: 'Тілобудова', uy: 'Спритність', tx: 'Інтелект',
  wf: 'Фіз. захист', ab_gq: 'Маг. захист', ld: 'Фіз. атака', xq: 'Маг. атака',
  ad: 'Рівень атаки', sx: 'Рівень захисту', ae: 'Меткість', qe: 'Ухилення', cl: 'Швидкість',
  ci: 'Час співу', mr: 'Бойовий дух', mk: 'Сила духу', ed: 'Шанс криту', wz: 'Захист від монстрів',
  su: 'Урон монстрам', bu: 'Зменш. фіз. урону', ia: 'Зменш. маг. урону', pec: 'Фіз. пробивання', kdn: 'Маг. пробивання',
  lw_eq: 'Захист: метал', mo_eq: 'Захист: дерево', dn_eq: 'Захист: вода', vt_eq: 'Захист: вогонь', sp_eq: 'Захист: земля',
  co: 'Макс. HP', cc: 'Макс. MP', cp: 'Міцність', exp: 'Досвід', jk: 'Шанс криту',
  ae_eg: 'Меткість', qe_eg: 'Ухилення', wf_eg: 'Фіз. захист', ab_gq_eg: 'Маг. захист', cl_eg: 'Швидкість',
  cx: 'Віднов. HP', mp_recovery: 'Віднов. MP', max_oi_av: 'Макс. фіз. атака', max_xq: 'Макс. маг. атака',
  bonus_hf: 'Бонус рівня', mana: 'Мана', sy: 'Атак/сек', fp: 'Дальність', xn: 'Інтервал', vln: 'Бойовий дух',
};
const codeLabel = (c: string): string => CODE_LABEL[c] || c;

// Коди-відсотки та коди зі знаком «−» (для відображення допів у тултіпі).
const PCT_CODES = new Set(['ed', 'bu', 'ia', 'exp', 'co', 'cc', 'cp', 'jk', 'ae_eg', 'qe_eg', 'wf_eg', 'ab_gq_eg', 'cl_eg']);
const MINUS_CODES = new Set(['ci', 'ct', 'xn']);
function propLine(code: string, val: unknown): string {
  const sign = MINUS_CODES.has(code) ? '−' : '+';
  const suf = PCT_CODES.has(code) ? '%' : code === 'xn' ? ' сек' : '';
  return codeLabel(code) + ' ' + sign + val + suf;
}

// ---------- Поточні характеристики / історія / опонент ----------

function currentChar(): CharStats {
  const t = computeStats();
  return computeChar(
    {
      cls: state.cls,
      level: state.level || 1,
      str: state.str,
      dex: state.dex,
      vit: state.vit,
      mag: state.mag,
      weaponIr: typeof state.equipped.ta?.ir === 'string' ? state.equipped.ta.ir : undefined,
    },
    t,
    deriveIb(),
  );
}

const LS_HISTORY = 'pwDollHistory';
const LS_OPP = 'pwDollOpp';

interface SavedBuild {
  name: string;
  ts: number;
  state: DollState;
}

function getHistory(): SavedBuild[] {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]') as SavedBuild[];
  } catch {
    return [];
  }
}
function putHistory(h: SavedBuild[]): void {
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(0, 20)));
  } catch {
    /* ignore */
  }
}
function saveBuild(name: string): void {
  const h = getHistory();
  h.unshift({ name: name || 'Білд ' + (h.length + 1), ts: Date.now(), state: JSON.parse(JSON.stringify(state)) });
  putHistory(h);
  renderHistory();
}
function loadBuild(idx: number): void {
  const h = getHistory();
  const b = h[idx];
  if (!b) return;
  Object.assign(state, JSON.parse(JSON.stringify(b.state)));
  save();
  syncHeader();
  renderDoll();
}
function deleteBuild(idx: number): void {
  const h = getHistory();
  h.splice(idx, 1);
  putHistory(h);
  renderHistory();
}

function syncHeader(): void {
  const set = (id: string, v: string) => {
    const el = $<HTMLInputElement | HTMLSelectElement>(id);
    if (el) el.value = v;
  };
  set('dollClass', state.cls);
  set('dollLevel', String(state.level));
  set('dollStr', String(state.str));
  set('dollDex', String(state.dex));
  set('dollVit', String(state.vit));
  set('dollMag', String(state.mag));
  document.querySelectorAll<HTMLInputElement>('input[name="dollGender"]').forEach((r) => {
    r.checked = r.value === state.gender;
  });
}

function renderHistory(): void {
  const box = $('dollHistory');
  if (!box) return;
  const h = getHistory();
  box.innerHTML = h.length
    ? h
        .map(
          (b, i) =>
            '<div class="doll-hist-row"><span class="doll-hist-name">' + escHtml(b.name) + '</span>' +
            '<span class="doll-hist-act"><button type="button" class="btn btn-ghost" data-load="' + i + '">Завантажити</button>' +
            '<button type="button" class="doll-hist-del" data-del="' + i + '" aria-label="Видалити">✕</button></span></div>',
        )
        .join('')
    : '<div class="muted" style="padding:6px 0">Немає збережених білдів.</div>';
}

// ----- Опонент (моб): модель + редактор + перевірка дамага -----

/** Модель моба-мішені (як `yos` у mypers) — поля з екрана «налаштувати суперника». */
interface OppMob {
  name: string;
  hp: number;
  level: number;
  physAtkMin: number;
  physAtkMax: number;
  magAtkMin: number;
  magAtkMax: number;
  acc: number; // меткість
  eva: number; // ухилення
  physDef: number; // фіз. захист (сире значення)
  lw: number; // метал
  mo: number; // дерево
  dn: number; // вода
  vt: number; // вогонь
  sp: number; // земля
}

/** Дефолт — «Золотий король» (з рефу). */
const DEFAULT_OPP: OppMob = {
  name: 'Золотий король', hp: 23977103, level: 150,
  physAtkMin: 17139, physAtkMax: 20567, magAtkMin: 7234, magAtkMax: 8681,
  acc: 4940, eva: 91, physDef: 2140, lw: 1767, mo: 1031, dn: 1767, vt: 1767, sp: 2871,
};

function getOpp(): OppMob {
  try {
    const raw = localStorage.getItem(LS_OPP);
    if (raw) return { ...DEFAULT_OPP, ...(JSON.parse(raw) as Partial<OppMob>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_OPP };
}
function saveOpp(o: OppMob): void {
  try {
    localStorage.setItem(LS_OPP, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

const ELEM_SHORT = ['lw', 'mo', 'dn', 'vt', 'sp'] as const;

/** % зрізання урону мобом для типу: фіз. або стихія (рахується від рівня атакуючого = нашого). */
function oppReductionPerc(mob: OppMob, kind: 'phys' | 'lw' | 'mo' | 'dn' | 'vt' | 'sp'): number {
  const def = kind === 'phys' ? mob.physDef : mob[kind];
  return defPerc(def, state.level || 1);
}
/** Середня маг. редукція по 5 стихіях. */
function oppMagReductionPerc(mob: OppMob): number {
  let s = 0;
  for (const e of ELEM_SHORT) s += oppReductionPerc(mob, e);
  return s / 5;
}

/**
 * Множник рівня (mypers `oza`): залежить від різниці рівнів (мішень − атакуючий).
 * 3–5 → 0.9, 6–8 → 0.8, 9–11 → 0.7, 12–15 → 0.6, 16–20 → 0.5, >20 → 0.25, інакше 1.
 */
function levelMult(atkLvl: number, defLvl: number): number {
  const n = defLvl - atkLvl;
  if (n >= 3 && n <= 5) return 0.9;
  if (n >= 6 && n <= 8) return 0.8;
  if (n >= 9 && n <= 11) return 0.7;
  if (n >= 12 && n <= 15) return 0.6;
  if (n >= 16 && n <= 20) return 0.5;
  if (n > 20) return 0.25;
  return 1;
}

interface SkillDmg {
  min: number;
  max: number;
  critMin: number;
  critMax: number;
}

/**
 * Множник рівнів атаки/захисту (mypers L): q = наш рівень атаки, w = рівень захисту цілі.
 * q>w → 1+(q−w)/100; q<w → 1/(1+1.2×(w−q)/100).
 */
function atkLevelMult(q: number, w: number): number {
  if (q > w) return 1 + (q - w) / 100;
  if (q < w) return 1 / (1 + (1.2 * (w - q)) / 100);
  return 1;
}

/**
 * Урон скіла по мобу (формула mypers `ghk`/`vyp`):
 *   атака × множник рівня (oza) × множник рівня атаки (L) + плоский урон скіла,
 *   мінус % захисту мішені. Крит = урон × (крит. множник / 100).
 */
function skillDamage(me: CharStats, mob: OppMob, sk: SkillDef, critMult: number, atkLvl: number): SkillDmg {
  const hfMult = levelMult(state.level || 1, mob.level || 1);
  const L = atkLevelMult(atkLvl, 0); // редактор моба не має рівня захисту → 0
  const red = sk.mag ? oppMagReductionPerc(mob) : oppReductionPerc(mob, 'phys');
  const atk = sk.mag ? me.magAtk : me.physAtk;
  const z = 1 - red / 100;
  const calc = (base: number) => Math.max(0, Math.round((base * (sk.thw || 1) * hfMult * L + sk.flat) * z));
  const min = calc(atk.min);
  const max = calc(atk.max);
  return { min, max, critMin: Math.round(min * critMult), critMax: Math.round(max * critMult) };
}

/** Редактор моба-суперника (екран «налаштувати суперника»). */
function renderOpponent(): void {
  const box = $('dollOpp');
  if (!box) return;
  const o = getOpp();
  const f = (n: number) => n.toLocaleString('uk');
  // Поле «підпис + інпут» (для дробових/великих чисел).
  const field = (label: string, key: keyof OppMob, extraCls = '') =>
    '<label class="doll-opp-f ' + extraCls + '"><span class="doll-opp-l">' + label + '</span>' +
    '<input type="text" inputmode="numeric" class="doll-opp-in" data-opp="' + key + '" value="' + f(o[key] as number) + '"></label>';
  box.innerHTML =
    '<div class="doll-opp-title">' +
    '<input type="text" class="doll-opp-name" data-opp="name" value="' + escHtml(o.name) + '" aria-label="Назва суперника">' +
    '</div>' +
    '<div class="doll-opp-top">' +
    '<label class="doll-opp-f hp"><span class="doll-opp-l">ЖС</span>' +
    '<input type="text" inputmode="numeric" class="doll-opp-in" data-opp="hp" value="' + f(o.hp) + '"></label>' +
    '<label class="doll-opp-f lvl"><span class="doll-opp-l">Рівень</span>' +
    '<input type="text" inputmode="numeric" maxlength="3" class="doll-opp-in" data-opp="level" value="' + f(o.level) + '"></label>' +
    '</div>' +
    '<div class="doll-opp-cols">' +
    '<div class="doll-opp-col"><div class="doll-opp-col-h">Атака</div>' +
    field('Мін. фіз. атака', 'physAtkMin') +
    field('Макс. фіз. атака', 'physAtkMax') +
    field('Мін. маг. атака', 'magAtkMin') +
    field('Макс. маг. атака', 'magAtkMax') +
    field('Меткість', 'acc') +
    field('Ухилення', 'eva') +
    '</div>' +
    '<div class="doll-opp-col"><div class="doll-opp-col-h">Захист</div>' +
    field('Фіз. захист', 'physDef') +
    field('Метал', 'lw') +
    field('Дерево', 'mo') +
    field('Вода', 'dn') +
    field('Вогонь', 'vt') +
    field('Земля', 'sp') +
    '</div>' +
    '</div>';
}

/** Чи активний режим перевірки дамага (показано сітку скілів). */
let dmgCheckOn = false;
/** Накопичений лог урону (рядки HTML, новіші зверху) — тримається доки не очистять. */
let dmgLog: string[] = [];

/** Сітка дамажних скілів класу — клік додає рядок у лог. */
function renderSkillGrid(): void {
  const box = $('dollSkillGrid');
  if (!box) return;
  if (!getSkills()) {
    box.innerHTML = '<div class="muted" style="padding:6px 0">Завантаження скілів…</div>';
    return;
  }
  const list = (getSkills()?.[String(XZ[state.cls] || 1)] || []).filter((sk) => sk.name);
  if (!list.length) {
    box.innerHTML = '<div class="muted" style="padding:6px 0">Для цього класу даних скілів немає.</div>';
    return;
  }
  box.innerHTML = list
    .map(
      (sk) =>
        '<button type="button" class="doll-skill-ic" data-skill="' + sk.id + '" title="' + escHtml(sk.name) + '">' +
        '<span class="doll-icon" style="' + buffIconStyle(sk.an) + '"></span>' +
        '<span class="doll-skill-cap">' + escHtml(sk.name) + '</span></button>',
    )
    .join('');
}

/** Розрахувати урон для скіла й додати рядок (з іконкою) у лог. */
function logSkillDamage(skillId: number): void {
  const list = getSkills()?.[String(XZ[state.cls] || 1)] || [];
  const sk = list.find((s) => s.id === skillId);
  if (!sk) return;
  const me = currentChar();
  const mob = getOpp();
  const t = computeStats();
  const ib = deriveIb();
  // Крит. множник (mypers mq): 200% + gs_crit_rage_ghk зі споряди та бафів;
  // спец-скіли перекривають: 334 → ×1.5, 330/331 → ×1.3.
  let critMult = (200 + (t.gs_crit_rage_ghk || 0) + (ib.gs_crit_rage_ghk || 0)) / 100;
  if (sk.id === 334) critMult = 1.5;
  else if (sk.id === 330 || sk.id === 331) critMult = 1.3;
  // Рівень атаки: спорядження (ad) + бафи (gs_ad/−vh_ad).
  const atkLvl = (t.ad || 0) + (ib.ad || 0) + (ib.gs_ad || 0) - (ib.vh_ad || 0);
  const d = skillDamage(me, mob, sk, critMult, atkLvl);
  const f = (n: number) => Math.round(n).toLocaleString('uk');
  dmgLog.unshift(
    '<div class="doll-dmg-line">' +
      '<span class="doll-icon doll-dmg-ic" style="' + buffIconStyle(sk.an) + '"></span>' +
      '<span class="doll-dmg-txt"><b>' + escHtml(mob.name) + '</b> отримує від вас застосуванням «' + escHtml(sk.name) + '» ' +
      '<span class="doll-dmg-v">' + f(d.min) + '–' + f(d.max) + '</span> од. урону.' +
      ' Критичний урон <span class="doll-dmg-v">' + f(d.critMin) + '–' + f(d.critMax) + '</span> од. урону.' +
      '</span></div>',
  );
  if (dmgLog.length > 200) dmgLog.length = 200; // захист від нескінченного росту
  renderDmgLog();
}

/** Відмалювати накопичений лог урону. */
function renderDmgLog(): void {
  const box = $('dollDmgLog');
  if (!box) return;
  box.innerHTML = dmgLog.length
    ? dmgLog.join('')
    : '<div class="muted doll-dmg-empty">Клікни по скілу вище, щоб порахувати урон.</div>';
}

function clearDmgLog(): void {
  dmgLog = [];
  renderDmgLog();
}

function toggleDmgCheck(): void {
  dmgCheckOn = !dmgCheckOn;
  const sec = $('dollDmgSection');
  if (sec) sec.classList.toggle('is-on', dmgCheckOn);
  const btn = $('dollCheckDmg');
  if (btn) btn.textContent = dmgCheckOn ? 'Сховати скіли' : 'Перевірити дамаг';
  if (dmgCheckOn) {
    renderSkillGrid();
    renderDmgLog();
  }
}

/** ib-карта зведених ефектів активних бафів (для рушія). */
function buffCfgFor(id: number): { on: boolean; lvl: number; side: string } {
  const k = String(id);
  if (!state.buffCfg[k]) state.buffCfg[k] = { on: false, lvl: 10, side: '' }; // дефолт: 10 рів., без сторони
  return state.buffCfg[k];
}

/** Усі бафи у рядку: бафи поточного класу + додані вручну. */
function shownBuffs(): BuffDef[] {
  const list = (getBuffs()?.[String(XZ[state.cls] || 1)] || []).slice();
  for (const id of state.extraBuffs) {
    const b = getBuffById(id);
    if (b && !list.some((x) => x.id === id)) list.push(b);
  }
  return list;
}

/** ib-карта зведених ефектів увімкнених бафів (для рушія). */
function deriveIb(): Record<string, number> {
  const ib: Record<string, number> = {};
  for (const b of shownBuffs()) {
    const c = state.buffCfg[String(b.id)];
    if (!c || !c.on) continue;
    for (const e of buffEffects(b, c.lvl, c.side)) ib[e.type] = (ib[e.type] || 0) + e.val;
  }
  return ib;
}

function renderBuffs(): void {
  const box = $('dollBuffs');
  if (!box) return;
  if (!getBuffs()) {
    box.innerHTML = '<div class="muted" style="padding:6px 0">Завантаження…</div>';
    return;
  }
  const cells = shownBuffs().map((b) => {
    const c = state.buffCfg[String(b.id)];
    const on = !!(c && c.on);
    return (
      '<div class="doll-buff-slot">' +
      '<button type="button" class="doll-buff-ic' + (on ? ' on' : '') + '" data-buff="' + b.id + '">' +
      '<span class="doll-icon" style="' + buffIconStyle(b.an) + '"></span></button>' +
      '<input type="checkbox" class="doll-buff-cb" data-buffcb="' + b.id + '"' + (on ? ' checked' : '') + ' title="Активувати">' +
      '</div>'
    );
  });
  // Порожня клітинка — додати баф через пошук.
  cells.push('<div class="doll-buff-slot"><button type="button" class="doll-buff-ic empty" id="dollBuffAdd" title="Додати баф">+</button></div>');
  box.innerHTML = cells.join('');
}

function toggleBuffOn(id: number): void {
  buffCfgFor(id).on = !buffCfgFor(id).on;
  save();
  renderDoll();
}

// ----- Налаштування бафа (рівень / світл-темн / видалити) -----
let buffCfgTarget: number | null = null;
function openBuffCfg(id: number): void {
  buffCfgTarget = id;
  renderBuffCfg();
  const m = $('dollBuffCfg');
  if (m) m.hidden = false;
}
function closeBuffCfg(): void {
  const m = $('dollBuffCfg');
  if (m) m.hidden = true;
  buffCfgTarget = null;
}
function renderBuffCfg(): void {
  const body = $('dollBuffCfgBody');
  if (!body || buffCfgTarget == null) return;
  const b = getBuffById(buffCfgTarget);
  if (!b) return;
  const c = buffCfgFor(b.id);
  const max = buffMaxLevel(b);
  const hasSides = buffHasSides(b);
  const plainMax = hasSides ? Math.max(1, max - 1) : max; // макс. рівень без сторони
  // Нормалізація: сторона ⇒ макс. рівень; без сторони ⇒ не вище plainMax.
  if (hasSides && c.side) c.lvl = max;
  else if (c.lvl > plainMax) c.lvl = plainMax;
  // Значення параметра, масштабоване за рівнем/стороною (як ефекти).
  const P = (key: string): number | undefined =>
    b.lm[key] != null || b.qc[key] != null ? buffVal(b, key, c.lvl, c.side) : undefined;
  const row = (val: unknown, label: string) => '<div class="doll-bcfg-row"><b>' + escHtml(String(val)) + '</b><span>' + label + '</span></div>';
  const params: string[] = [];
  let v: number | undefined;
  if ((v = P('oj_for_fu')) != null) params.push(row(v, 'требуємий рівень'));
  if ((v = P('ve')) != null) params.push(row(v + ' м', 'дальність'));
  if ((v = P('mp')) != null) params.push(row(v, 'маг. енергія'));
  if ((v = P('channel')) != null) params.push(row(v + ' сек', 'час активації'));
  if ((v = P('vy')) != null) params.push(row(v + ' сек', 'призивання'));
  if ((v = P('vw')) != null) params.push(row(v + ' сек', 'перезарядка'));
  // Опис ефектів — ТІЛЬКИ для поточного рівня/сторони (як на рефі).
  // Рів. 1–10: одна версія. Макс. рів.: обрана сторона (світл/темн).
  const descLines = (arr: Array<{ type: string; val: number }>) =>
    arr.filter((e) => e.val).map((e) => '<div class="doll-bcfg-desc">' + escHtml(buffDesc(e.type, e.val)) + '</div>').join('');
  const curEffects = buffEffects(b, c.lvl, c.side);
  const sideTag = c.side === 'rs' ? '<span class="doll-bcfg-side-tag light">☀ світла</span>' : c.side === 'je' ? '<span class="doll-bcfg-side-tag dark">🌙 темна</span>' : '';
  const d = descLines(curEffects);
  const descHtml = d || sideTag ? '<div class="doll-bcfg-sep"></div>' + sideTag + (d || '<div class="doll-bcfg-desc muted">без ефекту</div>') : '';
  const sideName = c.side === 'je' ? ' · темн.' : c.side === 'rs' ? ' · світл.' : '';
  const dispName = buffDisplayName(b, c.side);
  const sideBtns = hasSides
    ? '<button type="button" class="doll-bcfg-side' + (c.side === 'rs' ? ' on' : '') + '" data-bside="rs">світл.</button>' +
      '<button type="button" class="doll-bcfg-side' + (c.side === 'je' ? ' on' : '') + '" data-bside="je">темн.</button>'
    : '';
  body.innerHTML =
    '<div class="doll-bcfg-head">' +
    '<span class="doll-icon doll-bcfg-ic" style="' + buffIconStyle(b.an) + '"></span>' +
    '<div class="doll-bcfg-name">' + escHtml(dispName) + '<span class="muted"> · ' + c.lvl + ' ур.' + sideName + '</span></div>' +
    '<button type="button" class="doll-bcfg-del" id="dollBuffDel">видалити</button>' +
    '</div>' +
    '<div class="doll-bcfg-stats">' + (params.join('') || '') + '</div>' +
    descHtml +
    '<div class="doll-bcfg-ctrl">' +
    '<button type="button" data-blvl="1">1 ур.</button>' +
    '<button type="button" data-blvl="-1">−1 ур.</button>' +
    '<button type="button" data-blvl="+1">+1 ур.</button>' +
    '<button type="button" data-blvl="10">10 ур.</button>' +
    sideBtns +
    '</div>';
}
function setBuffLvl(spec: string): void {
  if (buffCfgTarget == null) return;
  const b = getBuffById(buffCfgTarget);
  if (!b) return;
  const max = buffMaxLevel(b);
  const plainMax = buffHasSides(b) ? Math.max(1, max - 1) : max; // рівень-кнопки — лише плейн-діапазон
  const c = buffCfgFor(buffCfgTarget);
  if (c.side) {
    // Зараз обрано сторону (рів. макс). +1 — вже максимум; решта — у плейн-діапазон.
    if (spec === '+1') return;
    c.lvl = spec === '-1' ? plainMax : Math.max(1, Math.min(plainMax, Number(spec) || 1));
  } else {
    if (spec === '+1') c.lvl = Math.min(plainMax, c.lvl + 1);
    else if (spec === '-1') c.lvl = Math.max(1, c.lvl - 1);
    else c.lvl = Math.max(1, Math.min(plainMax, Number(spec) || 1));
  }
  c.side = ''; // рівень-кнопки завжди скидають сторону (плейн-версія)
  save();
  renderBuffCfg();
  renderDoll();
}
function setBuffSide(side: string): void {
  if (buffCfgTarget == null) return;
  const b = getBuffById(buffCfgTarget);
  if (!b || !buffHasSides(b)) return; // нема варіантів сторони — ігноруємо
  const c = buffCfgFor(buffCfgTarget);
  c.side = side;
  c.lvl = buffMaxLevel(b); // вибір світл/темн ⇒ макс. рівень (напр. 11)
  save();
  renderBuffCfg();
  renderDoll();
}
function deleteBuff(): void {
  if (buffCfgTarget == null) return;
  const k = String(buffCfgTarget);
  delete state.buffCfg[k];
  const i = state.extraBuffs.indexOf(buffCfgTarget);
  if (i >= 0) state.extraBuffs.splice(i, 1);
  save();
  closeBuffCfg();
  renderDoll();
}

// ----- Пошук бафа для додавання (фільтр за класом) -----
let buffPickClasses = new Set<number>();
function openBuffPick(): void {
  buffPickClasses = new Set([XZ[state.cls] || 1]);
  const m = $('dollBuffPick');
  if (m) m.hidden = false;
  renderBuffPickClasses();
  renderBuffPickList('');
  $<HTMLInputElement>('dollBuffPickSearch')?.focus();
}
function closeBuffPick(): void {
  const m = $('dollBuffPick');
  if (m) m.hidden = true;
}
function renderBuffPickClasses(): void {
  const box = $('dollBuffPickClasses');
  if (!box) return;
  box.innerHTML = Object.keys(CLASS_BY_SM)
    .map((sm) => {
      const n = Number(sm);
      return '<label><input type="checkbox" data-bclass="' + n + '"' + (buffPickClasses.has(n) ? ' checked' : '') + '> ' + escHtml(CLASS_BY_SM[n]) + '</label>';
    })
    .join('');
}
function renderBuffPickList(q: string): void {
  const list = $('dollBuffPickList');
  if (!list) return;
  const bd = getBuffs();
  if (!bd) return;
  const nameQ = q.trim().toLowerCase();
  const seen = new Set<number>();
  const rows: string[] = [];
  for (const sm of buffPickClasses) {
    for (const b of bd[String(sm)] || []) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      if (nameQ && !b.name.toLowerCase().includes(nameQ)) continue;
      rows.push(
        '<button type="button" class="doll-buffpick-row" data-addbuff="' + b.id + '">' +
        '<span class="doll-icon" style="' + buffIconStyle(b.an) + '"></span>' +
        '<span class="doll-buffpick-name">' + escHtml(b.name) + '<span class="muted"> · ' + escHtml(CLASS_BY_SM[sm]) + '</span></span></button>',
      );
    }
  }
  list.innerHTML = rows.join('') || '<div class="muted" style="padding:8px">Нічого не знайдено.</div>';
}
function addBuff(id: number): void {
  if (!state.extraBuffs.includes(id)) state.extraBuffs.push(id);
  buffCfgFor(id).on = true;
  save();
  closeBuffPick();
  renderDoll();
}

function renderSets(): void {
  const box = $('dollSets');
  if (!box) return;
  const sd = getSets();
  if (!sd) {
    box.innerHTML = '<div class="muted" style="padding:6px 0">Завантаження…</div>';
    return;
  }
  const psCount = setPieceCount(computeActiveSlots());
  const rows: string[] = [];
  for (const ps in psCount) {
    const set = sd[ps];
    const cnt = psCount[ps];
    if (!set || !set.zn || cnt < 2) continue;
    const bonuses = Object.keys(set.zn)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => {
        const b = set.zn[String(k)];
        return (
          '<span class="doll-set-bonus' + (k <= cnt ? ' on' : '') + '">' +
          k + ' дет.: ' + codeLabel(b.type) + ' +' + b.val + '</span>'
        );
      })
      .join('');
    rows.push(
      '<div class="doll-set-row"><div class="doll-set-name">' + escHtml(set.name) +
        ' <span class="muted">(' + cnt + '/' + set.pieces + ' дет.)</span></div>' +
        '<div class="doll-set-bonuses">' + bonuses + '</div></div>',
    );
  }
  box.innerHTML = rows.length
    ? rows.join('')
    : '<div class="muted" style="padding:6px 0">Надінь ≥2 деталі одного комплекту, щоб активувати бонуси.</div>';
}

function updateAvail(): void {
  const el = $('dollAvail');
  if (!el) return;
  const a = availPoints();
  el.textContent = String(a);
  el.classList.toggle('over', a < 0); // червоним, якщо перевищено бюджет
}

function resetAll(): void {
  state.equipped = {};
  state.gems = {};
  state.refine = {};
  state.addons = {};
  state.buffCfg = {};
  state.extraBuffs = [];
  state.backpack = [];
  state.str = ATTR_BASE;
  state.dex = ATTR_BASE;
  state.vit = ATTR_BASE;
  state.mag = ATTR_BASE;
  save();
  syncHeader();
  renderDoll();
}

// Дії редактора речі.
function edSetRefine(n: number): void {
  if (!editorTarget) return;
  const v = Math.max(0, Math.min(12, Math.floor(n) || 0));
  if (editorTarget.kind === 'slot') state.refine[editorTarget.slot] = v;
  else {
    const e = state.backpack[editorTarget.idx];
    if (e) e.refine = v;
  }
  save();
  renderDoll();
}
function edAddAddon(): void {
  edAddons().push({ type: ADDON_OPTIONS[0].code, val: 0 });
  save();
  renderEditor();
}
function edSetAddonType(i: number, type: string): void {
  const a = edAddons();
  if (a[i]) a[i].type = type;
  save();
  renderDoll();
}
function edSetAddonVal(i: number, val: number): void {
  const a = edAddons();
  if (a[i]) a[i].val = Number(val) || 0;
  save();
  renderDoll();
}
function edDelAddon(i: number): void {
  edAddons().splice(i, 1);
  save();
  renderEditor();
  renderDoll();
}

// ---------- Тултіп предмета ----------

function statLines(it: Item): string {
  const o = it as Record<string, unknown>;
  const out: string[] = [];
  // Зброя — діапазон «мін–макс», біжутерія/пояси/боєприпаси/томи — плоский бонус «+N».
  const range = (v: unknown) =>
    Array.isArray(v)
      ? Number(v[0]).toLocaleString('uk') + '–' + Number(v[1]).toLocaleString('uk')
      : '+' + Number(v).toLocaleString('uk');
  // тип (модель) + рівень
  const typeLbl = it.pg ? lbl('pg', it.pg) : '';
  if (typeLbl) out.push('<span class="doll-tip-type">' + escHtml(typeLbl) + '</span>');
  if (it.hf != null) out.push('Рівень ' + it.hf);
  // базові стати
  if (it.ld) out.push('Фіз. атака: ' + range(it.ld));
  if (it.xq) out.push('Маг. атака: ' + range(it.xq));
  if (it.sy) out.push('Атак/сек: ' + it.sy);
  if (typeof o.fp === 'number' && o.fp) out.push('Дальність: ' + o.fp + ' м');
  if (typeof it.wf === 'number' && it.wf) out.push('Фіз. захист +' + it.wf);
  const ab = it.ab_gq;
  if (typeof ab === 'number' && ab) out.push('Маг. захист +' + ab);
  else if (ab && typeof ab === 'object') {
    const e = ab as Record<string, number>;
    const vals = ELEM.map((k) => e[k] || 0);
    if (vals.every((v) => v === vals[0])) out.push('Захист від стихій +' + vals[0]);
    else for (const k of ELEM) if (e[k]) out.push(codeLabel(k) + ' +' + e[k]);
  }
  if (typeof it.hp === 'number' && it.hp) out.push('Здоровʼя +' + it.hp);
  if (typeof o.mana === 'number' && o.mana) out.push('Мана +' + o.mana);
  if (typeof it.qe === 'number' && it.qe) out.push('Ухилення +' + it.qe);
  // фіксовані допи (nw.wu)
  const nw = it.nw as { wu?: Array<{ type?: string; val?: unknown }> } | undefined;
  if (nw && Array.isArray(nw.wu)) for (const w of nw.wu) if (w && w.type) out.push(propLine(w.type, w.val));
  // абілка
  if (it.ac) out.push('<span class="doll-tip-abil">⚔ ' + escHtml(lbl('taAddons', it.ac as string)) + '</span>');

  // Вимоги (червоним — якщо не виконано).
  const req = meetsReq(it);
  const reqLine = (text: string, ok: boolean) => '<div' + (ok ? '' : ' class="doll-tip-bad"') + '>' + text + '</div>';
  const reqs: string[] = [];
  if (Number(it.oj)) reqs.push(reqLine('Требуємий рівень: ' + it.oj, req.lvl));
  if (Number(it.om_uo)) reqs.push(reqLine('Требуєма Сила: ' + it.om_uo, req.str));
  if (Number(it.uy_uo)) reqs.push(reqLine('Требуєма Спритність: ' + it.uy_uo, req.dex));
  if (Number(o.tx_uo)) reqs.push(reqLine('Требуємий Інтелект: ' + o.tx_uo, req.mag));

  // Комплект (сет).
  let setLine = '';
  if (o.ps != null) {
    const sd = getSets();
    const set = sd ? sd[String(o.ps)] : null;
    if (set) {
      const minK = Object.keys(set.zn).map(Number).sort((a, b) => a - b)[0];
      setLine = '<div class="doll-tip-set">' + escHtml(set.name) + (minK ? ' (' + minK + ')' : '') + '</div>';
    }
  }

  return (
    out.map((s) => '<div>' + s + '</div>').join('') +
    (reqs.length ? '<div class="doll-tip-sep"></div>' + reqs.join('') : '') +
    setLine
  );
}

function showTip(target: HTMLElement, it: Item, cat = ''): void {
  const tip = $('dollTip');
  if (!tip) return;
  const lvl = it.hf != null ? ' · ур. ' + it.hf : '';
  tip.innerHTML =
    '<div class="doll-tip-name">' + itemNameHtml(it, cat) + '<span class="muted">' + lvl + '</span></div>' +
    statLines(it);
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  const top = window.scrollY + r.bottom + 8;
  let left = window.scrollX + r.left;
  left = Math.min(left, window.scrollX + window.innerWidth - tip.offsetWidth - 12);
  tip.style.top = top + 'px';
  tip.style.left = Math.max(8, left) + 'px';
}
function hideTip(): void {
  const tip = $('dollTip');
  if (tip) tip.hidden = true;
}

function showBuffTip(target: HTMLElement, b: BuffDef): void {
  const tip = $('dollTip');
  if (!tip) return;
  const c = buffCfgFor(b.id);
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
  tip.innerHTML =
    '<div class="doll-tip-name">' + escHtml(b.name) + '</div>' +
    out.join('') +
    (desc ? '<div class="doll-tip-sep"></div><div>' + escHtml(desc) + '</div>' : '');
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  let left = window.scrollX + r.left;
  left = Math.min(left, window.scrollX + window.innerWidth - tip.offsetWidth - 12);
  tip.style.top = window.scrollY + r.bottom + 8 + 'px';
  tip.style.left = Math.max(8, left) + 'px';
}

// ---------- Браузер предметів (пікер) ----------

let pickerSlot: SlotDef | null = null;
let pickerItems: Item[] = [];
let pickerCat = '';
let pickerGem: { idx: number } | null = null; // режим вибору каменя (ціль — у редакторі)

/** Розбір грейду предмета з поля tv → {tier (колір gx-N), stars} — точно як у mypers (we). */
function itemGrade(it: Item, cat = ''): { tier: number; stars: number } {
  const tv = (it as Record<string, unknown>).tv;
  if (tv == null || tv === '') {
    // Книги без tv: 2☆ на рівнях 5–9, інакше 3☆ (mypers we, гілка qn).
    if (cat === 'qn') return { tier: 0, stars: Number(it.hf) >= 5 && Number(it.hf) <= 9 ? 2 : 3 };
    return { tier: 0, stars: 0 };
  }
  const c = String(tv).split('');
  let tier: number;
  let stars: number;
  if (c.length === 1) {
    tier = 0;
    stars = Number(c[0]);
  } else if (c.length === 3) {
    tier = Number(c[0] + c[1]);
    stars = Number(c[2]);
  } else {
    tier = Number(c[0]);
    stars = Number(c[1]);
  }
  if (stars === 2 && tier === 0) tier = 1;
  return { tier, stars };
}
/** Назва предмета з зірками й кольором грейду (як у mypers: ☆×stars + клас gx-tier). */
function itemNameHtml(it: Item, cat = ''): string {
  const { tier, stars } = itemGrade(it, cat);
  const st = stars > 0 ? '☆'.repeat(stars) + ' ' : '';
  return '<span class="gx-' + tier + '">' + st + escHtml(it.name) + '</span>';
}

/** Рівень для фільтра цифрами: вимога oj, а без неї (книги/збірники) — рівень предмета hf. */
function pickerReqLvl(it: Item): number {
  return Number(it.oj) || Number(it.hf) || 0;
}

function pickerRowHtml(it: Item, cat: string): string {
  let meta = '';
  if (!pickerGem) {
    const oj = Number(it.oj) || 0;
    if (oj) {
      const ok = state.level >= oj;
      meta = '<span class="doll-pick-req' + (ok ? '' : ' bad') + '">Треб. ур.: ' + oj + '</span>';
    } else if (Number(it.hf)) {
      meta = '<span class="doll-pick-req">Рівень ' + it.hf + '</span>';
    }
  }
  return (
    '<button type="button" class="doll-pick-row" data-id="' + it.id + '">' +
    '<span class="doll-cell sm"><span class="doll-icon" style="' + iconStyle(it, cat, state.gender) + '"></span></span>' +
    '<span class="doll-pick-name">' + itemNameHtml(it, cat) + meta + '</span>' +
    '</button>'
  );
}

/** Активні фільтри типу: 'bw' (інт) та/або 'gfax' (хеві/лайт). */
function activeArmorTypes(): Set<string> {
  const s = new Set<string>();
  document.querySelectorAll<HTMLInputElement>('input[name="dollPickType"]:checked').forEach((c) => {
    if (c.value) s.add(c.value);
  });
  return s;
}

function renderPickerList(q: string): void {
  const list = $('dollPickList');
  if (!list) return;
  // «80 назва» → тільки предмети з треб. рівнем рівно 80 (+ фільтр по імені).
  const m = q.trim().toLowerCase().match(/^(\d+)\s*(.*)$/);
  const lvlQ = m ? Number(m[1]) : null;
  const nameQ = m ? m[2].trim() : q.trim().toLowerCase();
  const types = pickerGem ? new Set<string>() : activeArmorTypes();
  // Дедуплікація: один запис на унікальний предмет (назва+іконка+рівень) —
  // прибирає дублі-варіанти (особливо польоти, де та сама модель дублюється по расах).
  const seen = new Set<string>();
  const rows = pickerItems.filter((it) => {
    if (lvlQ != null && pickerReqLvl(it) !== lvlQ) return false;
    if (nameQ && !it.name.toLowerCase().includes(nameQ)) return false;
    if (types.size && !types.has(it.ir as string)) return false;
    const o = it as Record<string, unknown>;
    // Включаємо tv (грейд) у ключ — щоб варіанти ★/★★/★★★ не злипались.
    const key = it.name + '|' + o.an + '|' + (it.oj ?? '') + '|' + (o.tv ?? '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  list.innerHTML =
    rows.slice(0, 400).map((it) => pickerRowHtml(it, pickerCat)).join('') ||
    '<div class="muted" style="padding:18px;text-align:center">Нічого не знайдено.</div>';
  const cnt = $('dollPickCount');
  if (cnt) cnt.textContent = 'Знайдено: ' + rows.length + (rows.length > 400 ? ' (показано 400)' : '');
}

async function openModal(title: string, cat: string, hasCurrent: boolean): Promise<void> {
  const modal = $('dollPicker');
  if (!modal) return;
  const tEl = $('dollPickTitle');
  const search = $<HTMLInputElement>('dollPickSearch');
  const unequip = $('dollPickUnequip');
  if (tEl) tEl.textContent = title;
  if (search) search.value = '';
  if (unequip) {
    unequip.hidden = !hasCurrent;
    unequip.textContent = pickerGem ? 'Прибрати камінь' : 'Зняти';
  }
  const bp = $('dollPickBackpack');
  if (bp) bp.hidden = !(hasCurrent && !pickerGem);
  modal.hidden = false;
  const list = $('dollPickList');
  if (list) list.innerHTML = '<div class="muted" style="padding:18px;text-align:center">Завантаження…</div>';
  pickerCat = cat;
  pickerItems = await loadCat(cat);
  // Чекбокси фільтра типу — з розрізнених `ir` категорії (зброя→типи, броня→хеві/лайт/інт,
  // кільця→металеве/дорогоцінне, політ→раси; книги тощо — без чекбоксів).
  const typesBox = $('dollPickTypes');
  if (typesBox) {
    const irs = pickerGem ? [] : [...new Set(pickerItems.map((it) => it.ir).filter((x): x is string => !!x))];
    if (irs.length > 1) {
      typesBox.innerHTML = irs
        .map((ir) => '<label><input type="checkbox" name="dollPickType" value="' + escHtml(ir) + '"> ' + escHtml(lbl('lbls', ir)) + '</label>')
        .join('');
      typesBox.hidden = false;
    } else {
      typesBox.innerHTML = '';
      typesBox.hidden = true;
    }
  }
  renderPickerList('');
  search?.focus();
}

async function openPicker(slotKey: string): Promise<void> {
  const slot = SLOTS.find((s) => s.slot === slotKey);
  if (!slot) return;
  pickerGem = null;
  pickerSlot = slot;
  await openModal(slot.label, slot.cat, !!state.equipped[slot.slot]);
}

/** Гем-пікер відкривається з редактора речі; пише в гнізда поточної цілі. */
async function openGemPicker(idx: number): Promise<void> {
  pickerGem = { idx };
  pickerSlot = null;
  await openModal('Камінь — гніздо ' + (idx + 1), 'ob', !!edGems()[idx]);
}

function closePicker(): void {
  const modal = $('dollPicker');
  if (modal) modal.hidden = true;
  pickerSlot = null;
  pickerGem = null;
}

function equip(id: number): void {
  const it = pickerItems.find((x) => Number(x.id) === id);
  if (!it) return;
  if (pickerGem) {
    edGems()[pickerGem.idx] = it;
    save();
    closePicker();
    renderEditor();
    renderDoll();
    return;
  }
  if (pickerSlot) {
    const slot = pickerSlot.slot;
    state.equipped[slot] = it;
    const n = defaultSockets(pickerSlot.cat);
    state.gems[slot] = n > 0 ? new Array(n).fill(null) : [];
    state.refine[slot] = 0;
    state.addons[slot] = [];
  }
  save();
  renderDoll();
  closePicker();
}

function unequip(): void {
  if (pickerGem) {
    edGems()[pickerGem.idx] = null;
    save();
    closePicker();
    renderEditor();
    renderDoll();
    return;
  }
  if (pickerSlot) {
    delete state.equipped[pickerSlot.slot];
    delete state.gems[pickerSlot.slot];
    delete state.refine[pickerSlot.slot];
    delete state.addons[pickerSlot.slot];
  }
  save();
  renderDoll();
  closePicker();
}

// ---------- Рюкзак ----------

const INV_COLS = 8;
const INV_ROWS = 5;
const INV_SIZE = INV_COLS * INV_ROWS;

function entryFromSlot(slot: string): BackpackEntry | null {
  const it = state.equipped[slot];
  if (!it) return null;
  const def = SLOTS.find((s) => s.slot === slot);
  return {
    item: it,
    slot,
    cat: def ? def.cat : slot,
    gems: state.gems[slot] || [],
    refine: state.refine[slot] || 0,
    addons: state.addons[slot] || [],
  };
}
function clearSlot(slot: string): void {
  delete state.equipped[slot];
  delete state.gems[slot];
  delete state.refine[slot];
  delete state.addons[slot];
}
function firstFreeCell(): number {
  for (let i = 0; i < INV_SIZE; i++) if (!state.backpack[i]) return i;
  return -1;
}

/** Зняти річ зі слота в рюкзак (cellIdx — конкретна комірка для drag; інакше перша вільна). */
function toBackpack(slot: string, cellIdx?: number): void {
  const e = entryFromSlot(slot);
  if (!e) return;
  const idx = cellIdx != null && !state.backpack[cellIdx] ? cellIdx : firstFreeCell();
  if (idx < 0) return; // рюкзак повний
  state.backpack[idx] = e;
  clearSlot(slot);
  save();
  renderDoll();
  closePicker();
}

/** Повернути річ із рюкзака на персонажа (у її слот). */
function fromBackpack(idx: number): void {
  const e = state.backpack[idx];
  if (!e) return;
  let slot = e.slot;
  if (state.equipped[slot]) {
    if (e.cat === 'oq') slot = slot === 'cr' ? 'cd' : 'cr';
    if (state.equipped[slot]) return; // місце зайняте
  }
  state.equipped[slot] = e.item;
  state.gems[slot] = e.gems;
  state.refine[slot] = e.refine;
  state.addons[slot] = e.addons || [];
  state.backpack[idx] = null;
  save();
  renderDoll();
}

/** Вдягнути річ із комірки рюкзака у конкретний слот (drag), якщо тип збігається. */
function equipFromBp(idx: number, targetSlot: string): void {
  const e = state.backpack[idx];
  if (!e) return;
  const def = SLOTS.find((s) => s.slot === targetSlot);
  if (!def || def.cat !== e.cat) return;
  const occ = state.equipped[targetSlot] ? entryFromSlot(targetSlot) : null;
  state.equipped[targetSlot] = e.item;
  state.gems[targetSlot] = e.gems;
  state.refine[targetSlot] = e.refine;
  state.addons[targetSlot] = e.addons || [];
  state.backpack[idx] = occ; // витіснена річ лягає в звільнену комірку
  save();
  renderDoll();
}

/** Перемістити/поміняти речі між комірками рюкзака (вільне перетягування). */
function moveCell(from: number, to: number): void {
  if (from === to) return;
  const tmp = state.backpack[to] || null;
  state.backpack[to] = state.backpack[from] || null;
  state.backpack[from] = tmp;
  save();
  renderDoll();
}

function renderBackpack(): void {
  const box = $('dollBackpack');
  if (!box) return;
  const cells: string[] = [];
  for (let i = 0; i < INV_SIZE; i++) {
    const e = state.backpack[i];
    if (e) {
      cells.push(
        '<button type="button" class="doll-bp-cell is-filled' + (meetsReq(e.item).ok ? '' : ' is-bad') +
          '" draggable="true" data-bp="' + i + '" title="' + escHtml(e.item.name) + '">' +
          '<span class="doll-cell"><span class="doll-icon" style="' + iconStyle(e.item, e.cat, state.gender) + '"></span></span></button>',
      );
    } else {
      cells.push('<span class="doll-bp-cell empty" data-bp="' + i + '"><span class="doll-cell"></span></span>');
    }
  }
  box.innerHTML = cells.join('');
}

// ---------- Хедер персонажа ----------

function fillSelect(el: HTMLSelectElement | null, dict: Record<string, string>, sel: string): void {
  if (!el) return;
  el.innerHTML = Object.entries(dict)
    .map(([k, v]) => '<option value="' + escHtml(k) + '"' + (k === sel ? ' selected' : '') + '>' + escHtml(v) + '</option>')
    .join('');
}

async function initHeader(): Promise<void> {
  const labels = await loadLabels();
  fillSelect($<HTMLSelectElement>('dollClass'), labels.ee, state.cls);

  const ATTRS = ['str', 'dex', 'vit', 'mag'];
  const bind = (id: string, key: keyof DollState, num = false) => {
    const el = $<HTMLInputElement | HTMLSelectElement>(id);
    if (!el) return;
    (el as HTMLInputElement).value = String(state[key]);
    el.addEventListener('change', () => {
      let v: string | number = num ? Number((el as HTMLInputElement).value) || 0 : el.value;
      if (num && ATTRS.includes(key as string)) {
        v = Math.max(ATTR_BASE, Number(v));
        (state as unknown as Record<string, unknown>)[key] = v;
        const over = -availPoints(); // перевищення бюджету
        if (over > 0) v = Math.max(ATTR_BASE, (v as number) - over);
      }
      (state as unknown as Record<string, unknown>)[key] = v;
      if (num) (el as HTMLInputElement).value = String(v);
      save();
      renderDoll(); // рівень/атрибути впливають на придатність речей і стати
    });
  };
  bind('dollClass', 'cls');
  bind('dollLevel', 'level', true);
  bind('dollStr', 'str', true);
  bind('dollDex', 'dex', true);
  bind('dollVit', 'vit', true);
  bind('dollMag', 'mag', true);

  // Стать — сегментований перемикач (radio).
  document.querySelectorAll<HTMLInputElement>('input[name="dollGender"]').forEach((r) => {
    r.checked = r.value === state.gender;
    r.addEventListener('change', () => {
      if (r.checked) {
        state.gender = r.value as 'm' | 'f';
        save();
        renderDoll();
      }
    });
  });
}

// ---------- Init ----------

export function dollInit(): void {
  const panel = document.querySelector('[data-panel="doll"]');
  if (!panel) return;
  document.documentElement.style.setProperty('--doll-cell-bg', "url('" + ASSET_BASE + "items/item-cells.png')");
  // Тултіп — у body: усередині панелі спозиційований предок зсуває absolute-координати
  // (showTip рахує їх від документа), і тултіп опинявся не біля курсора / за екраном.
  const tipEl = $('dollTip');
  if (tipEl && tipEl.parentElement !== document.body) document.body.appendChild(tipEl);
  load();
  void initHeader();
  renderDoll();
  void loadSets().then(() => renderDoll()); // підвантажити дані сетів і перерахувати
  void loadBuffs().then(() => renderDoll()); // підвантажити дані бафів
  void loadSkills().then(() => renderDoll()); // підвантажити дані скілів

  // Клік по слоту: порожній → вибір речі; зайнятий → редактор речі.
  const slotClick = (slotKey: string) => {
    if (state.equipped[slotKey]) openEditor({ kind: 'slot', slot: slotKey });
    else void openPicker(slotKey);
  };
  const grid = $('dollGrid');
  grid?.addEventListener('click', (e) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.doll-slot');
    if (slot?.dataset.slot) slotClick(slot.dataset.slot);
  });
  grid?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.doll-slot');
    if (slot?.dataset.slot) {
      e.preventDefault();
      slotClick(slot.dataset.slot);
    }
  });

  // Тултіп при наведенні на заповнений слот.
  grid?.addEventListener('mouseover', (e) => {
    if (dragSrc) return; // під час перетягування тултіп не показуємо
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.doll-slot.is-filled');
    if (slot?.dataset.slot) {
      const it = state.equipped[slot.dataset.slot];
      const cat = SLOTS.find((s) => s.slot === slot.dataset.slot)?.cat || '';
      if (it) showTip(slot, it, cat);
    }
  });
  grid?.addEventListener('mouseout', (e) => {
    if (!(e.target as HTMLElement).closest('.doll-slot.is-filled')) return;
    hideTip();
  });

  // Редактор речі: кліки (вкладки, гнізда, к-сть гнізд, дії, видалити доп).
  $('dollEditor')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'dollEditor' || target.closest('.doll-ed-close')) {
      closeEditor();
      return;
    }
    const tab = target.closest<HTMLElement>('.doll-ed-tab');
    if (tab?.dataset.tab) {
      editorTab = tab.dataset.tab as 'gems' | 'addons';
      renderEditor();
      return;
    }
    const sock = target.closest<HTMLElement>('.doll-socket');
    if (sock?.dataset.gidx != null) {
      void openGemPicker(Number(sock.dataset.gidx));
      return;
    }
    const del = target.closest<HTMLElement>('.doll-addon-del');
    if (del?.dataset.i != null) {
      edDelAddon(Number(del.dataset.i));
      return;
    }
    if (target.id === 'dollEdAddAddon') edAddAddon();
    else if (target.id === 'dollEdRemove' && editorTarget?.kind === 'slot') {
      const s = editorTarget.slot;
      delete state.equipped[s];
      delete state.gems[s];
      delete state.refine[s];
      delete state.addons[s];
      save();
      closeEditor();
      renderDoll();
    } else if (target.id === 'dollEdToBp' && editorTarget?.kind === 'slot') {
      toBackpack(editorTarget.slot);
      closeEditor();
    } else if (target.id === 'dollEdChange' && editorTarget?.kind === 'slot') {
      const s = editorTarget.slot;
      closeEditor();
      void openPicker(s);
    } else if (target.id === 'dollEdToChar' && editorTarget?.kind === 'bp') {
      fromBackpack(editorTarget.idx);
      closeEditor();
    } else if (target.id === 'dollEdDel' && editorTarget?.kind === 'bp') {
      state.backpack.splice(editorTarget.idx, 1);
      save();
      closeEditor();
      renderDoll();
    }
  });
  // Редактор: зміни (заточка, тип/значення допу).
  $('dollEditor')?.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'dollEdRefine') {
      edSetRefine(Number((target as HTMLInputElement).value));
      return;
    }
    const at = target.closest<HTMLSelectElement>('.doll-addon-type');
    if (at?.dataset.i != null) {
      edSetAddonType(Number(at.dataset.i), at.value);
      return;
    }
    const av = target.closest<HTMLInputElement>('.doll-addon-val');
    if (av?.dataset.i != null) edSetAddonVal(Number(av.dataset.i), Number(av.value));
  });
  // Зміна станів (бафів).
  $('dollBuffs')?.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#dollBuffAdd')) {
      openBuffPick();
      return;
    }
    const ic = t.closest<HTMLElement>('.doll-buff-ic[data-buff]');
    if (ic?.dataset.buff) openBuffCfg(Number(ic.dataset.buff));
  });
  $('dollBuffs')?.addEventListener('change', (e) => {
    const cb = (e.target as HTMLElement).closest<HTMLInputElement>('.doll-buff-cb');
    if (cb?.dataset.buffcb) toggleBuffOn(Number(cb.dataset.buffcb));
  });
  $('dollBuffs')?.addEventListener('mouseover', (e) => {
    const ic = (e.target as HTMLElement).closest<HTMLElement>('.doll-buff-ic[data-buff]');
    if (ic?.dataset.buff) {
      const b = getBuffById(Number(ic.dataset.buff));
      if (b) showBuffTip(ic, b);
    }
  });
  $('dollBuffs')?.addEventListener('mouseout', (e) => {
    if ((e.target as HTMLElement).closest('.doll-buff-ic')) hideTip();
  });

  // Налаштування бафа (рівень / світл-темн / видалити).
  $('dollBuffCfg')?.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'dollBuffCfg' || t.closest('.doll-bcfg-x')) {
      closeBuffCfg();
      return;
    }
    if (t.id === 'dollBuffDel') {
      deleteBuff();
      return;
    }
    const lvl = t.closest<HTMLElement>('[data-blvl]');
    if (lvl?.dataset.blvl) {
      setBuffLvl(lvl.dataset.blvl);
      return;
    }
    const side = t.closest<HTMLElement>('[data-bside]');
    if (side?.dataset.bside) setBuffSide(side.dataset.bside);
  });

  // Пошук бафа для додавання.
  $('dollBuffPick')?.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'dollBuffPick' || t.closest('.doll-buffpick-x')) {
      closeBuffPick();
      return;
    }
    const add = t.closest<HTMLElement>('[data-addbuff]');
    if (add?.dataset.addbuff) addBuff(Number(add.dataset.addbuff));
  });
  $('dollBuffPickClasses')?.addEventListener('change', (e) => {
    const cb = (e.target as HTMLElement).closest<HTMLInputElement>('[data-bclass]');
    if (cb?.dataset.bclass) {
      const n = Number(cb.dataset.bclass);
      if (cb.checked) buffPickClasses.add(n);
      else buffPickClasses.delete(n);
      renderBuffPickList($<HTMLInputElement>('dollBuffPickSearch')?.value || '');
    }
  });
  $('dollBuffPickSearch')?.addEventListener('input', (e) => renderBuffPickList((e.target as HTMLInputElement).value));

  // Історія: зберегти / завантажити / видалити.
  $('dollSaveBuild')?.addEventListener('click', () => {
    const inp = $<HTMLInputElement>('dollBuildName');
    saveBuild((inp?.value || '').trim());
    if (inp) inp.value = '';
  });
  $('dollHistory')?.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const load = t.closest<HTMLElement>('[data-load]');
    if (load?.dataset.load) {
      loadBuild(Number(load.dataset.load));
      return;
    }
    const del = t.closest<HTMLElement>('[data-del]');
    if (del?.dataset.del) deleteBuild(Number(del.dataset.del));
  });

  // Опонент (моб): редагування полів + перевірка дамага.
  const oppBox = $('dollOpp');
  const onOppChange = (e: Event) => {
    const el = (e.target as HTMLElement).closest<HTMLInputElement>('[data-opp]');
    if (!el?.dataset.opp) return;
    const key = el.dataset.opp as keyof OppMob;
    const o = getOpp();
    if (key === 'name') {
      o.name = el.value;
    } else {
      const v = parseFloat(el.value.replace(/[^\d.-]/g, '')) || 0;
      (o[key] as number) = v;
    }
    saveOpp(o);
    renderDmgLog();
  };
  oppBox?.addEventListener('input', onOppChange);
  oppBox?.addEventListener('change', () => renderOpponent());
  $('dollCheckDmg')?.addEventListener('click', toggleDmgCheck);
  $('dollResetOpp')?.addEventListener('click', () => {
    saveOpp({ ...DEFAULT_OPP });
    renderOpponent();
  });
  $('dollSkillGrid')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.doll-skill-ic[data-skill]');
    if (b?.dataset.skill) logSkillDamage(Number(b.dataset.skill));
  });
  $('dollClearLog')?.addEventListener('click', clearDmgLog);

  // Скинути все.
  $('dollReset')?.addEventListener('click', () => {
    if (window.confirm('Скинути все спорядження, камені, заточку, стани й атрибути?')) resetAll();
  });

  const pickerSearchVal = () => $<HTMLInputElement>('dollPickSearch')?.value ?? '';
  $('dollPickSearch')?.addEventListener('input', () => renderPickerList(pickerSearchVal()));
  $('dollPickTypes')?.addEventListener('change', () => renderPickerList(pickerSearchVal()));
  $('dollPickList')?.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.doll-pick-row');
    if (row?.dataset.id) equip(Number(row.dataset.id));
  });
  // Тултіп речі при наведенні в списку пошуку.
  $('dollPickList')?.addEventListener('mouseover', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.doll-pick-row');
    if (row?.dataset.id) {
      const it = pickerItems.find((x) => Number(x.id) === Number(row.dataset.id));
      if (it) showTip(row, it, pickerCat);
    }
  });
  $('dollPickList')?.addEventListener('mouseout', (e) => {
    if ((e.target as HTMLElement).closest('.doll-pick-row')) hideTip();
  });
  $('dollPickUnequip')?.addEventListener('click', unequip);
  $('dollPickBackpack')?.addEventListener('click', () => {
    if (pickerSlot && !pickerGem) toBackpack(pickerSlot.slot);
  });
  // Рюкзак: клік по речі — редактор (звідти «На персонажа» / камені / допи).
  $('dollBackpack')?.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.doll-bp-cell.is-filled');
    if (cell?.dataset.bp != null && state.backpack[Number(cell.dataset.bp)]) {
      openEditor({ kind: 'bp', idx: Number(cell.dataset.bp) });
    }
  });
  $('dollBackpack')?.addEventListener('mouseover', (e) => {
    if (dragSrc) return; // під час перетягування тултіп не показуємо
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.doll-bp-cell');
    if (cell?.dataset.bp != null) {
      const ent = state.backpack[Number(cell.dataset.bp)];
      if (ent) showTip(cell, ent.item, ent.cat);
    }
  });
  $('dollBackpack')?.addEventListener('mouseout', (e) => {
    if ((e.target as HTMLElement).closest('.doll-bp-cell')) hideTip();
  });

  // Drag-and-drop: персонаж ↔ інвентар (вільне розміщення по комірках).
  const startDrag = (e: DragEvent) => {
    hideTip(); // ховаємо тултіп на час перетягування
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'x'); // потрібно для Firefox
    }
  };
  const allowMove = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };
  // Категорія предмета, який зараз перетягують.
  let dragCat: string | undefined;
  const clearDrops = (): void => {
    document.querySelectorAll<HTMLElement>('.drop-ok').forEach((el) => el.classList.remove('drop-ok'));
  };
  // Підсвітити лише ту комірку, над якою курсор (якщо туди можна покласти).
  const markCell = (el: HTMLElement | null, ok: boolean): void => {
    clearDrops();
    if (el && ok) el.classList.add('drop-ok');
  };
  $('dollGrid')?.addEventListener('dragstart', (e) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.doll-slot.is-filled');
    if (slot?.dataset.slot) {
      dragSrc = { kind: 'slot', slot: slot.dataset.slot };
      dragCat = SLOTS.find((s) => s.slot === slot.dataset.slot)?.cat;
      startDrag(e as DragEvent);
    }
  });
  $('dollGrid')?.addEventListener('dragover', (e) => {
    if (dragSrc?.kind !== 'bp') return; // у слоти можна класти лише з рюкзака
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.doll-slot');
    const def = slot ? SLOTS.find((s) => s.slot === slot.dataset.slot) : undefined;
    const ok = !!def && def.cat === dragCat; // лише слот тієї ж категорії
    markCell(slot, ok);
    if (ok) allowMove(e as DragEvent);
  });
  $('dollGrid')?.addEventListener('drop', (e) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.doll-slot');
    if (dragSrc?.kind === 'bp' && slot?.dataset.slot) {
      e.preventDefault();
      equipFromBp(dragSrc.idx, slot.dataset.slot);
    }
    dragSrc = null;
    clearDrops();
  });
  $('dollBackpack')?.addEventListener('dragstart', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.doll-bp-cell.is-filled');
    if (cell?.dataset.bp != null) {
      const idx = Number(cell.dataset.bp);
      dragSrc = { kind: 'bp', idx };
      dragCat = state.backpack[idx]?.cat;
      startDrag(e as DragEvent);
    }
  });
  $('dollBackpack')?.addEventListener('dragover', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.doll-bp-cell');
    markCell(cell, !!cell); // у рюкзак можна класти будь-який предмет
    allowMove(e as DragEvent);
  });
  $('dollBackpack')?.addEventListener('drop', (e) => {
    e.preventDefault();
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.doll-bp-cell');
    const to = cell?.dataset.bp != null ? Number(cell.dataset.bp) : firstFreeCell();
    if (dragSrc?.kind === 'slot') toBackpack(dragSrc.slot, to);
    else if (dragSrc?.kind === 'bp') moveCell(dragSrc.idx, to);
    dragSrc = null;
    clearDrops();
  });
  document.addEventListener('dragend', clearDrops);
  $('dollPickClose')?.addEventListener('click', closePicker);
  $('dollPicker')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'dollPicker') closePicker();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('dollPicker')?.hidden) closePicker();
    else if (!$('dollEditor')?.hidden) closeEditor();
  });
}
