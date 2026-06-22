// =========================================================
// ЗАТОЧКА — ДАНІ
// =========================================================

import type {
  ItemType,
  MethodSelection,
  PlanStep,
  PlanTotals,
  RefinePlan,
  Settings,
  StoneMetaEntry,
  StoneMethod,
} from '../../types';

// Шанси успіху заточки, RATES[method][level] — level 1..12.
export const RATES: Record<StoneMethod, Array<number | null>> = {
  mirage: [null, 0.50, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.25, 0.20, 0.12, 0.05],
  sky:    [null, 0.60, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.40, 0.35, 0.27, 0.20],
  under:  [null, 0.535, 0.335, 0.335, 0.335, 0.335, 0.335, 0.335, 0.335, 0.285, 0.235, 0.155, 0.085],
  world:  [null, 1.00, 0.25, 0.10, 0.04, 0.0167, 0.0077, 0.0047, 0.0025, 0.0013, 0.0007, 0.0004, 0.0002],
};

export const STONE_META: Record<StoneMethod, StoneMetaEntry> = {
  mirage: { label: 'Міраж',       cls: 'mirage', short: 'міраж',       priceKey: null },
  sky:    { label: 'Небесний',    cls: 'sky',    short: 'небесний',    priceKey: 'skyPrice' },
  under:  { label: 'Підземний',   cls: 'under',  short: 'підземний',   priceKey: 'underPrice' },
  world:  { label: 'Світобудови', cls: 'world',  short: 'світобудови', priceKey: 'worldPrice' },
};

/** Скільки міражів витрачається на одну спробу. */
export function miragesPerAttempt(itemType: ItemType): number {
  return itemType === 'weapon' ? 2 : 1;
}

/** Вартість однієї спроби у монетах. */
export function attemptCost(
  method: StoneMethod,
  itemType: ItemType,
  settings: Settings,
): number {
  const mirages = miragesPerAttempt(itemType) * settings.miragePrice;
  if (method === 'mirage') return mirages;
  const priceKey = STONE_META[method].priceKey;
  const stoneGold = priceKey ? settings[priceKey] : 0;
  return mirages + stoneGold * settings.goldPrice;
}

/**
 * Будує оптимальний план заточки з +0 до +12.
 * Повертає { cumCost[0..12], plan[0..11] }, де:
 *   cumCost[n] — очікувана вартість у монетах дійти від 0 до +n
 *   plan[n-1]  — опис обраного методу для кроку +n
 */
export function buildPlan(
  itemType: ItemType,
  forcedMethod: MethodSelection | undefined,
  settings: Settings,
): RefinePlan {
  const methods: StoneMethod[] =
    forcedMethod && forcedMethod !== 'auto'
      ? [forcedMethod]
      : ['mirage', 'sky', 'under', 'world'];

  const cumCost: number[] = [0];
  const plan: PlanStep[] = [];

  for (let n = 1; n <= 12; n++) {
    let best: PlanStep | null = null;
    for (const m of methods) {
      const p = RATES[m][n];
      if (!p || p <= 0) continue;

      const att = attemptCost(m, itemType, settings);

      // Поведінка при провалі:
      //  world   — рівень лишається, penalty = 0
      //  under   — -1 рівень: треба перепройти лише попередній крок
      //  mirage, sky — +0: треба перепройти всі попередні кроки
      let penalty: number;
      if (m === 'world') {
        penalty = 0;
      } else if (m === 'under') {
        penalty = n >= 2 ? cumCost[n - 1] - cumCost[n - 2] : 0;
      } else {
        penalty = cumCost[n - 1];
      }

      // E = (att + (1-p) * penalty) / p
      const stepCost = (att + (1 - p) * penalty) / p;
      const attempts = 1 / p;

      if (!best || stepCost < best.stepCost) {
        best = { method: m, stepCost, attempts, successRate: p, attemptCost: att };
      }
    }

    if (!best) {
      best = { method: 'mirage', stepCost: 0, attempts: 0, successRate: 0, attemptCost: 0 };
    }
    cumCost[n] = cumCost[n - 1] + best.stepCost;
    plan.push(best);
  }
  return { cumCost, plan };
}

/**
 * Сумарні ресурси (міражі та камені) для відрізку плану.
 */
export function totalsForPlan(
  _plan: PlanStep[],
  steps: PlanStep[],
  itemType: ItemType,
): PlanTotals {
  const totals: PlanTotals = { mirages: 0, sky: 0, under: 0, world: 0 };
  const mirPerAtt = miragesPerAttempt(itemType);

  for (const step of steps) {
    const expAttempts = step.attemptCost > 0 ? step.stepCost / step.attemptCost : 0;
    totals.mirages += expAttempts * mirPerAtt;
    if (step.method !== 'mirage') {
      totals[step.method] += expAttempts;
    }
  }
  return totals;
}
