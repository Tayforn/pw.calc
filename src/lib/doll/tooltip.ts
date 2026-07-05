// =========================================================
// ЛЯЛЬКА — білдери HTML тултіпа речі (стати/вимоги/камені/заточка/сет/…).
// Винесено byte-у-байт з legacy index.ts; глобальний `state` → `build`,
// кеш `gearAttr` → параметр. Рядки HTML не змінені (йдуть у спільний тултіп).
// =========================================================

import { escHtml } from '../../utils/format';
import { lbl, ELEM, CLASS_BY_SM, getSets, SLOTS, type Item } from '../../modules/doll/data';
import {
  meetsReq,
  classRestriction,
  refineBonuses,
  gemDop,
  flattenItemStats,
  computeActiveSlots,
  setPieceCount,
} from './stats';
import type { DollState, TipCtx, BackpackEntry } from './types';

// Підписи кодів стат (для бонусів сетів).
export const CODE_LABEL: Record<string, string> = {
  hp: 'Здоровʼя', mp: 'Мана', om: 'Сила', lf: 'Тілобудова', uy: 'Спритність', tx: 'Інтелект',
  wf: 'Фіз. захист', ab_gq: 'Маг. захист', ld: 'Фіз. атака', xq: 'Маг. атака',
  ad: 'Рівень атаки', sx: 'Рівень захисту', ae: 'Міткість', qe: 'Ухилення', cl: 'Швидкість',
  ci: 'Час співу', mr: 'Бойовий дух', mk: 'Сила духу', ed: 'Шанс криту', wz: 'Захист від монстрів',
  su: 'Урон монстрам', bu: 'Зменш. фіз. урону', ia: 'Зменш. маг. урону', pec: 'Фіз. пробивання', kdn: 'Маг. пробивання',
  lw_eq: 'Захист: метал', mo_eq: 'Захист: дерево', dn_eq: 'Захист: вода', vt_eq: 'Захист: вогонь', sp_eq: 'Захист: земля',
  co: 'Макс. HP', cc: 'Макс. MP', cp: 'Міцність', exp: 'Досвід', jk: 'Шанс криту',
  ae_eg: 'Міткість', qe_eg: 'Ухилення', wf_eg: 'Фіз. захист', ab_gq_eg: 'Маг. захист', cl_eg: 'Швидкість',
  cx: 'Віднов. HP', mp_recovery: 'Віднов. MP', max_oi_av: 'Макс. фіз. атака', max_xq: 'Макс. маг. атака',
  bonus_hf: 'Бонус рівня', mana: 'Мана', sy: 'Атак/сек', fp: 'Дальність', xn: 'Пауза між атаками', vln: 'Бойовий дух',
  ct: 'Вимоги по талантах', // «Требование по талантам −N%» — display-only, як у mypers
  ld_min: 'Фіз. атака (мін)', ld_max: 'Фіз. атака (макс)', xq_min: 'Маг. атака (мін)', xq_max: 'Маг. атака (макс)',
};
export const codeLabel = (c: string): string => CODE_LABEL[c] || c;

// Коди-відсотки та коди зі знаком «−» (для відображення допів у тултіпі).
const PCT_CODES = new Set(['ed', 'bu', 'ia', 'exp', 'co', 'cc', 'cp', 'jk', 'ae_eg', 'qe_eg', 'wf_eg', 'ab_gq_eg', 'cl_eg', 'ct']);
const MINUS_CODES = new Set(['ci', 'ct', 'xn']);
export function propLine(code: string, val: unknown): string {
  let sign = MINUS_CODES.has(code) ? '−' : '+';
  let v: unknown = val;
  const n = Number(val);
  if (Number.isFinite(n) && n < 0) {
    // від'ємне значення обертає знак (напр. ct:-10 → «+10%»)
    sign = sign === '−' ? '+' : '−';
    v = Math.abs(n);
  }
  const suf = PCT_CODES.has(code) ? '%' : code === 'xn' ? ' сек' : '';
  return codeLabel(code) + ' ' + sign + v + suf;
}

/** Розбір грейду предмета з поля tv → {tier (колір gx-N), stars} — точно як у mypers (we). */
export function itemGrade(it: Item, cat = ''): { tier: number; stars: number } {
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
export function itemNameHtml(it: Item, cat = ''): string {
  const { tier, stars } = itemGrade(it, cat);
  const st = stars > 0 ? '☆'.repeat(stars) + ' ' : '';
  return '<span class="gx-' + tier + '">' + st + escHtml(it.name) + '</span>';
}

/** Рівень для фільтра цифрами: вимога oj, а без неї (книги/збірники) — рівень предмета hf. */
export function pickerReqLvl(it: Item): number {
  return Number(it.oj) || Number(it.hf) || 0;
}

/** Тіло тултіпа речі (стати/вимоги/камені/заточка/шліфовка/гравіювання/сет). */
export function statLines(build: DollState, it: Item, gearAttr: Record<string, number>, ctx?: TipCtx): string {
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
  if (o.cu != null && o.cu !== '') out.push('Звичайний політ: ' + escHtml(String(o.cu)));
  if (o.cwr != null && o.cwr !== '') out.push('Прискорений політ: ' + escHtml(String(o.cwr)));
  if (Array.isArray(o.ta_hf)) out.push('Рівень зброї: ' + o.ta_hf[0] + '–' + o.ta_hf[1]);
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
  // Камінь (ob): бонуси з obDops — [0] діє у зброї, [1] у броні/біжутерії.
  if (Array.isArray(o.obDops)) {
    const dops = o.obDops as unknown[];
    const d0 = Array.isArray(dops[0]) ? propLine(String(dops[0][0]), dops[0][1]) : '';
    const d1 = Array.isArray(dops[1]) ? propLine(String(dops[1][0]), dops[1][1]) : '';
    if (d0 && d0 === d1) out.push('<span class="doll-tip-add">' + d0 + '</span>');
    else {
      if (d0) out.push('<span class="doll-tip-add">У зброї: ' + d0 + '</span>');
      if (d1) out.push('<span class="doll-tip-add">В інших речах: ' + d1 + '</span>');
    }
  }

  // Вимоги (червоним — якщо не виконано); порядок як у mypers — після базових стат.
  const req = meetsReq(build, it, gearAttr);
  const reqLine = (text: string, ok: boolean) => '<div' + (ok ? '' : ' class="doll-tip-bad"') + '>' + text + '</div>';
  const reqs: string[] = [];
  if (Number(it.oj)) reqs.push(reqLine('Требуємий рівень: ' + it.oj, req.lvl));
  if (Number(it.om_uo)) reqs.push(reqLine('Требуєма Сила: ' + it.om_uo, req.str));
  if (Number(it.uy_uo)) reqs.push(reqLine('Требуєма Спритність: ' + it.uy_uo, req.dex));
  if (Number(o.tx_uo)) reqs.push(reqLine('Требуємий Інтелект: ' + o.tx_uo, req.mag));
  if (Number(o.reputa_uo)) reqs.push('<div>Требуєма репутація: ' + Number(o.reputa_uo).toLocaleString('uk') + '</div>');
  const cr = classRestriction(it);
  if (cr) reqs.push(reqLine('Клас: ' + cr.map((n) => CLASS_BY_SM[n] || n).join(', '), req.cls));

  // Фіксовані допи (nw.wu) — підсвічені, після вимог (як у mypers).
  const adds: string[] = [];
  const nw = it.nw as { wu?: Array<{ type?: string; val?: unknown }> } | undefined;
  if (nw && Array.isArray(nw.wu))
    for (const w of nw.wu) if (w && w.type) adds.push('<div class="doll-tip-add">' + propLine(w.type, w.val) + '</div>');
  // Додані вручну характеристики (вкладка «Характеристики» = addons): показуємо ті,
  // що йдуть ПОНАД базові стати речі (flattenItemStats: базові поля + nw.wu — вони вже
  // відмальовані вище). Тим самим кольором добавки (як у mypers), помимо захистів.
  if (ctx?.addons?.length) {
    const baseCounts = new Map<string, number>();
    for (const a of flattenItemStats(it)) baseCounts.set(a.type + '|' + a.val, (baseCounts.get(a.type + '|' + a.val) || 0) + 1);
    for (const a of ctx.addons) {
      if (!a || !a.type) continue;
      const k = a.type + '|' + a.val;
      const c = baseCounts.get(k) || 0;
      if (c > 0) baseCounts.set(k, c - 1); // це базова стата — вже показана
      else adds.push('<div class="doll-tip-add">' + propLine(a.type, a.val) + '</div>');
    }
  }
  // абілка
  if (it.ac) adds.push('<div class="doll-tip-abil">⚔ ' + escHtml(lbl('taAddons', it.ac as string)) + '</div>');
  // Заточка й камені надітої речі — стан конкретного екземпляра.
  if (ctx?.refine) {
    for (const b of refineBonuses(it, ctx.refine, !!ctx.isBook))
      adds.push('<div class="doll-tip-ref">Заточка +' + ctx.refine + ': ' + propLine(b.type, b.val) + '</div>');
  }
  if (ctx?.gems) {
    for (const g of ctx.gems) {
      if (!g) continue;
      const dop = gemDop(g, !!ctx.isWeapon);
      adds.push(
        '<div class="doll-tip-gem">◆ ' + escHtml(g.name) + (dop ? ' — ' + propLine(dop[0], dop[1]) : '') + '</div>',
      );
    }
  }

  // Шліфовка (руна) і кристал зброї: імʼя + стати з nw.wu.
  const specialLine = (sp: Item | null | undefined, ico: string, label: string) => {
    if (!sp) return;
    const wu = (sp.nw as { wu?: Array<{ type?: string; val?: unknown }> } | undefined)?.wu || [];
    const stats = wu.filter((w) => w && w.type).map((w) => propLine(String(w.type), w.val)).join(', ');
    adds.push('<div class="doll-tip-wdf">' + ico + ' ' + label + ': ' + escHtml(sp.name) + (stats ? ' — ' + stats : '') + '</div>');
  };
  specialLine(ctx?.wdf, '⛭', 'Шліфовка');
  specialLine(ctx?.crystal, '❖', 'Кристал');
  // Гравіювання — окремий блок (як «гравировка:» у mypers).
  if (ctx?.engrave?.length) {
    adds.push('<div class="doll-tip-sep"></div><div class="doll-tip-type">Гравіювання:</div>');
    for (const a of ctx.engrave) if (a && a.type) adds.push('<div class="doll-tip-eng">' + propLine(a.type, a.val) + '</div>');
  }

  // Комплект (сет): назва (маю/всього), список речей із наявністю, бонуси з підсвіткою активних.
  let setLine = '';
  if (o.ps != null) {
    const sd = getSets();
    const set = sd ? sd[String(o.ps)] : null;
    if (set) {
      const active = computeActiveSlots(build);
      const have = setPieceCount(build, active)[String(o.ps)] || 0;
      const total = set.pieces || set.xh?.length || 0;
      // Ключі надітих (активних) речей: категорія + id — для позначення наявних деталей.
      const worn = new Set<string>();
      for (const slot of active) {
        const eq = build.equipped[slot];
        const cat = SLOTS.find((s) => s.slot === slot)?.cat || '';
        if (eq) worn.add(cat + ':' + eq.id);
      }
      const pieces = (set.xh || [])
        .map((p) => {
          const has = worn.has(p.qo + ':' + p.id);
          return '<div class="doll-tip-setp' + (has ? ' on' : '') + '">' + (has ? '✓ ' : '· ') + escHtml(p.name) + '</div>';
        })
        .join('');
      const bonuses = Object.keys(set.zn)
        .map(Number)
        .sort((a, b) => a - b)
        .map((k) => {
          const b = set.zn[String(k)];
          const on = k <= have;
          return '<div class="doll-tip-setb' + (on ? ' on' : '') + '">' + k + ' дет.: ' + propLine(b.type, b.val) + '</div>';
        })
        .join('');
      setLine =
        '<div class="doll-tip-set">' + escHtml(set.name) + ' (' + have + '/' + total + ')</div>' + pieces + bonuses;
    }
  }

  return (
    out.map((s) => '<div>' + s + '</div>').join('') +
    reqs.join('') +
    adds.join('') +
    (setLine ? '<div class="doll-tip-sep"></div>' + setLine : '')
  );
}

/** Повний HTML тултіпа речі (назва з заточкою + рівень + statLines) — 1:1 з legacy showTip. */
export function itemTipHtml(build: DollState, it: Item, cat: string, gearAttr: Record<string, number>, ctx?: TipCtx): string {
  // Заточка «+10» — завжди в рядку назви (nbsp не дає їй відірватись від останнього
  // слова); рівень «ур. 16» — завжди окремим рядком під назвою.
  const refSuf = ctx?.refine ? '&nbsp;<span class="doll-tip-refn">+' + ctx.refine + '</span>' : '';
  const lvlLine = it.hf != null ? '<div class="doll-tip-lvl muted">ур. ' + it.hf + '</div>' : '';
  return (
    '<div class="doll-tip-name">' + itemNameHtml(it, cat) + refSuf + '</div>' + lvlLine + statLines(build, it, gearAttr, ctx)
  );
}

/** Контекст тултіпа для надітої речі слота. */
export function slotTipCtx(build: DollState, key: string): TipCtx {
  return {
    gems: build.gems[key],
    refine: build.refine[key] || 0,
    isBook: key === 'qn',
    isWeapon: key === 'ta',
    engrave: build.engrave[key],
    addons: build.addons[key],
    wdf: build.wdf[key],
    crystal: build.crystal[key],
  };
}

/** Контекст тултіпа для речі з рюкзака. */
export function bpTipCtx(ent: BackpackEntry): TipCtx {
  return {
    gems: ent.gems,
    refine: ent.refine || 0,
    isBook: ent.slot === 'qn',
    isWeapon: ent.slot === 'ta',
    engrave: ent.engrave,
    addons: ent.addons,
    wdf: ent.wdf,
    crystal: ent.crystal,
  };
}
