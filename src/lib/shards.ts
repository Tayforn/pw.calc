// =========================================================
// Шари: чисті розрахунки (спільні для сторінок eggs/compare).
// =========================================================

import { EGGS_FOR_LEVEL } from '../modules/shards/data';

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
