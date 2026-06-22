// =========================================================
// КРАФТ ШАРІВ
// =========================================================

import { $ } from '../../utils/dom';
import { fmt, fmtGold } from '../../utils/format';
import { getSettings } from '../../settings';
import { getEggPrice } from '../../settings/eggPrice';
import { EGG_DROP_CRAFT, EGG_EQ_ONE_STAR, ONE_STAR_EQ, RECIPES } from './data';

type Counts = Record<number, number>;

interface CraftPlan {
  needFirst: number;
  make: Record<number, number>;
  remains: Record<number, number>;
}

/** Симуляція відкриття яєць — випадковий дроп. */
export function simulateEggs(n: number): Counts {
  const counts: Counts = { 1: 0, 2: 0, 3: 0 };
  const weights = [
    { lv: 1, w: EGG_DROP_CRAFT[1] },
    { lv: 2, w: EGG_DROP_CRAFT[2] },
    { lv: 3, w: EGG_DROP_CRAFT[3] },
    { lv: 0, w: 0.1 },
  ];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    let acc = 0;
    for (const { lv, w } of weights) {
      acc += w;
      if (r <= acc) {
        if (lv) counts[lv]++;
        break;
      }
    }
  }
  return counts;
}

/**
 * Будує план крафту: що робити, з чого, скільки бракує ★1.
 */
export function buildCraftPlan(inv: Counts, targetLv: number, targetQty: number): CraftPlan {
  const stock: Counts = {};
  for (let i = 1; i <= 12; i++) stock[i] = inv[i] || 0;
  const make: Record<number, number> = {};
  for (let i = 2; i <= 12; i++) make[i] = 0;
  let needFirst = 0;

  function produce(lv: number, count: number): void {
    if (count <= 0) return;
    if (lv === 1) {
      if (stock[1] >= count) stock[1] -= count;
      else {
        needFirst += count - stock[1];
        stock[1] = 0;
      }
      return;
    }
    if (stock[lv] >= count) {
      stock[lv] -= count;
      return;
    }
    const need = count - stock[lv];
    stock[lv] = 0;
    const req = RECIPES[lv] || {};
    for (const [sub, qty] of Object.entries(req)) {
      produce(Number(sub), qty * need);
    }
    make[lv] += need;
  }

  produce(targetLv, targetQty);

  const remains: Record<number, number> = {};
  for (let i = 1; i <= 12; i++) remains[i] = stock[i];
  return { needFirst, make, remains };
}

// ---------- UI ----------

function buildCraftInventory(): void {
  const wrap = $('#craftInv');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 1; i <= 12; i++) {
    const row = document.createElement('div');
    row.className = 'inv-row';
    row.innerHTML = `
        <span class="badge orb">★${i}</span>
        <input type="number" id="invLv${i}" min="0" max="99999" step="1" value="0" />
      `;
    wrap.appendChild(row);
  }
}

function buildRecipesList(): void {
  const wrap = $('#recipesList');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let lv = 2; lv <= 12; lv++) {
    const parts = Object.entries(RECIPES[lv])
      .map(([sub, qty]) => `${qty}×★${sub}`)
      .join(' + ');
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.innerHTML = `<span class="badge orb">★${lv}</span> <span class="recipe-body">= ${parts}</span>`;
    wrap.appendChild(row);
  }
}

function readInventory(): Counts {
  const inv: Counts = {};
  for (let i = 1; i <= 12; i++) {
    const el = document.getElementById('invLv' + i) as HTMLInputElement | null;
    const v = el ? parseInt(el.value, 10) : NaN;
    inv[i] = Number.isFinite(v) && v > 0 ? Math.min(v, 99999) : 0;
  }
  return inv;
}

export function renderCraft(): void {
  const out = $('#craftResult');
  if (!out) return;
  const settings = getSettings();
  const inv = readInventory();
  const eggsEl = $<HTMLInputElement>('#craftEggs');
  const eggs = Math.max(0, Math.min(99999, parseInt(eggsEl?.value ?? '0', 10) || 0));
  const targetLv = Math.max(
    1,
    Math.min(12, parseInt(($<HTMLSelectElement>('#craftTarget')?.value ?? '12'), 10) || 12),
  );
  const qty = Math.max(1, Math.min(100, parseInt(($<HTMLInputElement>('#craftQty')?.value ?? '1'), 10) || 1));

  const parts: string[] = [];

  // Крок: симуляція яєць (якщо є)
  if (eggs > 0) {
    const eggDrops = simulateEggs(eggs);
    for (let lv = 1; lv <= 3; lv++) inv[lv] += eggDrops[lv];
    const dropLine =
      [1, 2, 3]
        .filter((lv) => eggDrops[lv] > 0)
        .map((lv) => `<span class="badge orb">★${lv}</span> × ${eggDrops[lv]}`)
        .join(', ') || '<span class="muted">нічого корисного</span>';
    parts.push(`
        <div class="banner info">
          Відкрито ${fmt(eggs)} яєць → ${dropLine}
        </div>
      `);
  }

  const plan = buildCraftPlan(inv, targetLv, qty);

  // Статистика вартості (в ★1-еквіваленті і в монетах)
  const targetEq = ONE_STAR_EQ[targetLv] * qty;
  const invEq = (() => {
    let s = 0;
    for (let i = 1; i <= 12; i++) s += (inv[i] || 0) * ONE_STAR_EQ[i];
    return s;
  })();
  const remainsEq = (() => {
    let s = 0;
    for (let i = 1; i <= 12; i++) s += (plan.remains[i] || 0) * ONE_STAR_EQ[i];
    return s;
  })();

  const eggPrice = getEggPrice();
  const oneStarCoinCost = eggPrice / EGG_EQ_ONE_STAR;
  const targetCoinCost = targetEq * oneStarCoinCost;
  const invCoinValue = invEq * oneStarCoinCost;
  const remainsCoinValue = remainsEq * oneStarCoinCost;
  const missingCoinCost = plan.needFirst * oneStarCoinCost;
  const missingEggs = plan.needFirst > 0 ? Math.ceil(plan.needFirst / EGG_EQ_ONE_STAR) : 0;

  parts.push(`
      <div class="result-summary">
        <div class="metric accent">
          <span class="metric-label">Ціль коштує</span>
          <span class="metric-value">${fmt(targetCoinCost)}</span>
          <span class="metric-sub">монет · ${fmtGold(targetCoinCost, settings.goldPrice)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Інвентар вартує</span>
          <span class="metric-value">${fmt(invCoinValue)}</span>
          <span class="metric-sub">монет · ${fmt(invEq)} ★1-екв</span>
        </div>
        <div class="metric ${plan.needFirst > 0 ? 'bad' : 'good'}">
          <span class="metric-label">${plan.needFirst > 0 ? 'Бракує ★1' : 'Хватає на крафт'}</span>
          <span class="metric-value">${plan.needFirst > 0 ? fmt(plan.needFirst) : '✓'}</span>
          <span class="metric-sub">${plan.needFirst > 0 ? '≈ ' + fmt(missingEggs) + ' яєць · ' + fmtGold(missingCoinCost, settings.goldPrice) : 'або надлишок інвентарю'}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Залишок після крафту</span>
          <span class="metric-value">${fmt(remainsCoinValue)}</span>
          <span class="metric-sub">монет · ${fmt(remainsEq)} ★1-екв</span>
        </div>
      </div>
    `);

  // Попередження про нестачу
  if (plan.needFirst > 0) {
    parts.push(`
        <div class="banner" style="color:#ffc2c6;background:rgba(255,94,108,0.06);border-color:rgba(255,94,108,0.35)">
          <b>Не вистачає шарів для повного крафту.</b><br/>
          Докупити <b>${fmt(plan.needFirst)}</b> × <span class="badge orb">★1</span>
          (${fmt(missingCoinCost)} монет · ${fmtGold(missingCoinCost, settings.goldPrice)}).
          Орієнтовно <b>${fmt(missingEggs)}</b> золотих яєць, якщо вибивати з яєць.
        </div>
      `);
  } else {
    // План крафту
    const steps: string[] = [];
    let idx = 1;
    for (let lv = 2; lv <= 12; lv++) {
      const c = plan.make[lv];
      if (c > 0) {
        const recipe = Object.entries(RECIPES[lv])
          .map(([sub, qty]) => `${qty * c} × <span class="badge orb">★${sub}</span>`)
          .join(' + ');
        steps.push(`
            <div class="craft-step">
              <span class="step-idx">${idx++}</span>
              Скрафтити <b style="color:var(--accent-2)">${c}</b> ×
              <span class="badge orb">★${lv}</span> з ${recipe}
            </div>
          `);
      }
    }
    if (steps.length === 0) {
      parts.push('<div class="banner info">Нічого крафтити — у інвентарі вже є потрібні шари.</div>');
    } else {
      parts.push(`<div class="craft-steps"><h3 class="craft-h">План крафту</h3>${steps.join('')}</div>`);
    }

    // Залишки
    const leftovers = Object.entries(plan.remains).filter(([, q]) => q > 0);
    if (leftovers.length > 0) {
      const list = leftovers
        .map(([lv, q]) => `<span class="badge orb">★${lv}</span> × ${q}`)
        .join(', ');
      parts.push(`
          <div class="craft-leftovers">
            <h3 class="craft-h">Залишки в інвентарі</h3>
            <div class="leftover-line">${list}</div>
          </div>
        `);
    }
  }

  out.innerHTML = parts.join('');
}

export function initCraft(): void {
  buildCraftInventory();
  buildRecipesList();

  const calc = $('#craftCalc');
  if (calc) calc.addEventListener('click', renderCraft);
  const reset = $('#craftReset');
  if (reset) {
    reset.addEventListener('click', () => {
      for (let i = 1; i <= 12; i++) {
        const el = $<HTMLInputElement>('#invLv' + i);
        if (el) el.value = '0';
      }
      const eggsEl = $<HTMLInputElement>('#craftEggs');
      if (eggsEl) eggsEl.value = '0';
      const res = $('#craftResult');
      if (res) res.innerHTML = '';
    });
  }
}
