// =========================================================
// Шари: чисті розрахунки (спільні для сторінок eggs/compare).
// =========================================================

import type { ItemType, Settings, StoneMethod } from '../types';
import { buildPlan } from '../modules/refine/data';
import { EGGS_FOR_LEVEL, ONE_STAR_EQ, RECIPES } from '../modules/shards/data';

export interface EggRow {
  level: number;
  eggs: number;
  coinCost: number;
}

/** Таблиця вартості шарів ★1..★12 за ціною яйця. */
export function computeEggsTable(eggPrice: number): EggRow[] {
  const rows: EggRow[] = [];
  for (let lvl = 1; lvl <= 12; lvl++) {
    const eggsCount = EGGS_FOR_LEVEL[lvl];
    rows.push({ level: lvl, eggs: eggsCount, coinCost: eggsCount * eggPrice });
  }
  return rows;
}

// ---------- Порівняння: камені vs шари ----------

export interface CompareRow {
  n: number;
  stoneCum: number; // сумарна вартість каменями до +n
  stoneStep: number; // вартість кроку +n каменями
  method: StoneMethod; // оптимальний камінь для кроку
  orbCum: number; // сумарна вартість шарами ★1..★n
  orbCumEggs: number;
  orbStep: number; // вартість шара ★n
  orbStepEggs: number;
  winner: 'stones' | 'orb' | 'tie'; // за сумарною ціною
  savings: number;
  savingsPct: number;
  stepWinner: 'stones' | 'orb' | 'tie';
  stepSavings: number;
  stepSavingsPct: number;
  recipeStr: string; // рецепт шара ★n у ★1-екв
  cumEq: number; // ★1-екв сумарно до +n
  stepEq: number; // ★1-екв шара ★n
}

export interface CompareResult {
  rows: CompareRow[];
  stoneWins: number;
  orbWins: number;
  stoneCum12: number;
  orbCum12: number;
  orbCumEggs12: number;
}

/** Порівняння вартості «камені vs шари» для всіх 12 рівнів. */
export function computeCompare(itemType: ItemType, settings: Settings, eggPrice: number): CompareResult {
  const { cumCost, plan } = buildPlan(itemType, 'auto', settings);
  const eggs = computeEggsTable(eggPrice);

  const orbEggsByLevel: number[] = [0];
  for (let k = 1; k <= 12; k++) orbEggsByLevel[k] = orbEggsByLevel[k - 1] + eggs[k - 1].eggs;
  const orbCumByLevel = orbEggsByLevel.map((e) => e * eggPrice);

  const rows: CompareRow[] = [];
  let stoneWins = 0;
  let orbWins = 0;

  for (let n = 1; n <= 12; n++) {
    const stoneCum = cumCost[n];
    const stoneStep = plan[n - 1].stepCost;
    const orbStepEggs = eggs[n - 1].eggs;
    const orbCumEggs = orbEggsByLevel[n];
    const orbCum = orbCumByLevel[n];
    const orbStep = orbStepEggs * eggPrice;

    const diff = stoneCum - orbCum;
    const winner: CompareRow['winner'] = Math.abs(diff) < 1 ? 'tie' : diff > 0 ? 'orb' : 'stones';
    if (winner === 'orb') orbWins++;
    if (winner === 'stones') stoneWins++;

    const savings = Math.abs(diff);
    const maxCost = Math.max(stoneCum, orbCum);
    const savingsPct = maxCost > 0 ? (savings / maxCost) * 100 : 0;

    const stepDiff = stoneStep - orbStep;
    const stepWinner: CompareRow['stepWinner'] = Math.abs(stepDiff) < 1 ? 'tie' : stepDiff > 0 ? 'orb' : 'stones';
    const stepSavings = Math.abs(stepDiff);
    const maxStep = Math.max(stoneStep, orbStep);
    const stepSavingsPct = maxStep > 0 ? (stepSavings / maxStep) * 100 : 0;

    const stepEq = ONE_STAR_EQ[n];
    let cumEq = 0;
    for (let k = 1; k <= n; k++) cumEq += ONE_STAR_EQ[k];

    const recipeStr =
      n === 1
        ? '★1 — базовий шар (1 ★1-екв)'
        : `★${n} = ` +
          Object.entries(RECIPES[n])
            .map(([sub, qty]) => `${qty}×★${sub}`)
            .join(' + ') +
          ` = ${stepEq} ★1-екв`;

    rows.push({
      n, stoneCum, stoneStep, method: plan[n - 1].method,
      orbCum, orbCumEggs, orbStep, orbStepEggs,
      winner, savings, savingsPct, stepWinner, stepSavings, stepSavingsPct,
      recipeStr, cumEq, stepEq,
    });
  }

  return {
    rows, stoneWins, orbWins,
    stoneCum12: cumCost[12],
    orbCum12: orbCumByLevel[12],
    orbCumEggs12: orbEggsByLevel[12],
  };
}
