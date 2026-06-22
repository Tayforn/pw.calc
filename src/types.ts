// Спільні типи для калькулятора заточки та похідних модулів.

export interface Settings {
  goldPrice: number;
  miragePrice: number;
  underPrice: number;
  skyPrice: number;
  worldPrice: number;
}

/** Метод заточки. `mirage` — без каменя, решта — з відповідним каменем. */
export type StoneMethod = 'mirage' | 'sky' | 'under' | 'world';

/** Тип предмета: впливає на к-сть міражів за спробу. */
export type ItemType = 'armor' | 'weapon';

/** Вибір методу у формі: будь-який метод або «авто» (оптимальний). */
export type MethodSelection = StoneMethod | 'auto';

/** Один крок плану заточки (підйом на +1 рівень). */
export interface PlanStep {
  method: StoneMethod;
  stepCost: number;
  attempts: number;
  successRate: number;
  attemptCost: number;
}

/** Результат buildPlan: накопичена вартість і покроковий план. */
export interface RefinePlan {
  cumCost: number[];
  plan: PlanStep[];
}

/** Сумарні витрати ресурсів для відрізку плану. */
export interface PlanTotals {
  mirages: number;
  sky: number;
  under: number;
  world: number;
}

/** Мета-інформація про метод заточки (підписи, ключ ціни каменя). */
export interface StoneMetaEntry {
  label: string;
  cls: string;
  short: string;
  priceKey: 'skyPrice' | 'underPrice' | 'worldPrice' | null;
}
