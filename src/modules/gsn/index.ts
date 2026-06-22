/* ===================== СИМУЛЯТОР ГСН (Хроно біжутерія) ===================== */

import { $, $$ } from '../../utils/dom';
import { fmt, fmt2, escHtml } from '../../utils/format';

const GSN_HUNT_CAP = 5000000;
const GSN_UNKNOWN = window.GSN_UNKNOWN || '__unknown__';
const GSN_UNKNOWN_LABEL = 'Невідомий параметр';

interface GsnChar {
  name: string;
  value: string;
  um?: string;
  weight: number;
}
interface GsnTier {
  code: string;
  ua: string;
  star: string;
  color: string;
  chance: number;
  counts: Array<[number, number]>;
}
interface GsnLast {
  tier: string;
  stats: GsnChar[];
}

const gsnState: {
  item: string | null;
  tierData: Record<string, { static_char: string; chars: GsnChar[] }> | null;
  rolls: number;
  tierCounts: Record<string, number>;
  last: GsnLast | null;
  huntTier: string;
  targets: string[];
} = {
  item: null,
  tierData: null,
  rolls: 0,
  tierCounts: { blue: 0, purple: 0, gold: 0 },
  last: null,
  huntTier: 'gold',
  targets: [],
};

function gsnData(): any {
  return window.GSN_DATA || null;
}
function gsnTier(code: string): GsnTier {
  return gsnData().tiers.find((t: GsnTier) => t.code === code);
}
function gsnIsUnknown(c: GsnChar): boolean {
  return c.name === GSN_UNKNOWN;
}
function gsnKey(c: GsnChar): string {
  return gsnIsUnknown(c) ? GSN_UNKNOWN : c.name + ' ' + c.value + (c.um || '');
}
function gsnDispName(c: GsnChar): string {
  return gsnIsUnknown(c) ? GSN_UNKNOWN_LABEL : c.name;
}
function gsnDispVal(c: GsnChar): string {
  return gsnIsUnknown(c) ? '?' : c.value + (c.um || '');
}

/** Зважений вибір k допів з повтором (як у грі). */
function gsnPickStats(chars: GsnChar[], k: number): GsnChar[] {
  const total = chars.reduce((s, c) => s + c.weight, 0);
  const out: GsnChar[] = [];
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
    out.push(pick);
  }
  return out;
}

/** Випадкова якість за офіційними шансами (сума = 1.0). */
function gsnPickTier(): string {
  const tiers = gsnData().tiers as GsnTier[];
  let r = Math.random();
  for (const t of tiers) {
    r -= t.chance;
    if (r < 0) return t.code;
  }
  return tiers[tiers.length - 1].code;
}

/** Випадкова кількість допів для якості за tiers[].counts. */
function gsnPickCount(tierCode: string): number {
  const t = gsnTier(tierCode);
  const tot = t.counts.reduce((s, c) => s + c[1], 0);
  let r = Math.random() * tot;
  for (const [n, w] of t.counts) {
    r -= w;
    if (r < 0) return n;
  }
  return t.counts[t.counts.length - 1][0];
}

function gsnCountLabel(t: GsnTier): string {
  const ns = t.counts.map((c) => c[0]);
  const min = Math.min(...ns);
  const max = Math.max(...ns);
  return (min === max ? String(min) : min + '–' + max) + ' допів';
}

/** Один повний крафт: якість → кількість → стати. */
function gsnDoCraft(): GsnLast {
  const tier = gsnPickTier();
  const count = gsnPickCount(tier);
  const td = gsnState.tierData![tier];
  const stats = gsnPickStats(td.chars, count);
  gsnState.rolls++;
  gsnState.tierCounts[tier] = (gsnState.tierCounts[tier] || 0) + 1;
  gsnState.last = { tier, stats };
  return gsnState.last;
}

// --- Ймовірності ---
function gsnSlotProb(td: { chars: GsnChar[] }, key: string): number {
  const total = td.chars.reduce((s, c) => s + c.weight, 0);
  let w = 0;
  for (const c of td.chars) if (gsnKey(c) === key) w += c.weight;
  return total ? w / total : 0;
}

function gsnStatsPresentProb(tierCode: string, targetKeys: string[]): number {
  if (targetKeys.length === 0) return 1;
  const td = gsnState.tierData![tierCode];
  const need = new Map<string, number>();
  for (const k of targetKeys) need.set(k, (need.get(k) || 0) + 1);
  const distinct = [...need.keys()];
  const m = distinct.length;
  const ps = distinct.map((k) => gsnSlotProb(td, k));
  if (ps.some((p) => p <= 0)) return 0;
  const reqs = distinct.map((k) => need.get(k) as number);
  const t = gsnTier(tierCode);
  const tot = t.counts.reduce((s, c) => s + c[1], 0);
  const cats = m + 1;
  const pcat = [Math.max(0, 1 - ps.reduce((s, p) => s + p, 0)), ...ps];
  let prob = 0;
  for (const [n, w] of t.counts) {
    const pc = w / tot;
    const total = Math.pow(cats, n);
    let acc = 0;
    for (let code = 0; code < total; code++) {
      let x = code;
      let pr = 1;
      const cnt = new Array<number>(m).fill(0);
      for (let s = 0; s < n; s++) {
        const cat = x % cats;
        x = Math.floor(x / cats);
        pr *= pcat[cat];
        if (cat > 0) cnt[cat - 1]++;
      }
      let ok = true;
      for (let i = 0; i < m; i++) {
        if (cnt[i] < reqs[i]) {
          ok = false;
          break;
        }
      }
      if (ok) acc += pr;
    }
    prob += pc * acc;
  }
  return Math.max(0, Math.min(1, prob));
}

function gsnHuntProb(tierCode: string, targetKeys: string[]): number {
  return gsnTier(tierCode).chance * gsnStatsPresentProb(tierCode, targetKeys);
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

// --- Дії ---
function gsnRoll(): void {
  if (!gsnState.tierData) return;
  gsnDoCraft();
  gsnRenderResult();
  gsnRenderCounter();
  gsnRenderStats();
}

function gsnHunt(): void {
  const out = $('#gsnHuntResult');
  if (!out || !gsnState.tierData) return;
  const tierCode = gsnState.huntTier;
  const targets = [...gsnState.targets];
  const prob = gsnHuntProb(tierCode, targets);
  if (prob <= 0) {
    out.innerHTML = '<div class="banner">Такий збір неможливий для цієї якості.</div>';
    return;
  }
  let rolls = 0;
  let got = false;
  while (rolls < GSN_HUNT_CAP) {
    const res = gsnDoCraft();
    rolls++;
    if (res.tier === tierCode) {
      const cnt = new Map<string, number>();
      for (const c of res.stats) {
        const k = gsnKey(c);
        cnt.set(k, (cnt.get(k) || 0) + 1);
      }
      const need = new Map<string, number>();
      for (const k of targets) need.set(k, (need.get(k) || 0) + 1);
      let all = true;
      for (const [k, req] of need) {
        if ((cnt.get(k) || 0) < req) {
          all = false;
          break;
        }
      }
      if (all) {
        got = true;
        break;
      }
    }
  }
  gsnRenderCounter();
  gsnRenderStats();

  const t = gsnTier(tierCode);
  const expected = prob > 0 ? 1 / prob : Infinity;
  if (!got) {
    gsnState.last = null;
    gsnRenderResult();
    out.innerHTML =
      '<div class="banner">Не пощастило 😔 За ' + fmt(rolls) +
      ' крафтів потрібний збір так і не випав (ліміт). Шанс надто малий: ' + r8sPct(prob) + '.</div>';
    return;
  }
  gsnRenderResult();
  out.innerHTML =
    '<div class="banner info">Готово! <b>' + escHtml(t.star + ' ' + t.ua) + '</b>' +
    (targets.length ? ' із потрібними статами' : '') + ' вибито за <b>' + fmt(rolls) + '</b> крафтів.</div>' +
    '<div class="result-summary three-cols">' +
    '<div class="metric"><span class="metric-label">Крафтів знадобилось</span>' +
    '<span class="metric-value">' + fmt(rolls) + '</span></div>' +
    '<div class="metric"><span class="metric-label">Шанс за крафт</span>' +
    '<span class="metric-value">' + r8sPct(prob) + '</span></div>' +
    '<div class="metric"><span class="metric-label">Очікувано (середнє)</span>' +
    '<span class="metric-value">' + (Number.isFinite(expected) ? fmt2(expected) : '∞') + '</span></div>' +
    '</div>';
}

// --- Рендер ---
function gsnRenderItems(): void {
  const wrap = $('#gsnItems');
  const data = gsnData();
  if (!wrap || !data) return;
  wrap.innerHTML = data.items
    .map(
      (i: any) =>
        '<button type="button" class="r8s-chip gsn-item" data-item="' + i.code + '" role="radio" aria-checked="false">' +
        '<span class="gsn-item-emoji">' + i.emoji + '</span>' +
        '<span>' + escHtml(i.ua) + '</span>' +
        '</button>',
    )
    .join('');
}

function gsnSyncItemActive(): void {
  $$<HTMLElement>('#gsnItems .gsn-item').forEach((b) => {
    const on = b.dataset.item === gsnState.item;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
}

function gsnLoadItem(code: string): void {
  gsnState.item = code;
  gsnState.tierData = gsnData().data[code] || null;
  gsnState.rolls = 0;
  gsnState.tierCounts = { blue: 0, purple: 0, gold: 0 };
  gsnState.last = null;
  gsnState.targets = [];
}

function gsnRenderOdds(): void {
  const el = $('#gsnOdds');
  if (!el) return;
  el.innerHTML = (gsnData().tiers as GsnTier[])
    .map(
      (t) =>
        '<div class="gsn-odd gsn-tier-' + t.color + '">' +
        '<span class="gsn-odd-star">' + escHtml(t.star) + '</span>' +
        '<span class="gsn-odd-name">' + escHtml(t.ua) + '</span>' +
        '<span class="gsn-odd-chance">' + r8sPct(t.chance) + '</span>' +
        '<span class="gsn-odd-cnt">' + escHtml(gsnCountLabel(t)) + '</span>' +
        '</div>',
    )
    .join('');
}

function gsnRenderItemInfo(): void {
  const el = $('#gsnItem');
  if (!el) return;
  const td = gsnState.tierData;
  if (!td) {
    el.innerHTML = '';
    return;
  }
  const item = gsnData().items.find((i: any) => i.code === gsnState.item);
  let html = '<div class="r8s-item-name">' + escHtml(item.emoji + ' ' + item.ua) + '</div>';
  for (const t of gsnData().tiers as GsnTier[]) {
    const d = td[t.code];
    html +=
      '<div class="gsn-tier-block gsn-tier-' + t.color + '">' +
      '<div class="gsn-tier-block-head">' + escHtml(t.star + ' ' + t.ua) +
      '<span class="gsn-tier-block-chance">' + r8sPct(t.chance) + '</span></div>' +
      '<div class="r8s-item-static">' + escHtml(d.static_char).replace(/\n/g, '<br/>') + '</div>' +
      '</div>';
  }
  el.innerHTML = html;
}

function gsnRenderResult(): void {
  const el = $('#gsnResult');
  if (!el) return;
  const last = gsnState.last;
  if (!last) {
    el.innerHTML = '<div class="hist-empty muted">Натисни «Крафтити», щоб скрафтити річ.</div>';
    return;
  }
  const t = gsnTier(last.tier);
  el.innerHTML =
    '<div class="gsn-result-tier gsn-tier-' + t.color + '">' + escHtml(t.star + ' ' + t.ua) +
    '<span class="gsn-result-cnt">· ' + last.stats.length + ' допів</span></div>' +
    last.stats
      .map((c) => {
        const on = gsnState.targets.includes(gsnKey(c));
        return (
          '<div class="r8s-roll-line' + (on ? ' is-target' : '') + '">' +
          '<span class="r8s-roll-stat">' + escHtml(gsnDispName(c)) + '</span>' +
          '<span class="r8s-roll-val">' + escHtml(gsnDispVal(c)) + '</span>' +
          '</div>'
        );
      })
      .join('');
}

function gsnRenderTierPick(): void {
  const el = $('#gsnTierPick');
  if (!el) return;
  el.innerHTML = (gsnData().tiers as GsnTier[])
    .map((t) => {
      const on = t.code === gsnState.huntTier;
      return (
        '<button type="button" class="gsn-tier-btn gsn-tier-' + t.color + (on ? ' active' : '') +
        '" data-tier="' + t.code + '" role="radio" aria-checked="' + on + '">' +
        '<span class="gsn-tier-btn-star">' + escHtml(t.star) + '</span>' +
        '<span>' + escHtml(t.ua) + '</span>' +
        '<span class="gsn-tier-btn-chance">' + r8sPct(t.chance) + '</span>' +
        '</button>'
      );
    })
    .join('');
}

function gsnRenderTargets(): void {
  const wrap = $('#gsnTargets');
  if (!wrap) return;
  if (!gsnState.tierData) {
    wrap.innerHTML = '';
    return;
  }
  const td = gsnState.tierData[gsnState.huntTier];
  const total = td.chars.reduce((s, c) => s + c.weight, 0);
  const atMax = gsnState.targets.length >= 3;
  wrap.innerHTML = td.chars
    .filter((c) => !gsnIsUnknown(c))
    .map((c) => {
      const key = gsnKey(c);
      const count = gsnState.targets.filter((t) => t === key).length;
      const on = count > 0;
      const p = total ? c.weight / total : 0;
      const dis = atMax ? ' is-disabled' : '';
      const badge = count > 0 ? '<span class="r8s-target-count">×' + count + '</span>' : '';
      return (
        '<button type="button" class="r8s-target' + (on ? ' active' : '') + dis + '" data-key="' + escHtml(key) + '">' +
        '<span class="r8s-target-name">' + escHtml(c.name + ' ' + gsnDispVal(c)) + '</span>' +
        '<span class="r8s-target-pct">' + r8sPct(p) + '</span>' +
        badge +
        '</button>'
      );
    })
    .join('');
  gsnRenderChosen();
}

function gsnRenderChosen(): void {
  const wrap = $('#gsnChosen');
  if (!wrap) return;
  if (!gsnState.targets.length) {
    wrap.innerHTML = '<span class="r8s-chosen-empty muted">Допи не обрано — полюємо лише на якість.</span>';
    return;
  }
  wrap.innerHTML =
    gsnState.targets
      .map(
        (key, i) =>
          '<button type="button" class="r8s-slot" data-idx="' + i + '" title="Прибрати">' +
          '<span>' + escHtml(key) + '</span>' +
          '<span class="r8s-slot-x">✕</span>' +
          '</button>',
      )
      .join('') + '<span class="r8s-chosen-empty muted">' + gsnState.targets.length + ' / 3</span>';
}

function gsnRenderCounter(): void {
  const c = $('#gsnCounter');
  if (c) c.textContent = 'Крафтів: ' + fmt(gsnState.rolls);
}

function gsnRenderStats(): void {
  const out = $('#gsnStats');
  if (!out) return;
  if (!gsnState.tierData) {
    out.innerHTML = '';
    return;
  }
  const total = gsnState.rolls;
  const head =
    '<div class="result-summary"><div class="metric">' +
    '<span class="metric-label">Усього крафтів</span>' +
    '<span class="metric-value">' + fmt(total) + '</span></div></div>';
  const cards = (gsnData().tiers as GsnTier[])
    .map((t) => {
      const c = gsnState.tierCounts[t.code] || 0;
      const pct = total ? c / total : 0;
      return (
        '<div class="metric"><span class="metric-label">' + escHtml(t.star + ' ' + t.ua) + '</span>' +
        '<span class="metric-value gsn-metric-' + t.color + '">' + fmt(c) + '</span>' +
        '<span class="metric-sub">' + (total ? r8sPct(pct) : '—') + ' · теор. ' + r8sPct(t.chance) + '</span></div>'
      );
    })
    .join('');
  out.innerHTML = head + '<div class="result-summary three-cols" style="margin-top:10px">' + cards + '</div>';
}

function gsnRenderAll(): void {
  gsnSyncItemActive();
  const ready = !!gsnState.tierData;
  const body = $('#gsnBody') as HTMLElement | null;
  if (body) body.hidden = !ready;
  if (ready) {
    gsnRenderOdds();
    gsnRenderItemInfo();
    gsnRenderResult();
    gsnRenderTierPick();
    gsnRenderTargets();
    gsnRenderCounter();
    gsnRenderStats();
    const hr = $('#gsnHuntResult');
    if (hr) hr.innerHTML = '';
  }
}

export function gsnInit(): void {
  if (!$('#gsnItems') || !gsnData()) return;
  gsnRenderItems();

  $('#gsnItems')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.gsn-item');
    if (!btn) return;
    gsnLoadItem(btn.dataset.item ?? '');
    gsnRenderAll();
  });

  $('#gsnRoll')?.addEventListener('click', gsnRoll);
  $('#gsnHunt')?.addEventListener('click', gsnHunt);

  const gsnOnHuntChange = (): void => {
    gsnRenderTargets();
    gsnRenderResult();
    const hr = $('#gsnHuntResult');
    if (hr) hr.innerHTML = '';
  };

  $('#gsnTierPick')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.gsn-tier-btn');
    if (!btn) return;
    gsnState.huntTier = btn.dataset.tier ?? 'gold';
    gsnState.targets = [];
    gsnRenderTierPick();
    gsnOnHuntChange();
  });

  $('#gsnTargets')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.r8s-target');
    if (!btn) return;
    if (gsnState.targets.length >= 3) return;
    gsnState.targets.push(btn.dataset.key ?? '');
    gsnOnHuntChange();
  });
  $('#gsnChosen')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.r8s-slot');
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    if (!Number.isInteger(idx)) return;
    gsnState.targets.splice(idx, 1);
    gsnOnHuntChange();
  });
  $('#gsnClearTargets')?.addEventListener('click', () => {
    gsnState.targets = [];
    gsnOnHuntChange();
  });

  $('#gsnResetStats')?.addEventListener('click', () => {
    gsnState.rolls = 0;
    gsnState.tierCounts = { blue: 0, purple: 0, gold: 0 };
    gsnState.last = null;
    gsnRenderResult();
    gsnRenderCounter();
    gsnRenderStats();
    const hr = $('#gsnHuntResult');
    if (hr) hr.innerHTML = '';
  });
}
