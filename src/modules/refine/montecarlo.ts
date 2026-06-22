// =========================================================
// ЗАТОЧКА — MONTE CARLO (розподіл вартості)
// =========================================================

import type { ItemType, MethodSelection, PlanStep, Settings, StoneMethod } from '../../types';
import { $ } from '../../utils/dom';
import { fmt, fmt2, fmtGold, fmtYuan, groupDigits, escHtml } from '../../utils/format';
import { maskNumericInput, mcNum } from '../../utils/mask';
import { updateBudgetHint } from '../../utils/budgetHint';
import { RATES, attemptCost, buildPlan, miragesPerAttempt } from './data';

// Межа спроб на один прогін (захист від методів зі скиданням у +0).
const MC_CAP_ATTEMPTS = 150000;
// Стеля к-сті прогонів.
const MC_MAX_RUNS = 50000;
let mcToken = 0;

interface StoneSum {
  sky: number;
  under: number;
  world: number;
}
interface McSampleResult {
  costs: number[];
  capped: number;
  attSum: number;
  mirSum: number;
  stoneSum: StoneSum;
}
interface McAgg {
  attSum: number;
  mirSum: number;
  stoneSum: StoneSum;
}

// Один прогін +start→+target з реальною поведінкою провалу.
function mcSamples(
  itemType: ItemType,
  start: number,
  target: number,
  methodSel: MethodSelection,
  plan: PlanStep[],
  runs: number,
  settings: Settings,
): McSampleResult {
  const costs: number[] = [];
  let capped = 0;
  let attSum = 0;
  let mirSum = 0;
  const stoneSum: StoneSum = { sky: 0, under: 0, world: 0 };
  const mirPer = miragesPerAttempt(itemType);
  for (let r = 0; r < runs; r++) {
    let level = start;
    let cost = 0;
    let att = 0;
    let mir = 0;
    let hitCap = false;
    const st: StoneSum = { sky: 0, under: 0, world: 0 };
    while (level < target) {
      const lv = level + 1;
      const m = (methodSel === 'auto' ? plan[lv - 1].method : methodSel) as StoneMethod;
      const p = RATES[m][lv] as number;
      cost += attemptCost(m, itemType, settings);
      mir += mirPer;
      if (m !== 'mirage') st[m]++;
      if (++att > MC_CAP_ATTEMPTS) {
        hitCap = true;
        break;
      }
      if (Math.random() < p) level = lv;
      else if (m === 'world') {
        /* рівень зберігається */
      } else if (m === 'under') level = Math.max(0, level - 1);
      else level = 0; // mirage / sky
    }
    if (hitCap) {
      capped++;
    } else {
      costs.push(cost);
      attSum += att;
      mirSum += mir;
      stoneSum.sky += st.sky;
      stoneSum.under += st.under;
      stoneSum.world += st.world;
    }
  }
  return { costs, capped, attSum, mirSum, stoneSum };
}

// Перцентиль для вже відсортованого масиву (q у [0..1]).
function mcPctl(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

// Кількість елементів <= x у відсортованому масиві (бінарний пошук).
function mcCountLE(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function mcHistogram(sorted: number[], settings: Settings): string {
  const lo = sorted[0];
  const hi = mcPctl(sorted, 0.99); // обрізаємо довгий правий хвіст
  if (!(hi > lo)) return '';
  const BINS = 24;
  const w = (hi - lo) / BINS;
  const counts = new Array<number>(BINS).fill(0);
  for (const c of sorted) {
    let b = Math.floor((c - lo) / w);
    if (b < 0) b = 0;
    else if (b >= BINS) b = BINS - 1;
    counts[b]++;
  }
  const max = Math.max(...counts);
  const bars = counts
    .map((cnt, i) => {
      const h = max ? (cnt / max) * 100 : 0;
      const from = lo + i * w;
      const title = fmtGold(from, settings.goldPrice) + ' · ' + cnt + ' прогонів';
      return (
        '<div class="mc-bar" style="height:' +
        h.toFixed(1) +
        '%" title="' +
        escHtml(title) +
        '"></div>'
      );
    })
    .join('');
  return (
    '<div class="mc-hist">' +
    bars +
    '</div>' +
    '<div class="mc-hist-axis">' +
    '<span>' +
    fmtGold(lo, settings.goldPrice) +
    '</span>' +
    '<span>дешевше ←&nbsp;розподіл&nbsp;→ дорожче</span>' +
    '<span>' +
    fmtGold(hi, settings.goldPrice) +
    '+</span>' +
    '</div>'
  );
}

// Картка-метрика для вартості: голд великим, юані дрібним.
function mcMetric(label: string, coins: number, settings: Settings, cls?: string): string {
  return (
    '<div class="metric' +
    (cls ? ' ' + cls : '') +
    '">' +
    '<span class="metric-label">' +
    label +
    '</span>' +
    '<span class="metric-value">' +
    fmtGold(coins, settings.goldPrice) +
    '</span>' +
    '<span class="metric-sub">' +
    fmtYuan(coins) +
    '</span>' +
    '</div>'
  );
}

// Картка-метрика для довільного значення (не вартість).
function mcMetricRaw(label: string, value: string, sub: string): string {
  return (
    '<div class="metric">' +
    '<span class="metric-label">' +
    label +
    '</span>' +
    '<span class="metric-value">' +
    value +
    '</span>' +
    '<span class="metric-sub">' +
    sub +
    '</span>' +
    '</div>'
  );
}

function mcCostRow(label: string, coins: number, settings: Settings, cls?: string): string {
  return (
    '<tr' +
    (cls ? ' class="' + cls + '"' : '') +
    '>' +
    '<td>' +
    label +
    '</td>' +
    '<td class="num">' +
    fmtGold(coins, settings.goldPrice) +
    '</td>' +
    '<td class="num">' +
    fmt(coins) +
    '</td>' +
    '</tr>'
  );
}

function mcRenderStats(
  costs: number[],
  capped: number,
  runs: number,
  mean: number,
  start: number,
  target: number,
  agg: McAgg,
  settings: Settings,
): void {
  const resEl = $('#mcResult');
  if (!resEl) return;
  const cappedPct = runs ? capped / runs : 1;
  if (!costs.length || cappedPct > 0.5) {
    resEl.innerHTML =
      '<div class="banner">Розкид надто великий для симуляції: на високих рівнях ' +
      'обраний метод скидає заточку у +0, і прогони майже не завершуються. ' +
      'Орієнтуйся на аналітичне середнє — <b>' +
      fmtGold(mean, settings.goldPrice) +
      '</b> (' +
      fmtYuan(mean) +
      ').</div>';
    return;
  }

  const sorted = costs.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const sampMean = sorted.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(
    sorted.reduce((s, x) => s + (x - sampMean) * (x - sampMean), 0) / n,
  );
  const p10 = mcPctl(sorted, 0.1);
  const p50 = mcPctl(sorted, 0.5);
  const p90 = mcPctl(sorted, 0.9);
  const per = (v: number): number => v / n;

  // ── заголовкові метрики ─────────────────────────────────
  const headline =
    '<div class="result-summary mc-summary">' +
    mcMetric('Середнє', sampMean, settings, 'accent') +
    mcMetric('Медіана', p50, settings) +
    mcMetric('Щастить (краще 10%)', p10, settings, 'good') +
    mcMetric('Не щастить (гірше 10%)', p90, settings, 'bad') +
    mcMetric('Розкид (σ)', std, settings) +
    mcMetricRaw('Спроб (сер.)', fmt2(per(agg.attSum)), 'на 1 заточку') +
    '</div>';

  // ── таблиця перцентилів ─────────────────────────────────
  const pctlTable =
    '<h4 class="mc-h">Розподіл вартості по перцентилях</h4>' +
    '<div class="table-wrap"><table class="data-table"><thead><tr>' +
    '<th>Перцентиль</th><th class="num">Голд</th><th class="num">Юані</th>' +
    '</tr></thead><tbody>' +
    mcCostRow('Мінімум', sorted[0], settings) +
    mcCostRow('10% — щастить', p10, settings, 'mc-good') +
    mcCostRow('25%', mcPctl(sorted, 0.25), settings) +
    mcCostRow('Медіана (50%)', p50, settings, 'mc-mid') +
    mcCostRow('75%', mcPctl(sorted, 0.75), settings) +
    mcCostRow('90% — не щастить', p90, settings, 'mc-bad') +
    mcCostRow('95%', mcPctl(sorted, 0.95), settings) +
    mcCostRow('99%', mcPctl(sorted, 0.99), settings) +
    mcCostRow('Максимум', sorted[n - 1], settings) +
    '</tbody></table></div>';

  // ── шанс уложитися в бюджет ──
  const budYuan = mcNum($<HTMLInputElement>('#mcBudget'));
  const hasBud = Number.isFinite(budYuan) && budYuan > 0;
  const thresholds: Array<[string, number, boolean]> = [
    ['½ середнього', sampMean * 0.5, false],
    ['¾ середнього', sampMean * 0.75, false],
    ['Середнє', sampMean, false],
    ['×1.25 середнього', sampMean * 1.25, false],
    ['×1.5 середнього', sampMean * 1.5, false],
    ['×2 середнього', sampMean * 2, false],
  ];
  if (hasBud) thresholds.push(['Ваш бюджет', budYuan, true]);
  thresholds.sort((a, b) => a[1] - b[1]);
  const budRows = thresholds
    .map((t) => {
      const within = mcCountLE(sorted, t[1]) / n;
      return (
        '<tr' +
        (t[2] ? ' class="mc-mid"' : '') +
        '>' +
        '<td>' +
        t[0] +
        '</td>' +
        '<td class="num">' +
        fmtGold(t[1], settings.goldPrice) +
        '</td>' +
        '<td class="num">' +
        fmt(t[1]) +
        '</td>' +
        '<td class="num"><b>' +
        (within * 100).toFixed(0) +
        '%</b></td>' +
        '</tr>'
      );
    })
    .join('');
  const budTable =
    '<h4 class="mc-h">Шанс уложитися в бюджет</h4>' +
    '<div class="table-wrap"><table class="data-table"><thead><tr>' +
    '<th>Поріг</th><th class="num">Голд</th><th class="num">Юані</th><th class="num">Шанс ≤</th>' +
    '</tr></thead><tbody>' +
    budRows +
    '</tbody></table></div>';

  let budgetBanner = '';
  if (hasBud) {
    const within = mcCountLE(sorted, budYuan) / n;
    budgetBanner =
      '<div class="banner info" style="margin-top:14px"><b>' +
      (within * 100).toFixed(0) +
      '%</b> шансів заточити +' +
      start +
      ' → +' +
      target +
      ' дешевше ніж за <b>' +
      fmt(budYuan) +
      ' юані</b> (≈ ' +
      fmtGold(budYuan, settings.goldPrice) +
      ').</div>';
  }

  // ── середні витрати ресурсів ────────────────────────────
  const resRows: Array<[string, string]> = [
    ['Спроб', fmt2(per(agg.attSum))],
    ['Міражів', fmt2(per(agg.mirSum))],
  ];
  if (agg.stoneSum.sky > 0) resRows.push(['Небесних каменів', fmt2(per(agg.stoneSum.sky))]);
  if (agg.stoneSum.under > 0) resRows.push(['Підземних каменів', fmt2(per(agg.stoneSum.under))]);
  if (agg.stoneSum.world > 0) resRows.push(['Каменів світобудови', fmt2(per(agg.stoneSum.world))]);
  const resTable =
    '<h4 class="mc-h">Середні витрати на 1 заточку (+' +
    start +
    ' → +' +
    target +
    ')</h4>' +
    '<div class="table-wrap"><table class="data-table"><tbody>' +
    resRows
      .map((r) => '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td></tr>')
      .join('') +
    '</tbody></table></div>';

  const cappedNote =
    capped > 0
      ? '<p class="muted" style="margin-top:10px;font-size:12.5px">' +
        capped +
        ' з ' +
        runs +
        ' прогонів обрізано за межею спроб — їх не враховано в розподілі.</p>'
      : '';

  resEl.innerHTML =
    '<div class="banner info">Симуляція: <b>' +
    fmt(n) +
    '</b> прогонів (+' +
    start +
    ' → +' +
    target +
    '). Середнє MC <b>' +
    fmtGold(sampMean, settings.goldPrice) +
    '</b> ≈ аналітичне <b>' +
    fmtGold(mean, settings.goldPrice) +
    '</b>.</div>' +
    headline +
    mcHistogram(sorted, settings) +
    budgetBanner +
    pctlTable +
    budTable +
    resTable +
    cappedNote;
}

function runMonteCarlo(settings: Settings): void {
  const resEl = $('#mcResult');
  if (!resEl) return;
  const itemTypeEl = $<HTMLInputElement>('input[name="itemType"]:checked');
  const itemType = (itemTypeEl?.value ?? 'armor') as ItemType;
  const start = parseInt(($<HTMLSelectElement>('#startLevel')?.value ?? '0'), 10);
  const target = parseInt(($<HTMLSelectElement>('#targetLevel')?.value ?? '12'), 10);
  const methodSel = ($<HTMLSelectElement>('#stoneStrategy')?.value ?? 'auto') as MethodSelection;

  if (start >= target) {
    resEl.innerHTML = '<div class="banner">Цільовий рівень має бути вищим за поточний.</div>';
    return;
  }

  // к-сть прогонів — з поля (із обмеженням), інакше дефолт
  let RUNS = Math.floor(mcNum($<HTMLInputElement>('#mcRuns')));
  if (!Number.isFinite(RUNS) || RUNS < 100) RUNS = 10000;
  if (RUNS > MC_MAX_RUNS) RUNS = MC_MAX_RUNS;
  const runsEl = $<HTMLInputElement>('#mcRuns');
  if (runsEl) runsEl.value = groupDigits(String(RUNS));

  const { plan, cumCost } = buildPlan(itemType, methodSel === 'auto' ? 'auto' : methodSel, settings);
  const mean = cumCost[target] - cumCost[start];
  const CHUNK = 300;

  const token = ++mcToken;
  const costs: number[] = [];
  const agg: McAgg = { attSum: 0, mirSum: 0, stoneSum: { sky: 0, under: 0, world: 0 } };
  let capped = 0;
  let done = 0;
  resEl.innerHTML = '<div class="banner info">Симуляція… <b id="mcProg">0%</b></div>';

  const chunk = (): void => {
    if (token !== mcToken) return; // запущено новий — цей скасовано
    const part = mcSamples(
      itemType,
      start,
      target,
      methodSel,
      plan,
      Math.min(CHUNK, RUNS - done),
      settings,
    );
    for (const c of part.costs) costs.push(c);
    capped += part.capped;
    agg.attSum += part.attSum;
    agg.mirSum += part.mirSum;
    agg.stoneSum.sky += part.stoneSum.sky;
    agg.stoneSum.under += part.stoneSum.under;
    agg.stoneSum.world += part.stoneSum.world;
    done += CHUNK;
    if (capped / done > 0.5) {
      mcRenderStats(costs, capped, done, mean, start, target, agg, settings);
    } else if (done >= RUNS) {
      mcRenderStats(costs, capped, RUNS, mean, start, target, agg, settings);
    } else {
      const pe = document.getElementById('mcProg');
      if (pe) pe.textContent = Math.round((done / RUNS) * 100) + '%';
      setTimeout(chunk, 0);
    }
  };
  chunk();
}

export function initMonteCarlo(getSettings: () => Settings): void {
  const form = $('#mcForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      runMonteCarlo(getSettings());
    });
  }
  maskNumericInput($<HTMLInputElement>('#mcRuns'));
  maskNumericInput($<HTMLInputElement>('#mcBudget'));
  const bud = $('#mcBudget');
  if (bud) bud.addEventListener('input', () => updateBudgetHint('mcBudget', 'mcBudgetHint'));
  updateBudgetHint('mcBudget', 'mcBudgetHint');
}
