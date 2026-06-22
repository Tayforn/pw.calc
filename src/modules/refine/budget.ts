// =========================================================
// ЗАТОЧКА — ЗВОРОТНИЙ РОЗРАХУНОК (бюджет → ризик)
// =========================================================

import type { ItemType, Settings, StoneMethod } from '../../types';
import { $ } from '../../utils/dom';
import { fmt, fmtGold, escHtml } from '../../utils/format';
import { maskNumericInput, mcNum } from '../../utils/mask';
import { updateBudgetHint } from '../../utils/budgetHint';
import { RATES, STONE_META, attemptCost, buildPlan } from './data';

const ALL_METHODS: StoneMethod[] = ['mirage', 'sky', 'under', 'world'];

interface DpResult {
  curve: Float32Array;
  N: number;
  bucket: number;
  opening: StoneMethod | null;
  p: number;
}

const MC_DP_BUCKETS = 80000;

// Бюджетний DP по стану (рівень, залишок бюджету).
function solveBudgetDP(
  itemType: ItemType,
  start: number,
  target: number,
  budgetCoins: number,
  allowedAt: (lv: number) => StoneMethod[],
  settings: Settings,
  maxBuckets?: number,
  openingBudgetCoins?: number,
): DpResult {
  const cost: Record<StoneMethod, number> = {} as Record<StoneMethod, number>;
  for (const m of ALL_METHODS) cost[m] = attemptCost(m, itemType, settings);
  const cheapest = Math.min.apply(null, ALL_METHODS.map((m) => cost[m]));
  let N = Math.ceil(budgetCoins / (cheapest / 2));
  N = Math.max(200, Math.min(N, maxBuckets || MC_DP_BUCKETS));
  const bucket = budgetCoins / N;
  const costB: Record<StoneMethod, number> = {} as Record<StoneMethod, number>;
  for (const m of ALL_METHODS) costB[m] = Math.max(1, Math.round(cost[m] / bucket));
  const failLevel = (m: StoneMethod, lv: number): number =>
    m === 'world' ? lv : m === 'under' ? Math.max(0, lv - 1) : 0;
  const openB =
    openingBudgetCoins != null
      ? Math.max(0, Math.min(N, Math.round(openingBudgetCoins / bucket)))
      : N;

  const V: Float32Array[] = [];
  for (let lv = 0; lv <= target; lv++) V.push(new Float32Array(N + 1));
  for (let b = 0; b <= N; b++) V[target][b] = 1;

  let opening: StoneMethod | null = null;
  for (let b = 0; b <= N; b++) {
    for (let lv = target - 1; lv >= 0; lv--) {
      let best = 0;
      let bestM: StoneMethod | null = null;
      const allowed = allowedAt(lv);
      for (let k = 0; k < allowed.length; k++) {
        const m = allowed[k];
        const c = costB[m];
        if (c > b) continue; // не по кишені
        const p = RATES[m][lv + 1] || 0;
        if (p <= 0) continue;
        const fl = failLevel(m, lv);
        const val = p * V[lv + 1][b - c] + (1 - p) * V[fl][b - c];
        if (bestM === null || val > best) {
          best = val;
          bestM = m;
        }
      }
      V[lv][b] = best;
      if (b === openB && lv === start) opening = bestM;
    }
  }
  return { curve: V[start], N, bucket, opening, p: V[start][N] };
}

// Найменший бюджет (монет), за якого шанс ≥ q; null якщо недосяжно.
function budgetForProb(
  curve: Float32Array,
  bucket: number,
  N: number,
  q: number,
): number | null {
  for (let b = 0; b <= N; b++) if (curve[b] >= q) return b * bucket;
  return null;
}

// Крива «шанс vs бюджет».
function reverseCurve(
  curve: Float32Array,
  N: number,
  bucket: number,
  markBudget: number,
  settings: Settings,
): string {
  const BARS = 28;
  const markBar =
    Number.isFinite(markBudget) && markBudget > 0
      ? Math.round((Math.min(markBudget, N * bucket) / (N * bucket)) * BARS)
      : -1;
  let bars = '';
  for (let i = 1; i <= BARS; i++) {
    const b = Math.round((i / BARS) * N);
    const p = curve[b] || 0;
    const title = fmtGold(b * bucket, settings.goldPrice) + ' → ' + (p * 100).toFixed(0) + '%';
    bars +=
      '<div class="mc-bar' +
      (i === markBar ? ' mc-bar-mark' : '') +
      '" style="height:' +
      Math.max(1, p * 100).toFixed(1) +
      '%" title="' +
      escHtml(title) +
      '"></div>';
  }
  return (
    '<h4 class="mc-h">Шанс успіху залежно від бюджету</h4>' +
    '<div class="mc-hist">' +
    bars +
    '</div>' +
    '<div class="mc-hist-axis"><span>0</span>' +
    (markBar > 0 ? '<span>▮ твій бюджет</span>' : '<span>бюджет →</span>') +
    '<span>' +
    fmtGold(N * bucket, settings.goldPrice) +
    '</span></div>'
  );
}

function runReverse(settings: Settings): void {
  const resEl = $('#revResult');
  if (!resEl) return;
  const itemTypeEl = $<HTMLInputElement>('input[name="itemType"]:checked');
  const itemType = (itemTypeEl?.value ?? 'armor') as ItemType;
  const start = parseInt(($<HTMLSelectElement>('#startLevel')?.value ?? '0'), 10);
  const target = parseInt(($<HTMLSelectElement>('#targetLevel')?.value ?? '12'), 10);
  if (start >= target) {
    resEl.innerHTML = '<div class="banner">Цільовий рівень має бути вищим за поточний.</div>';
    return;
  }
  const budget = mcNum($<HTMLInputElement>('#revBudget'));
  if (!Number.isFinite(budget) || budget <= 0) {
    resEl.innerHTML = '<div class="banner">Введи бюджет у юанях.</div>';
    return;
  }

  resEl.innerHTML = '<div class="banner info">Рахую оптимальну стратегію…</div>';
  setTimeout(() => reverseCompute(resEl, itemType, start, target, budget, settings), 0);
}

function reverseCompute(
  resEl: Element,
  itemType: ItemType,
  start: number,
  target: number,
  budget: number,
  settings: Settings,
): void {
  const { plan, cumCost } = buildPlan(itemType, 'auto', settings);
  const mean = Math.max(1, cumCost[target] - cumCost[start]);
  const allMethods = (): StoneMethod[] => ['mirage', 'sky', 'under', 'world'];
  const CAP_WIDE = 500000; // дрібний бакет для точних порогів
  const CAP_FIXED = 80000;

  let range = Math.max(budget, mean * 5);
  let tries = 0;
  let optWide: DpResult = solveBudgetDP(
    itemType,
    start,
    target,
    range,
    allMethods,
    settings,
    CAP_WIDE,
    budget,
  );
  while (tries < 4) {
    if (optWide.curve[optWide.N] >= 0.991) break;
    range *= 2;
    tries++;
    optWide = solveBudgetDP(itemType, start, target, range, allMethods, settings, CAP_WIDE, budget);
  }
  const idxEntered = Math.max(0, Math.min(optWide.N, Math.round(budget / optWide.bucket)));
  const pOpt = optWide.curve[idxEntered] || 0;

  // Фіксовані стратегії — шанс на введеному бюджеті.
  const fixedDefs: Array<{ key: string; label: string; allowed: (lv: number) => StoneMethod[] }> = [
    { key: 'ev', label: 'EV-оптимальна', allowed: (lv) => [plan[lv].method] },
    { key: 'world', label: 'Лише світобудови', allowed: () => ['world'] },
    { key: 'sky', label: 'Лише небесні', allowed: () => ['sky'] },
    { key: 'under', label: 'Лише підземні', allowed: () => ['under'] },
    { key: 'mirage', label: 'Лише міражі', allowed: () => ['mirage'] },
  ];
  const fixed = fixedDefs.map((s) => {
    const dp = solveBudgetDP(itemType, start, target, budget, s.allowed, settings, CAP_FIXED);
    return { key: s.key, label: s.label, p: dp.p, opening: dp.opening };
  });

  const pct = (p: number): string => (p * 100).toFixed(p > 0 && p < 0.1 ? 1 : 0) + '%';
  const openLabel = optWide.opening ? STONE_META[optWide.opening].label : '—';
  const nonBinding = pOpt > 0.999;
  const headline =
    '<div class="banner info">За бюджет <b>' +
    fmt(budget) +
    ' юані</b> (≈ ' +
    fmtGold(budget, settings.goldPrice) +
    ') оптимальна стратегія дає <b>' +
    pct(pOpt) +
    '</b> шансів дійти +' +
    start +
    ' → +' +
    target +
    '.' +
    (pOpt <= 0
      ? ' Бюджету замало навіть для оптимальної стратегії.'
      : nonBinding
        ? ' Бюджету з запасом — будь-яка розумна стратегія дійде; раціональний перший крок: <b>' +
          openLabel +
          '</b>.'
        : ' Раціональний перший крок: <b>' + openLabel + '</b>.') +
    '</div>';

  const optRow = {
    key: 'opt',
    label: 'Оптимальна (адаптивна)',
    p: pOpt,
    opening: optWide.opening,
  };
  const rest = fixed.slice().sort((a, b) => b.p - a.p);
  const stratRows = [optRow]
    .concat(rest)
    .map((r) => {
      const open = r.opening ? STONE_META[r.opening].label : '—';
      return (
        '<tr' +
        (r.key === 'opt' ? ' class="mc-mid"' : '') +
        '>' +
        '<td>' +
        r.label +
        '</td>' +
        '<td class="num"><b>' +
        pct(r.p) +
        '</b></td>' +
        '<td>' +
        open +
        '</td></tr>'
      );
    })
    .join('');
  const stratTable =
    '<h4 class="mc-h">Шанс дійти за бюджет — за стратегіями</h4>' +
    '<div class="table-wrap"><table class="data-table"><thead><tr>' +
    '<th>Стратегія</th><th class="num">Шанс</th><th>Перший крок</th>' +
    '</tr></thead><tbody>' +
    stratRows +
    '</tbody></table></div>';

  const thrRows = [0.5, 0.8, 0.95, 0.99]
    .map((q) => {
      const b = budgetForProb(optWide.curve, optWide.bucket, optWide.N, q);
      const delta =
        b != null && b > budget
          ? ' <span class="rev-delta">(+' + fmtGold(b - budget, settings.goldPrice) + ' до бюджету)</span>'
          : b != null
            ? ' <span class="rev-delta rev-ok">(у межах бюджету)</span>'
            : '';
      return (
        '<tr><td>' +
        q * 100 +
        '%</td>' +
        (b != null
          ? '<td class="num">' +
            fmtGold(b, settings.goldPrice) +
            '</td><td class="num">' +
            fmt(b) +
            delta +
            '</td>'
          : '<td class="num" colspan="2">понад розрахований діапазон</td>') +
        '</tr>'
      );
    })
    .join('');
  const thrTable =
    '<h4 class="mc-h">Скільки бюджету на який шанс (оптимальна стратегія)</h4>' +
    '<div class="table-wrap"><table class="data-table"><thead><tr>' +
    '<th>Ціль шансу</th><th class="num">Голд</th><th class="num">Юані</th>' +
    '</tr></thead><tbody>' +
    thrRows +
    '</tbody></table></div>';

  resEl.innerHTML =
    headline +
    reverseCurve(optWide.curve, optWide.N, optWide.bucket, budget, settings) +
    stratTable +
    thrTable +
    '<p class="muted" style="margin-top:10px;font-size:12.5px">«Оптимальна» обирає камінь на кожному кроці залежно від рівня та залишку бюджету (максимізує шанс уложитися), тож вона ніколи не гірша за будь-яку фіксовану. Модель провалу: світобудови — без падіння, підземний −1, міраж/небесний — скид у +0.</p>';
}

export function initReverse(getSettings: () => Settings): void {
  const form = $('#revForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      runReverse(getSettings());
    });
  }
  maskNumericInput($<HTMLInputElement>('#revBudget'));
  const b = $('#revBudget');
  if (b) b.addEventListener('input', () => updateBudgetHint('revBudget', 'revBudgetHint'));
  updateBudgetHint('revBudget', 'revBudgetHint');
}
