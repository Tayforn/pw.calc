// =========================================================
// Заточка: чисті обчислення для Monte Carlo та зворотного бюджету (DP).
// Рендер — у RefinePage; тут лише математика (1:1 з legacy).
// =========================================================

import type { ItemType, MethodSelection, PlanStep, Settings, StoneMethod } from '../types';
import { RATES, attemptCost, buildPlan, miragesPerAttempt } from '../modules/refine/data';

const ALL_METHODS: StoneMethod[] = ['mirage', 'sky', 'under', 'world'];

// ---------- Monte Carlo ----------

export const MC_CAP_ATTEMPTS = 150000;
export const MC_MAX_RUNS = 50000;

export interface StoneSum {
  sky: number;
  under: number;
  world: number;
}
export interface McSampleResult {
  costs: number[];
  capped: number;
  attSum: number;
  mirSum: number;
  stoneSum: StoneSum;
}

/** Партія прогонів +start→+target з реальною поведінкою провалу. */
export function mcSamples(
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
      else level = 0;
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

export function mcPctl(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

export function mcCountLE(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface McStats {
  sorted: number[];
  n: number;
  sampMean: number;
  std: number;
  p10: number;
  p50: number;
  p90: number;
}
/** Похідна статистика відсортованого масиву вартостей. */
export function mcStats(costs: number[]): McStats {
  const sorted = costs.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const sampMean = n ? sorted.reduce((s, x) => s + x, 0) / n : 0;
  const std = n ? Math.sqrt(sorted.reduce((s, x) => s + (x - sampMean) * (x - sampMean), 0) / n) : 0;
  return { sorted, n, sampMean, std, p10: mcPctl(sorted, 0.1), p50: mcPctl(sorted, 0.5), p90: mcPctl(sorted, 0.9) };
}

/** Гістограма (24 біни) до 99-го перцентиля: [висота 0..1, від, кількість]. */
export function mcHistogram(sorted: number[]): { bins: Array<{ h: number; from: number; count: number }>; lo: number; hi: number } | null {
  const lo = sorted[0];
  const hi = mcPctl(sorted, 0.99);
  if (!(hi > lo)) return null;
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
  return {
    lo,
    hi,
    bins: counts.map((cnt, i) => ({ h: max ? cnt / max : 0, from: lo + i * w, count: cnt })),
  };
}

// ---------- Зворотний бюджет (DP) ----------

export const MC_DP_BUCKETS = 80000;

export interface DpResult {
  curve: Float32Array;
  N: number;
  bucket: number;
  opening: StoneMethod | null;
  p: number;
}

export function solveBudgetDP(
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
  const openB = openingBudgetCoins != null ? Math.max(0, Math.min(N, Math.round(openingBudgetCoins / bucket))) : N;

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
        if (c > b) continue;
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

/** Найменший бюджет (монет), за якого шанс ≥ q; null якщо недосяжно. */
export function budgetForProb(curve: Float32Array, bucket: number, N: number, q: number): number | null {
  for (let b = 0; b <= N; b++) if (curve[b] >= q) return b * bucket;
  return null;
}

export interface ReverseResult {
  optWide: DpResult;
  pOpt: number;
  fixed: Array<{ key: string; label: string; p: number; opening: StoneMethod | null }>;
}

/** Повний зворотний розрахунок бюджет→ризик (адаптивна + фіксовані стратегії). */
export function computeReverse(
  itemType: ItemType,
  start: number,
  target: number,
  budget: number,
  settings: Settings,
): ReverseResult {
  const { plan, cumCost } = buildPlan(itemType, 'auto', settings);
  const mean = Math.max(1, cumCost[target] - cumCost[start]);
  const allMethods = (): StoneMethod[] => ['mirage', 'sky', 'under', 'world'];
  const CAP_WIDE = 500000;
  const CAP_FIXED = 80000;

  let range = Math.max(budget, mean * 5);
  let tries = 0;
  let optWide = solveBudgetDP(itemType, start, target, range, allMethods, settings, CAP_WIDE, budget);
  while (tries < 4) {
    if (optWide.curve[optWide.N] >= 0.991) break;
    range *= 2;
    tries++;
    optWide = solveBudgetDP(itemType, start, target, range, allMethods, settings, CAP_WIDE, budget);
  }
  const idxEntered = Math.max(0, Math.min(optWide.N, Math.round(budget / optWide.bucket)));
  const pOpt = optWide.curve[idxEntered] || 0;

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

  return { optWide, pOpt, fixed };
}
