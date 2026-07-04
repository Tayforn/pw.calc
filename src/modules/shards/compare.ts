// =========================================================
// ПОРІВНЯННЯ (Шари vs Камені)
// =========================================================

import type { ItemType } from '../../types';
import { $ } from '../../utils/dom';
import { fmt, fmtGold } from '../../utils/format';
import { getSettings } from '../../settings';
import { getEggPrice } from '../../settings/eggPrice';
import { STONE_META, buildPlan } from '../refine/data';
import { ONE_STAR_EQ, RECIPES } from './data';
import { computeEggsTable } from '../../lib/shards';

export function initCompare(onRender: () => void): void {
  const compareForm = $('#compareForm');
  if (compareForm) compareForm.addEventListener('change', onRender);
}

export function renderCompare(): void {
  const out = $('#compareResult');
  if (!out) return;
  const settings = getSettings();

  const itemTypeEl = $<HTMLInputElement>('input[name="cmpType"]:checked');
  const itemType = (itemTypeEl?.value ?? 'armor') as ItemType;
  const { cumCost, plan } = buildPlan(itemType, 'auto', settings);
  const eggs = computeEggsTable(getEggPrice());
  const eggPrice = getEggPrice();

  let stoneWins = 0;
  let orbWins = 0;
  const tableRows: string[] = [];

  const orbEggsByLevel: number[] = [0];
  for (let k = 1; k <= 12; k++) {
    orbEggsByLevel[k] = orbEggsByLevel[k - 1] + eggs[k - 1].eggs;
  }
  const orbCumByLevel = orbEggsByLevel.map((e) => e * eggPrice);

  for (let n = 1; n <= 12; n++) {
    const stoneCum = cumCost[n];
    const stoneStep = plan[n - 1].stepCost;
    const orbStepEggs = eggs[n - 1].eggs;
    const orbCumEggs = orbEggsByLevel[n];
    const orbCum = orbCumByLevel[n];
    const orbStep = orbStepEggs * eggPrice;

    const diff = stoneCum - orbCum;
    const winner = Math.abs(diff) < 1 ? 'tie' : diff > 0 ? 'orb' : 'stones';
    if (winner === 'orb') orbWins++;
    if (winner === 'stones') stoneWins++;

    const savings = Math.abs(diff);
    const maxCost = Math.max(stoneCum, orbCum);
    const savingsPct = maxCost > 0 ? (savings / maxCost) * 100 : 0;
    const winnerBadge =
      winner === 'orb'
        ? '<span class="badge good">Шар</span>'
        : winner === 'stones'
          ? '<span class="badge good">Камені</span>'
          : '<span class="badge">Однаково</span>';

    const stepDiff = stoneStep - orbStep;
    const stepWinner = Math.abs(stepDiff) < 1 ? 'tie' : stepDiff > 0 ? 'orb' : 'stones';
    const stepSavings = Math.abs(stepDiff);
    const maxStep = Math.max(stoneStep, orbStep);
    const stepSavingsPct = maxStep > 0 ? (stepSavings / maxStep) * 100 : 0;
    const chosenStone = STONE_META[plan[n - 1].method];

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

    const tipBodyStep =
      `${recipeStr}. ` +
      `Яєць у середньому: ⌈${stepEq}/1.95⌉ = ${orbStepEggs} ` +
      `(одне яйце дає 0.71·1 + 0.11·4 + 0.08·10 = 1.95 ★1). ` +
      `Ціна = ${orbStepEggs} × ${fmt(eggPrice)} монет за яйце = ${fmt(orbStep)} монет.`;

    const tipBodyCum =
      `Сума ★1..★${n}: щоб дійти до +${n} треба весь ланцюжок шарів ` +
      `(★N піднімає лише на 1 рівень). Загалом ${cumEq} ★1-екв. ` +
      `Яєць сумарно: ${orbCumEggs}. Ціна = ${orbCumEggs} × ${fmt(eggPrice)} = ${fmt(orbCum)} монет.`;

    tableRows.push(`
        <tr class="${winner !== 'tie' ? 'winner' : ''}">
          <td><b>+${n}</b></td>
          <td class="num">
            ${fmt(stoneCum)}
            <div class="sub">${fmtGold(stoneCum, settings.goldPrice)}</div>
          </td>
          <td class="num">
            <span class="has-tip" tabindex="0">${fmt(orbCum)}<span class="tip-body">${tipBodyCum}</span></span>
            <div class="sub">${fmt(orbCumEggs)} яєць</div>
          </td>
          <td class="num">
            ${fmt(stoneStep)}
            <div class="sub">${fmtGold(stoneStep, settings.goldPrice)}</div>
          </td>
          <td class="num">
            <span class="has-tip" tabindex="0">${fmt(orbStep)}<span class="tip-body">${tipBodyStep}</span></span>
            <div class="sub">${fmt(orbStepEggs)} яєць</div>
          </td>
          <td><span class="badge ${chosenStone.cls}">${chosenStone.label}</span></td>
          <td class="num">
            <span class="badge orb">★${n}</span>
            <div class="sub">${fmt(eggs[n - 1].eggs)} яєць</div>
          </td>
          <td>${winnerBadge}</td>
          <td class="num">
            ${winner === 'tie' ? '—' : fmt(savings)}
            <div class="sub">${savingsPct.toFixed(1)}%</div>
          </td>
          <td class="num">
            ${stepWinner === 'tie' ? '—' : fmt(stepSavings)}
            <div class="sub">${stepWinner === 'tie' ? '' : `${stepSavingsPct.toFixed(1)}%`}</div>
          </td>
        </tr>
      `);
  }

  const summary = `
      <div class="result-summary">
        <div class="metric">
          <span class="metric-label">Камені вигідні</span>
          <span class="metric-value">${stoneWins}</span>
          <span class="metric-sub">із 12 рівнів</span>
        </div>
        <div class="metric">
          <span class="metric-label">Шари вигідні</span>
          <span class="metric-value">${orbWins}</span>
          <span class="metric-sub">із 12 рівнів</span>
        </div>
        <div class="metric">
          <span class="metric-label">+12 камнями</span>
          <span class="metric-value">${fmtGold(cumCost[12], settings.goldPrice)}</span>
          <span class="metric-sub">${fmt(cumCost[12])} монет</span>
        </div>
        <div class="metric accent">
          <span class="metric-label">+12 шарами ★1..★12</span>
          <span class="metric-value">${fmt(orbCumByLevel[12])}</span>
          <span class="metric-sub">${fmt(orbEggsByLevel[12])} яєць · ${fmt(eggPrice)}/яйце</span>
        </div>
      </div>
    `;

  out.innerHTML = `
      ${summary}
      <div class="table-wrap">
        <table class="data-table compare-table">
          <thead>
            <tr>
              <th>Рівень</th>
              <th class="num">Загальна ціна<br><small>камені</small></th>
              <th class="num">Загальна ціна<br><small>шари</small></th>
              <th class="num">Ціна за рівень<br><small>камені</small></th>
              <th class="num">Ціна за рівень<br><small>шари</small></th>
              <th>Оптим. камінь</th>
              <th class="num">Шаром ★N</th>
              <th>Дешевше</th>
              <th class="num">Економія</th>
              <th class="num">Економія за рівень</th>
            </tr>
          </thead>
          <tbody>${tableRows.join('')}</tbody>
        </table>
      </div>
      <p class="muted" style="margin-top:12px;font-size:13px">
        <b>Загальна ціна (камені)</b> — сумарна очікувана вартість пройти
        з +0 до +N оптимальним поєднанням каменів (у монетах).
        <b>Загальна ціна (шари)</b> — <code>сумарні_яйця × ціна_яйця</code>;
        один ★N орб підвищує лише на 1 рівень, тож щоб дійти до +N
        треба весь ланцюжок ★1+★2+…+★N.
        <b>Ціна за рівень (шари)</b> — <code>яйця(★N) × ціна_яйця</code>.
        <b>Шаром ★N</b> — кількість золотих яєць у середньому на 1 шар
        відповідного рівня. Ціна яйця змінюється у полі над таблицею
        (дефолт = 2 × ціна голди, тобто 1 яйце ≈ 1 ★1 шар).
      </p>
    `;
}
