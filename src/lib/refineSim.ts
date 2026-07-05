// =========================================================
// Двигун симулятора заточки. Мутабельний стан + цикл авто-прогону
// (rAF/setTimeout) — так правильно для високочастотної симуляції.
// React-сторінка читає знімок через subscribe/getSnapshot.
// =========================================================

import type { ItemType, Settings, StoneMethod } from '../types';
import { RATES, STONE_META, buildPlan, miragesPerAttempt } from '../modules/refine/data';

export const SIM_HISTORY_MAX = 200;
export type SimSpeed = 'slow' | 'med' | 'fast' | 'turbo';
const SIM_SPEEDS: Record<SimSpeed, { batch: number; delay: number }> = {
  slow: { batch: 1, delay: 200 },
  med: { batch: 1, delay: 16 },
  fast: { batch: 50, delay: 0 },
  turbo: { batch: 5000, delay: 0 },
};

export interface SimAttemptRec {
  stone: StoneMethod;
  success: boolean;
  before: number;
  after: number;
}
export interface SimHistRec extends SimAttemptRec {
  idx: number;
}
type ByStone = Record<StoneMethod, number>;
const zeroByStone = (): ByStone => ({ mirage: 0, under: 0, sky: 0, world: 0 });

export interface SimSnapshot {
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
}

export interface SimEngine {
  subscribe: (fn: () => void) => () => void;
  getSnapshot: () => SimSnapshot;
  getSpeed: () => SimSpeed;
  setSpeed: (s: SimSpeed) => void;
  setItemType: (t: ItemType) => void;
  setStart: (n: number) => void;
  setTarget: (n: number) => void;
  selectStone: (s: StoneMethod) => void;
  step: () => void;
  runAuto: (mode: 'optimal' | 'selected') => void;
  stop: () => void;
  reset: () => void;
}

/** Створює двигун симуляції; getSettings читає актуальні ціни. */
export function createSim(getSettings: () => Settings): SimEngine {
  const s: SimSnapshot = {
    itemType: 'armor',
    start: 0,
    target: 12,
    currentLevel: 0,
    bestLevel: 0,
    selectedStone: 'mirage',
    totalAttempts: 0,
    mirages: 0,
    stones: zeroByStone(),
    successByStone: zeroByStone(),
    failByStone: zeroByStone(),
    lastAttempt: null,
    history: [],
    running: false,
  };
  let speed: SimSpeed = 'med';
  let rafId: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  // Знімок незмінюваний: копіюємо, щоб useSyncExternalStore бачив нову референцію.
  let snap: SimSnapshot = cloneSnap();
  const listeners = new Set<() => void>();
  function cloneSnap(): SimSnapshot {
    return {
      ...s,
      stones: { ...s.stones },
      successByStone: { ...s.successByStone },
      failByStone: { ...s.failByStone },
      history: s.history.slice(-SIM_HISTORY_MAX),
    };
  }
  function notify(): void {
    snap = cloneSnap();
    listeners.forEach((fn) => fn());
  }

  function stop(): void {
    s.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (timerId) clearTimeout(timerId);
    rafId = null;
    timerId = null;
  }

  function resetCounters(): void {
    s.currentLevel = s.start;
    s.bestLevel = s.start;
    s.totalAttempts = 0;
    s.mirages = 0;
    s.stones = zeroByStone();
    s.successByStone = zeroByStone();
    s.failByStone = zeroByStone();
    s.lastAttempt = null;
    s.history = [];
  }
  function reset(): void {
    stop();
    resetCounters();
    notify();
  }

  function attempt(stone: StoneMethod): boolean {
    const nextLv = s.currentLevel + 1;
    if (nextLv > 12) return false;
    const p = RATES[stone] && RATES[stone][nextLv];
    if (!p || p <= 0) return false;

    s.totalAttempts++;
    s.mirages += miragesPerAttempt(s.itemType);
    s.stones[stone]++;

    const success = Math.random() < p;
    const beforeLv = s.currentLevel;
    if (success) {
      s.currentLevel = nextLv;
      s.successByStone[stone]++;
    } else {
      s.failByStone[stone]++;
      if (stone === 'world') {
        /* рівень зберігається */
      } else if (stone === 'under') {
        s.currentLevel = Math.max(0, s.currentLevel - 1);
      } else {
        s.currentLevel = 0; // mirage / sky → +0
      }
    }
    if (s.currentLevel > s.bestLevel) s.bestLevel = s.currentLevel;
    s.lastAttempt = { stone, success, before: beforeLv, after: s.currentLevel };
    s.history.push({ idx: s.totalAttempts, stone, success, before: beforeLv, after: s.currentLevel });
    if (s.history.length > SIM_HISTORY_MAX * 2) s.history.splice(0, s.history.length - SIM_HISTORY_MAX);
    return true;
  }

  function runAuto(mode: 'optimal' | 'selected'): void {
    if (s.running) return;
    if (s.currentLevel >= s.target) {
      notify();
      return;
    }
    let attemptFn: () => boolean;
    if (mode === 'optimal') {
      const { plan } = buildPlan(s.itemType, 'auto', getSettings());
      attemptFn = () => {
        const lv = s.currentLevel + 1;
        if (lv > 12) return false;
        const m = plan[lv - 1] && plan[lv - 1].method;
        return m ? attempt(m) : false;
      };
    } else {
      if (!s.selectedStone) s.selectedStone = 'mirage';
      attemptFn = () => attempt(s.selectedStone as StoneMethod);
    }

    s.running = true;
    notify();

    function frame(): void {
      if (!s.running) return;
      const sp = SIM_SPEEDS[speed] || SIM_SPEEDS.med;
      for (let i = 0; i < sp.batch; i++) {
        if (!s.running) break;
        if (s.currentLevel >= s.target) break;
        if (!attemptFn()) break;
      }
      notify();
      if (s.currentLevel >= s.target) {
        stop();
        notify();
        return;
      }
      if (!s.running) return;
      if (sp.delay > 0) timerId = setTimeout(frame, sp.delay);
      else rafId = requestAnimationFrame(frame);
    }
    frame();
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snap,
    getSpeed: () => speed,
    setSpeed: (v) => { speed = v; },
    setItemType(t) { s.itemType = t; reset(); },
    setStart(n) {
      s.start = n;
      if (s.start >= s.target) s.target = Math.min(12, s.start + 1);
      reset();
    },
    setTarget(n) {
      s.target = n;
      if (s.target <= s.start) s.start = Math.max(0, s.target - 1);
      reset();
    },
    selectStone(stone) {
      if (s.running) return;
      s.selectedStone = stone;
      notify();
    },
    step() {
      if (s.running || s.currentLevel >= 12 || !s.selectedStone) return;
      attempt(s.selectedStone);
      notify();
    },
    runAuto,
    stop() { stop(); notify(); },
    reset() { s.selectedStone = 'mirage'; reset(); },
  };
}

// ---------- Похідна статистика (для рендера) ----------

export interface SimStoneRow {
  stone: StoneMethod;
  total: number;
  succ: number;
  fail: number;
  realPct: string;
  cost: number;
}
export interface SimStats {
  totalCost: number;
  reachedTarget: boolean;
  stonesUsed: number;
  rows: SimStoneRow[];
  expectedCost: number | null; // очікувана вартість оптимального плану (лише при досягненні цілі)
}

export function computeSimStats(s: SimSnapshot, settings: Settings): SimStats {
  const mirPerAtt = miragesPerAttempt(s.itemType);
  const mirageCoinsTotal = s.mirages * settings.miragePrice;
  const stoneCoins =
    s.stones.under * settings.underPrice * settings.goldPrice +
    s.stones.sky * settings.skyPrice * settings.goldPrice +
    s.stones.world * settings.worldPrice * settings.goldPrice;
  const totalCost = mirageCoinsTotal + stoneCoins;
  const reachedTarget = s.currentLevel >= s.target;
  const stonesUsed = s.stones.under + s.stones.sky + s.stones.world;

  const rows: SimStoneRow[] = (['mirage', 'under', 'sky', 'world'] as StoneMethod[])
    .filter((st) => s.stones[st] > 0)
    .map((st) => {
      const total = s.stones[st];
      const succ = s.successByStone[st];
      const fail = s.failByStone[st];
      const realPct = total > 0 ? ((succ / total) * 100).toFixed(2) : '0.00';
      const mirShare = total * mirPerAtt * settings.miragePrice;
      const priceKey = STONE_META[st].priceKey;
      const stoneShare = st === 'mirage' || !priceKey ? 0 : total * settings[priceKey] * settings.goldPrice;
      return { stone: st, total, succ, fail, realPct, cost: mirShare + stoneShare };
    });

  let expectedCost: number | null = null;
  if (reachedTarget) {
    try {
      const { cumCost } = buildPlan(s.itemType, 'auto', settings);
      expectedCost = cumCost[s.target] - cumCost[s.start];
    } catch {
      expectedCost = null;
    }
  }
  return { totalCost, reachedTarget, stonesUsed, rows, expectedCost };
}
