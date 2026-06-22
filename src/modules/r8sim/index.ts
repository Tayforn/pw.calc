// =========================================================
// СИМУЛЯТОР КРАФТА Р8
// =========================================================

import { $, $$ } from '../../utils/dom';
import { fmt, fmt2, escHtml } from '../../utils/format';

const R8S_HUNT_CAP = 5000000;

interface R8Char {
  name: string;
  value: string[];
  um: string;
  weight: number;
}
interface R8Item {
  name: string;
  static_char: string;
  chars: R8Char[];
}
interface R8Roll {
  name: string;
  value: string;
  um: string;
}

const r8sState: {
  cls: string | null;
  piece: string | null;
  item: R8Item | null;
  rolls: number;
  totalRolls: number;
  targets: string[];
  hits: Map<string, number>;
  lastRoll: R8Roll[] | null;
} = {
  cls: null,
  piece: null,
  item: null,
  rolls: 0,
  totalRolls: 0,
  targets: [],
  hits: new Map(),
  lastRoll: null,
};

function r8sData(): typeof R8_DATA | null {
  return window.R8_DATA || null;
}

/** Випадкове значення стата з діапазону [min,max] або [val]. */
function r8sRandValue(arr: string[]): string {
  if (!arr || arr.length === 0) return '0';
  if (arr.length === 1) return arr[0];
  const min = parseFloat(arr[0]);
  const max = parseFloat(arr[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return arr[0];
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/** k зважених виборів СТАТІВ з повтором (як у грі — 3 рядки). */
function r8sPickStats(chars: R8Char[], k: number): R8Roll[] {
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

/** Унікальні стати поточного предмета з сумарною вагою кожного. */
function r8sStatTotals(): { map: Map<string, { name: string; weight: number }>; total: number } {
  const map = new Map<string, { name: string; weight: number }>();
  let total = 0;
  if (r8sState.item) {
    for (const c of r8sState.item.chars) {
      total += c.weight;
      const cur = map.get(c.name);
      if (cur) cur.weight += c.weight;
      else map.set(c.name, { name: c.name, weight: c.weight });
    }
  }
  return { map, total };
}

/** Точна ймовірність, що кожен обраний стат трапиться серед 3 кидків. */
function r8sComboProb(targetNames: string[]): number {
  const { map, total } = r8sStatTotals();
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

function r8sPct(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '0%';
  const v = p * 100;
  if (v >= 1) return fmt2(v) + '%';
  return v
    .toFixed(v < 0.01 ? 4 : 3)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',') + '%';
}

function r8sRecordRoll(roll: R8Roll[]): void {
  r8sState.lastRoll = roll;
  r8sState.rolls++;
  r8sState.totalRolls++;
  for (const r of roll) {
    r8sState.hits.set(r.name, (r8sState.hits.get(r.name) || 0) + 1);
  }
}

function r8sRoll(times: number): void {
  if (!r8sState.item) return;
  for (let i = 0; i < times; i++) {
    r8sRecordRoll(r8sPickStats(r8sState.item.chars, 3));
  }
  r8sRenderResult();
  r8sRenderStats();
  r8sRenderCounter();
}

function r8sHunt(): void {
  const out = $('#r8sHuntResult');
  if (!out || !r8sState.item) return;
  const targets = [...r8sState.targets];
  if (targets.length === 0) {
    out.innerHTML = '<div class="banner">Спершу познач хоча б один стат для полювання.</div>';
    return;
  }
  const prob = r8sComboProb(targets);
  if (prob <= 0) {
    out.innerHTML = '<div class="banner">Такий збір неможливий для цього предмета.</div>';
    return;
  }

  const need = new Map<string, number>();
  for (const t of targets) need.set(t, (need.get(t) || 0) + 1);

  let rolls = 0;
  let hitRoll: R8Roll[] | null = null;
  let got = false;
  while (rolls < R8S_HUNT_CAP) {
    const roll = r8sPickStats(r8sState.item.chars, 3);
    rolls++;
    r8sState.rolls++;
    r8sState.totalRolls++;
    const cnt = new Map<string, number>();
    for (const r of roll) {
      cnt.set(r.name, (cnt.get(r.name) || 0) + 1);
      r8sState.hits.set(r.name, (r8sState.hits.get(r.name) || 0) + 1);
    }
    let all = true;
    for (const [nm, req] of need) {
      if ((cnt.get(nm) || 0) < req) {
        all = false;
        break;
      }
    }
    if (all) {
      got = true;
      hitRoll = roll;
      break;
    }
  }
  if (hitRoll) r8sState.lastRoll = hitRoll;

  r8sRenderResult();
  r8sRenderStats();
  r8sRenderCounter();

  const expected = prob > 0 ? 1 / prob : Infinity;
  if (!got) {
    out.innerHTML =
      '<div class="banner">За ' + fmt(rolls) +
      ' круток збір так і не випав (ліміт). Шанс надто малий: ' + r8sPct(prob) + '.</div>';
    return;
  }
  out.innerHTML =
    '<div class="banner info">Готово! Збір вибито за <b>' + fmt(rolls) + '</b> ' +
    (rolls === 1 ? 'крутку' : 'круток') + '.</div>' +
    '<div class="result-summary three-cols">' +
    '<div class="metric"><span class="metric-label">Круток знадобилось</span>' +
    '<span class="metric-value">' + fmt(rolls) + '</span></div>' +
    '<div class="metric"><span class="metric-label">Шанс зібрати за крутку</span>' +
    '<span class="metric-value">' + r8sPct(prob) + '</span>' +
    '<span class="metric-sub">збіг у будь-якому з 3 слотів</span></div>' +
    '<div class="metric"><span class="metric-label">Очікувано (середнє)</span>' +
    '<span class="metric-value">' + (Number.isFinite(expected) ? fmt2(expected) : '∞') + '</span></div>' +
    '</div>';
}

// --- Рендер ---
function r8sRenderClasses(): void {
  const wrap = $('#r8sClasses');
  const data = r8sData();
  if (!wrap || !data) return;
  const armLabel: Record<string, string> = { light: 'Легка', heavy: 'Важка', int: 'Маг.' };
  wrap.innerHTML = data.classes
    .map(
      (c) =>
        '<button type="button" class="r8s-chip r8s-class" data-cls="' + c.code + '" role="radio" aria-checked="false">' +
        '<span class="r8s-class-name">' + escHtml(c.ua) + '</span>' +
        '<span class="r8s-class-arm arm-' + c.arm + '">' + armLabel[c.arm] + '</span>' +
        '</button>',
    )
    .join('');
}

function r8sRenderPieces(): void {
  const wrap = $('#r8sPieces');
  const data = r8sData();
  if (!wrap || !data) return;
  wrap.innerHTML = data.pieces
    .map(
      (p) =>
        '<button type="button" class="r8s-chip r8s-piece" data-piece="' + p.code + '" role="radio" aria-checked="false">' +
        escHtml(p.ua) +
        '</button>',
    )
    .join('');
}

function r8sSyncActive(): void {
  $$<HTMLElement>('#r8sClasses .r8s-class').forEach((b) => {
    const on = b.dataset.cls === r8sState.cls;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
  $$<HTMLElement>('#r8sPieces .r8s-piece').forEach((b) => {
    const on = b.dataset.piece === r8sState.piece;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
}

function r8sLoadItem(): void {
  const data = r8sData();
  if (!data || !r8sState.cls || !r8sState.piece) {
    r8sState.item = null;
    return;
  }
  const byClass = data.items[r8sState.cls];
  r8sState.item = byClass ? byClass[r8sState.piece] || null : null;
  r8sState.rolls = 0;
  r8sState.targets = [];
  r8sState.hits = new Map();
  r8sState.lastRoll = null;
}

function r8sRenderItem(): void {
  const el = $('#r8sItem');
  if (!el) return;
  const it = r8sState.item;
  if (!it) {
    el.innerHTML = '';
    return;
  }
  const staticHtml = escHtml(it.static_char).replace(/\n/g, '<br/>');
  el.innerHTML =
    '<div class="r8s-item-name">' + escHtml(it.name) + '</div>' +
    '<div class="r8s-item-static">' + staticHtml + '</div>';
}

function r8sRenderResult(): void {
  const el = $('#r8sResult');
  if (!el) return;
  const roll = r8sState.lastRoll;
  if (!roll) {
    el.innerHTML = '<div class="hist-empty muted">Натисни «Крутити», щоб отримати 3 випадкові стати.</div>';
    return;
  }
  el.innerHTML =
    '<div class="r8s-roll-title">Випадкові бонуси:</div>' +
    roll
      .map((r) => {
        const on = r8sState.targets.includes(r.name);
        return (
          '<div class="r8s-roll-line' + (on ? ' is-target' : '') + '">' +
          '<span class="r8s-roll-stat">' + escHtml(r.name) + '</span>' +
          '<span class="r8s-roll-val">' + escHtml(String(r.value)) + (r.um ? ' ' + escHtml(r.um) : '') + '</span>' +
          '</div>'
        );
      })
      .join('');
}

function r8sRenderTargets(): void {
  const wrap = $('#r8sTargets');
  if (!wrap) return;
  if (!r8sState.item) {
    wrap.innerHTML = '';
    return;
  }
  const { map, total } = r8sStatTotals();
  const names = [...map.values()].sort((a, b) => b.weight - a.weight);
  const atMax = r8sState.targets.length >= 3;
  wrap.innerHTML = names
    .map((s) => {
      const count = r8sState.targets.filter((t) => t === s.name).length;
      const on = count > 0;
      const p = total ? s.weight / total : 0;
      const dis = atMax ? ' is-disabled' : '';
      const badge = count > 0 ? '<span class="r8s-target-count">×' + count + '</span>' : '';
      return (
        '<button type="button" class="r8s-target' + (on ? ' active' : '') + dis + '" data-name="' + escHtml(s.name) + '">' +
        '<span class="r8s-target-name">' + escHtml(s.name.replace(/\s*[+\-]\s*$/, '')) + '</span>' +
        '<span class="r8s-target-pct">' + r8sPct(p) + '</span>' +
        badge +
        '</button>'
      );
    })
    .join('');
  r8sRenderChosen();
}

function r8sRenderChosen(): void {
  const wrap = $('#r8sChosen');
  if (!wrap) return;
  if (!r8sState.targets.length) {
    wrap.innerHTML = '<span class="r8s-chosen-empty muted">Обрано 0 / 3 — натисни на стати вище.</span>';
    return;
  }
  wrap.innerHTML =
    r8sState.targets
      .map(
        (name, i) =>
          '<button type="button" class="r8s-slot" data-idx="' + i + '" title="Прибрати">' +
          '<span>' + escHtml(name.replace(/\s*[+\-]\s*$/, '')) + '</span>' +
          '<span class="r8s-slot-x">✕</span>' +
          '</button>',
      )
      .join('') + '<span class="r8s-chosen-empty muted">' + r8sState.targets.length + ' / 3</span>';
}

function r8sRenderCounter(): void {
  const c = $('#r8sCounter');
  if (c) c.textContent = 'Круток: ' + fmt(r8sState.rolls);
}

function r8sRenderStats(): void {
  const out = $('#r8sStats');
  if (!out) return;
  if (!r8sState.item) {
    out.innerHTML = '';
    return;
  }
  const rolls = r8sState.rolls;
  const summary =
    '<div class="result-summary three-cols">' +
    '<div class="metric"><span class="metric-label">Круток (цей предмет)</span>' +
    '<span class="metric-value">' + fmt(rolls) + '</span></div>' +
    '<div class="metric"><span class="metric-label">Круток за сесію</span>' +
    '<span class="metric-value">' + fmt(r8sState.totalRolls) + '</span></div>' +
    '<div class="metric"><span class="metric-label">Обрано цілей</span>' +
    '<span class="metric-value">' + fmt(r8sState.targets.length) + ' / 3</span></div>' +
    '</div>';

  let table = '';
  if (rolls > 0) {
    const { map, total } = r8sStatTotals();
    const slots = rolls * 3;
    const rows = [...map.values()]
      .map((s) => {
        const hits = r8sState.hits.get(s.name) || 0;
        const real = slots > 0 ? hits / slots : 0;
        const theo = total ? s.weight / total : 0;
        return { name: s.name, hits, real, theo };
      })
      .sort((a, b) => b.hits - a.hits);
    table =
      '<div class="table-wrap" style="margin-top:14px"><table class="data-table"><thead><tr>' +
      '<th>Стат</th><th class="num">Разів</th><th class="num">Факт. за слот</th><th class="num">Шанс за слот</th>' +
      '</tr></thead><tbody>' +
      rows
        .map(
          (r) =>
            '<tr><td>' + escHtml(r.name.replace(/\s*[+\-]\s*$/, '')) + '</td>' +
            '<td class="num">' + fmt(r.hits) + '</td>' +
            '<td class="num">' + r8sPct(r.real) + '</td>' +
            '<td class="num">' + r8sPct(r.theo) + '</td></tr>',
        )
        .join('') +
      '</tbody></table></div>';
  }
  out.innerHTML = summary + table;
}

function r8sRenderAll(): void {
  r8sSyncActive();
  const ready = !!r8sState.item;
  const body = $('#r8sBody') as HTMLElement | null;
  if (body) body.hidden = !ready;
  if (ready) {
    r8sRenderItem();
    r8sRenderResult();
    r8sRenderTargets();
    r8sRenderCounter();
    r8sRenderStats();
    const hr = $('#r8sHuntResult');
    if (hr) hr.innerHTML = '';
  }
}

export function r8sInit(): void {
  if (!$('#r8sClasses') || !r8sData()) return;
  r8sRenderClasses();
  r8sRenderPieces();

  $('#r8sClasses')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.r8s-class');
    if (!btn) return;
    r8sState.cls = btn.dataset.cls ?? null;
    r8sLoadItem();
    r8sRenderAll();
  });
  $('#r8sPieces')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.r8s-piece');
    if (!btn) return;
    r8sState.piece = btn.dataset.piece ?? null;
    r8sLoadItem();
    r8sRenderAll();
  });

  $('#r8sRoll')?.addEventListener('click', () => r8sRoll(1));

  const r8sOnTargetsChange = (): void => {
    r8sState.rolls = 0;
    r8sState.hits = new Map();
    r8sRenderTargets();
    r8sRenderResult();
    r8sRenderCounter();
    r8sRenderStats();
    const hr = $('#r8sHuntResult');
    if (hr) hr.innerHTML = '';
  };

  $('#r8sTargets')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.r8s-target');
    if (!btn) return;
    if (r8sState.targets.length >= 3) return;
    r8sState.targets.push(btn.dataset.name ?? '');
    r8sOnTargetsChange();
  });
  $('#r8sChosen')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.r8s-slot');
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    if (!Number.isInteger(idx)) return;
    r8sState.targets.splice(idx, 1);
    r8sOnTargetsChange();
  });
  $('#r8sClearTargets')?.addEventListener('click', () => {
    r8sState.targets = [];
    r8sOnTargetsChange();
  });
  $('#r8sHunt')?.addEventListener('click', r8sHunt);

  $('#r8sResetStats')?.addEventListener('click', () => {
    r8sState.rolls = 0;
    r8sState.totalRolls = 0;
    r8sState.hits = new Map();
    r8sState.lastRoll = null;
    r8sRenderResult();
    r8sRenderCounter();
    r8sRenderStats();
    const hr = $('#r8sHuntResult');
    if (hr) hr.innerHTML = '';
  });
}
