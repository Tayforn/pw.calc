// =========================================================
// СИМУЛЯТОР
// =========================================================

import type { ItemType, StoneMethod } from '../../types';
import { $, $$ } from '../../utils/dom';
import { fmt, fmt2, fmtGold } from '../../utils/format';
import { getSettings } from '../../settings';
import { RATES, STONE_META, buildPlan, miragesPerAttempt } from '../refine/data';

const SIM_DEFAULT_START = 0;
const SIM_DEFAULT_TARGET = 12;
const SIM_HISTORY_MAX = 200;
const SIM_SPEEDS: Record<string, { batch: number; delay: number }> = {
  slow: { batch: 1, delay: 200 },
  med: { batch: 1, delay: 16 },
  fast: { batch: 50, delay: 0 },
  turbo: { batch: 5000, delay: 0 },
};

interface SimAttemptRec {
  stone: StoneMethod;
  success: boolean;
  before: number;
  after: number;
}
interface SimHistRec extends SimAttemptRec {
  idx: number;
}
type ByStone = Record<StoneMethod, number>;

interface SimState {
  itemType: ItemType;
  start: number;
  target: number;
  currentLevel: number;
  bestLevel: number;
  selectedStone: StoneMethod | null;
  totalAttempts: number;
  mirages: number;
  stones: ByStone;
  successByStone: ByStone;
  failByStone: ByStone;
  lastAttempt: SimAttemptRec | null;
  history: SimHistRec[];
  running: boolean;
  rafId: number | null;
  timerId: ReturnType<typeof setTimeout> | null;
}

export const simState: SimState = {
  itemType: 'armor',
  start: SIM_DEFAULT_START,
  target: SIM_DEFAULT_TARGET,
  currentLevel: SIM_DEFAULT_START,
  bestLevel: SIM_DEFAULT_START,
  selectedStone: null,
  totalAttempts: 0,
  mirages: 0,
  stones: { mirage: 0, under: 0, sky: 0, world: 0 },
  successByStone: { mirage: 0, under: 0, sky: 0, world: 0 },
  failByStone: { mirage: 0, under: 0, sky: 0, world: 0 },
  lastAttempt: null,
  history: [],
  running: false,
  rafId: null,
  timerId: null,
};
let simHistoryRenderedAt = 0;

export function simStop(): void {
  simState.running = false;
  if (simState.rafId) cancelAnimationFrame(simState.rafId);
  if (simState.timerId) clearTimeout(simState.timerId);
  simState.rafId = null;
  simState.timerId = null;
}

function simResetCounters(): void {
  simState.currentLevel = simState.start;
  simState.bestLevel = simState.start;
  simState.totalAttempts = 0;
  simState.mirages = 0;
  simState.stones = { mirage: 0, under: 0, sky: 0, world: 0 };
  simState.successByStone = { mirage: 0, under: 0, sky: 0, world: 0 };
  simState.failByStone = { mirage: 0, under: 0, sky: 0, world: 0 };
  simState.lastAttempt = null;
  simState.history = [];
  simHistoryRenderedAt = 0;
}

export function simReset(): void {
  simStop();
  simResetCounters();
  simRender();
}

/** Виконує одну спробу заточки і оновлює стан. Повертає true, якщо спроба
 *  була зроблена. */
export function simAttempt(stone: StoneMethod): boolean {
  const nextLv = simState.currentLevel + 1;
  if (nextLv > 12) return false;
  const p = RATES[stone] && RATES[stone][nextLv];
  if (!p || p <= 0) return false;

  simState.totalAttempts++;
  simState.mirages += miragesPerAttempt(simState.itemType);
  simState.stones[stone]++;

  const success = Math.random() < p;
  const beforeLv = simState.currentLevel;
  if (success) {
    simState.currentLevel = nextLv;
    simState.successByStone[stone]++;
  } else {
    simState.failByStone[stone]++;
    if (stone === 'world') {
      // рівень зберігається
    } else if (stone === 'under') {
      simState.currentLevel = Math.max(0, simState.currentLevel - 1);
    } else {
      simState.currentLevel = 0; // mirage / sky → +0
    }
  }
  if (simState.currentLevel > simState.bestLevel) {
    simState.bestLevel = simState.currentLevel;
  }
  simState.lastAttempt = { stone, success, before: beforeLv, after: simState.currentLevel };
  simState.history.push({
    idx: simState.totalAttempts,
    stone,
    success,
    before: beforeLv,
    after: simState.currentLevel,
  });
  if (simState.history.length > SIM_HISTORY_MAX * 2) {
    simState.history.splice(0, simState.history.length - SIM_HISTORY_MAX);
  }
  return true;
}

export function simRunAuto(mode: 'optimal' | 'selected'): void {
  if (simState.running) return;
  if (simState.currentLevel >= simState.target) {
    simRender();
    return;
  }

  let attemptFn: () => boolean;
  if (mode === 'optimal') {
    const { plan } = buildPlan(simState.itemType, 'auto', getSettings());
    attemptFn = () => {
      const lv = simState.currentLevel + 1;
      if (lv > 12) return false;
      const m = plan[lv - 1] && plan[lv - 1].method;
      if (!m) return false;
      return simAttempt(m);
    };
  } else {
    if (!simState.selectedStone) {
      simState.selectedStone = 'mirage';
    }
    attemptFn = () => simAttempt(simState.selectedStone as StoneMethod);
  }

  simState.running = true;
  simRender();

  function step(): void {
    if (!simState.running) return;
    const speedEl = $<HTMLSelectElement>('#simSpeed');
    const speed = SIM_SPEEDS[speedEl?.value ?? 'med'] || SIM_SPEEDS.med;

    for (let i = 0; i < speed.batch; i++) {
      if (!simState.running) break;
      if (simState.currentLevel >= simState.target) break;
      if (!attemptFn()) break;
    }

    simRender();

    if (simState.currentLevel >= simState.target) {
      simStop();
      simRender();
      return;
    }
    if (!simState.running) return;

    if (speed.delay > 0) {
      simState.timerId = setTimeout(step, speed.delay);
    } else {
      simState.rafId = requestAnimationFrame(step);
    }
  }

  step();
}

export function simRender(): void {
  if (!document.getElementById('simCurrentLevel')) return; // panel ще не зібраний
  const settings = getSettings();
  const cur = simState.currentLevel;
  const target = simState.target;

  ($('#simCurrentLevel') as HTMLElement).textContent = '+' + cur;
  ($('#simTargetDisplay') as HTMLElement).textContent =
    'Ціль: +' + target + (cur >= target ? '  ✓' : '');

  const progress = target > 0 ? Math.max(0, Math.min(100, (cur / target) * 100)) : 100;
  ($('#simProgressBar') as HTMLElement).style.width = progress + '%';

  const nextLv = cur + 1;
  const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
  const mirPerAtt = miragesPerAttempt(simState.itemType);
  const mirageGoldPerAtt = (mirPerAtt * settings.miragePrice) / settings.goldPrice;
  for (const stone of ['mirage', 'under', 'sky', 'world'] as StoneMethod[]) {
    const el = document.getElementById('rate' + cap(stone));
    if (el) {
      if (nextLv > 12) {
        el.textContent = '—';
      } else {
        const p = RATES[stone][nextLv];
        el.textContent = p ? (p * 100).toFixed(2) + '%' : '—';
      }
    }
    const priceEl = document.getElementById('price' + cap(stone));
    if (priceEl) {
      if (stone === 'mirage') {
        priceEl.textContent = fmt2(mirageGoldPerAtt) + ' г / спробу';
      } else {
        const priceKey = STONE_META[stone].priceKey;
        const stonePrice = priceKey ? settings[priceKey] : 0;
        priceEl.textContent = fmt2(stonePrice) + ' г / шт';
      }
    }
  }

  $$<HTMLButtonElement>('.stone-btn').forEach((b) => {
    const sel = b.dataset.stone === simState.selectedStone;
    b.classList.toggle('selected', sel);
    b.setAttribute('aria-checked', String(sel));
    b.disabled = simState.running;
  });
  ($('#simStep') as HTMLButtonElement).disabled =
    simState.running || cur >= 12 || !simState.selectedStone;
  ($('#simRunSelected') as HTMLButtonElement).disabled = simState.running || cur >= target;
  ($('#simRunOptimal') as HTMLButtonElement).disabled = simState.running || cur >= target;
  ($('#simStop') as HTMLButtonElement).disabled = !simState.running;

  const last = simState.lastAttempt;
  const lastEl = $('#simLastResult') as HTMLElement;
  const runIndicator = simState.running ? ' <span class="sim-running">⟳ симулюємо…</span>' : '';
  if (!last) {
    const base =
      simState.totalAttempts === 0
        ? 'Натисни на камінець, щоб зробити спробу, або запусти авто-симуляцію.'
        : 'Спроб усього: ' + fmt(simState.totalAttempts);
    lastEl.innerHTML = base + runIndicator;
  } else {
    const meta = STONE_META[last.stone];
    const arrow = last.success
      ? '<span class="succ">✓ успіх</span> · +' + last.before + ' → +' + last.after
      : '<span class="fail">✗ провал</span> · +' + last.before + ' → +' + last.after;
    lastEl.innerHTML =
      'Останнє: <span class="badge ' + meta.cls + '">' + meta.label + '</span> ' + arrow + runIndicator;
  }

  const bestEl = $('#simBestResult') as HTMLElement | null;
  if (bestEl) {
    if (simState.bestLevel > cur) {
      bestEl.hidden = false;
      bestEl.innerHTML =
        '<span class="sim-best-text">Найкращий рівень, який ви могли мати… але збили:</span> ' +
        '<span class="sim-best-value">+' + simState.bestLevel + '</span>';
    } else {
      bestEl.hidden = true;
    }
  }

  simRenderHistory();
  simRenderStats();
}

export function simRenderHistory(): void {
  const out = $('#simHistory');
  const cnt = $('#simHistoryCount');
  if (!out) return;

  if (simState.running) {
    const now = performance.now();
    if (now - simHistoryRenderedAt < 100) return;
    simHistoryRenderedAt = now;
  }

  if (simState.history.length === 0 && simState.totalAttempts === 0) {
    out.innerHTML =
      '<div class="hist-empty muted">Поки що порожньо. Натисни на камінець або запусти авто-симуляцію.</div>';
    if (cnt) cnt.textContent = '0 спроб';
    return;
  }

  const visible = simState.history.slice(-SIM_HISTORY_MAX);
  if (cnt) {
    cnt.textContent =
      simState.totalAttempts > visible.length
        ? 'останні ' + fmt(visible.length) + ' з ' + fmt(simState.totalAttempts) + ' спроб'
        : fmt(simState.totalAttempts) + ' спроб';
  }

  const rows = new Array<string>(visible.length);
  for (let i = visible.length - 1, j = 0; i >= 0; i--, j++) {
    const h = visible[i];
    const meta = STONE_META[h.stone];
    const cls = h.success ? 'succ' : 'fail';
    const mark = h.success ? '✓' : '✗';
    rows[j] =
      '<div class="hist-row ' + cls + '">' +
      '<span class="hist-idx">#' + fmt(h.idx) + '</span>' +
      '<span class="badge ' + meta.cls + '">' + meta.label + '</span>' +
      '<span class="hist-mid">+' + h.before + ' → +' + h.after + '</span>' +
      '<span class="hist-mark ' + cls + '">' + mark + '</span>' +
      '</div>';
  }
  out.innerHTML = rows.join('');
}

export function simRenderStats(): void {
  const out = $('#simResult');
  if (!out) return;
  if (simState.totalAttempts === 0) {
    out.innerHTML = '';
    return;
  }
  const settings = getSettings();

  const mirPerAtt = miragesPerAttempt(simState.itemType);
  const mirageCoinsTotal = simState.mirages * settings.miragePrice;
  const stoneCoins =
    simState.stones.under * settings.underPrice * settings.goldPrice +
    simState.stones.sky * settings.skyPrice * settings.goldPrice +
    simState.stones.world * settings.worldPrice * settings.goldPrice;
  const totalCost = mirageCoinsTotal + stoneCoins;
  const reachedTarget = simState.currentLevel >= simState.target;
  const stonesUsed = simState.stones.under + simState.stones.sky + simState.stones.world;

  const stoneRows = (['mirage', 'under', 'sky', 'world'] as StoneMethod[])
    .filter((s) => simState.stones[s] > 0)
    .map((s) => {
      const meta = STONE_META[s];
      const total = simState.stones[s];
      const succ = simState.successByStone[s];
      const fail = simState.failByStone[s];
      const realPct = total > 0 ? ((succ / total) * 100).toFixed(2) : '0.00';
      const mirShare = total * mirPerAtt * settings.miragePrice;
      const priceKey = STONE_META[s].priceKey;
      const stoneShare = s === 'mirage' || !priceKey ? 0 : total * settings[priceKey] * settings.goldPrice;
      const cost = mirShare + stoneShare;
      return (
        '<tr>' +
        '<td><span class="badge ' + meta.cls + '">' + meta.label + '</span></td>' +
        '<td class="num">' + fmt(total) + '</td>' +
        '<td class="num">' + fmt(succ) + '</td>' +
        '<td class="num">' + fmt(fail) + '</td>' +
        '<td class="num">' + realPct + '%</td>' +
        '<td class="num">' + fmt(cost) +
        '<div class="sub">' + fmtGold(cost, settings.goldPrice) + '</div>' +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  let comparison = '';
  if (reachedTarget) {
    try {
      const { cumCost } = buildPlan(simState.itemType, 'auto', settings);
      const expectedCost = cumCost[simState.target] - cumCost[simState.start];
      const diff = totalCost - expectedCost;
      const diffPct = expectedCost > 0 ? (diff / expectedCost) * 100 : 0;
      const sign = diff > 0 ? '+' : '';
      const color = diff < 0 ? 'var(--good)' : diff > 0 ? 'var(--bad)' : 'inherit';
      comparison =
        '<div class="banner info" style="margin-top:14px">' +
        'Очікувана вартість (оптимальний план): <b>' + fmt(expectedCost) + '</b> монет · ' +
        '<b>' + fmtGold(expectedCost, settings.goldPrice) + '</b>. ' +
        'Різниця з фактом: <b style="color:' + color + '">' + sign + fmt(diff) +
        ' монет (' + sign + diffPct.toFixed(1) + '%)</b>.' +
        '</div>';
    } catch (e) {
      /* ігноруємо помилку */
    }
  }

  const stoppedNote = simState.running
    ? ''
    : reachedTarget
      ? '<div class="banner" style="background:rgba(53,224,161,0.08);border-color:rgba(53,224,161,0.35);color:#9bf3d3">' +
        '<b>✓ Ціль досягнута!</b> Підсумок симуляції нижче.' +
        '</div>'
      : '<div class="banner">Симуляція зупинена. Підсумок поточного прогону нижче.</div>';

  out.innerHTML =
    stoppedNote +
    '<div class="result-summary">' +
    '<div class="metric ' + (reachedTarget ? 'good' : 'accent') + '">' +
    '<span class="metric-label">' + (reachedTarget ? 'Ціль досягнута' : 'Поточний рівень') + '</span>' +
    '<span class="metric-value">+' + simState.currentLevel + '</span>' +
    '<span class="metric-sub">' +
    (reachedTarget ? 'старт +' + simState.start + ' → +' + simState.target : 'ціль +' + simState.target) +
    '</span>' +
    '</div>' +
    '<div class="metric">' +
    '<span class="metric-label">Загальна вартість</span>' +
    '<span class="metric-value">' + fmt(totalCost) + '</span>' +
    '<span class="metric-sub">' + fmtGold(totalCost, settings.goldPrice) + '</span>' +
    '</div>' +
    '<div class="metric">' +
    '<span class="metric-label">Спроб</span>' +
    '<span class="metric-value">' + fmt(simState.totalAttempts) + '</span>' +
    '<span class="metric-sub">міражів: ' + fmt(simState.mirages) + '</span>' +
    '</div>' +
    '<div class="metric">' +
    '<span class="metric-label">Камінців</span>' +
    '<span class="metric-value">' + fmt(stonesUsed) + '</span>' +
    '<span class="metric-sub">під: ' + fmt(simState.stones.under) +
    ' · неб: ' + fmt(simState.stones.sky) +
    ' · світ: ' + fmt(simState.stones.world) + '</span>' +
    '</div>' +
    '</div>' +
    (stoneRows
      ? '<div class="table-wrap">' +
        '<table class="data-table">' +
        '<thead><tr>' +
        '<th>Камінь</th>' +
        '<th class="num">Спроб</th>' +
        '<th class="num">Успіх</th>' +
        '<th class="num">Провал</th>' +
        '<th class="num">Факт. %<br><small>з симуляції</small></th>' +
        '<th class="num">Вартість</th>' +
        '</tr></thead>' +
        '<tbody>' + stoneRows + '</tbody>' +
        '</table>' +
        '</div>' +
        '<p class="muted" style="margin-top:10px;font-size:12.5px">' +
        '<b>Факт. %</b> — спостережений % успіху саме в цій симуляції ' +
        '(успіхи ÷ спроби, об\'єднано по всіх рівнях, де використовувався ' +
        'цей камінь). На малій вибірці він <b>не зобов\'язаний</b> ' +
        'збігатися з табличним шансом для конкретного рівня з вкладки ' +
        '«Заточка» (напр. світобудови на +10 = 0.07%, але в прогоні з ' +
        '1 успіх / 1616 спроб реальний результат ≈ 0.06%).' +
        '</p>'
      : '') +
    comparison;
}

export function simInit(): void {
  const startSel = $<HTMLSelectElement>('#simStart');
  const targetSel = $<HTMLSelectElement>('#simTarget');
  if (!startSel || !targetSel) return;

  for (let i = 0; i <= 11; i++) {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = '+' + i;
    if (i === SIM_DEFAULT_START) o.selected = true;
    startSel.appendChild(o);
  }
  for (let i = 1; i <= 12; i++) {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = '+' + i;
    if (i === SIM_DEFAULT_TARGET) o.selected = true;
    targetSel.appendChild(o);
  }

  $$<HTMLInputElement>('input[name="simType"]').forEach((r) => {
    r.addEventListener('change', () => {
      const checked = $<HTMLInputElement>('input[name="simType"]:checked');
      simState.itemType = (checked?.value ?? 'armor') as ItemType;
      simReset();
    });
  });
  startSel.addEventListener('change', () => {
    const v = parseInt(startSel.value, 10);
    if (!Number.isFinite(v)) return;
    simState.start = v;
    if (simState.start >= simState.target) {
      const newT = Math.min(12, simState.start + 1);
      targetSel.value = String(newT);
      simState.target = newT;
    }
    simReset();
  });
  targetSel.addEventListener('change', () => {
    const v = parseInt(targetSel.value, 10);
    if (!Number.isFinite(v)) return;
    simState.target = v;
    if (simState.target <= simState.start) {
      const newS = Math.max(0, simState.target - 1);
      startSel.value = String(newS);
      simState.start = newS;
    }
    simReset();
  });

  $$<HTMLButtonElement>('.stone-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (simState.running) return;
      simState.selectedStone = btn.dataset.stone as StoneMethod;
      simRender();
    });
  });

  ($('#simStep') as HTMLButtonElement).addEventListener('click', () => {
    if (simState.running) return;
    if (simState.currentLevel >= 12) return;
    if (!simState.selectedStone) return;
    simAttempt(simState.selectedStone);
    simRender();
  });
  ($('#simRunSelected') as HTMLButtonElement).addEventListener('click', () => simRunAuto('selected'));
  ($('#simRunOptimal') as HTMLButtonElement).addEventListener('click', () => simRunAuto('optimal'));
  ($('#simStop') as HTMLButtonElement).addEventListener('click', () => {
    simStop();
    simRender();
  });
  ($('#simReset') as HTMLButtonElement).addEventListener('click', () => {
    simState.selectedStone = 'mirage';
    simReset();
  });

  simState.selectedStone = 'mirage';
  simRender();
}
