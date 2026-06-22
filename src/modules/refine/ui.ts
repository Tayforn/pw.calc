// =========================================================
// ЗАТОЧКА — UI
// =========================================================

import type { ItemType, MethodSelection, PlanStep } from '../../types';
import { $ } from '../../utils/dom';
import { fmt, fmt2, fmtGold } from '../../utils/format';
import { getSettings } from '../../settings';
import { STONE_META, buildPlan, totalsForPlan } from './data';

export function initRefine(onRender: () => void): void {
  const refineForm = $('#refineForm');
  if (refineForm) refineForm.addEventListener('change', onRender);
}

export function renderRefine(): void {
  const settings = getSettings();
  const refineResult = $('#refineResult');
  if (!refineResult) return;

  const itemTypeEl = $<HTMLInputElement>('input[name="itemType"]:checked');
  const itemType = (itemTypeEl?.value ?? 'armor') as ItemType;
  const start = parseInt(($<HTMLSelectElement>('#startLevel')?.value ?? '0'), 10);
  const target = parseInt(($<HTMLSelectElement>('#targetLevel')?.value ?? '12'), 10);
  const method = ($<HTMLSelectElement>('#stoneStrategy')?.value ?? 'auto') as MethodSelection;

  if (start >= target) {
    refineResult.innerHTML =
      '<div class="banner">Цільовий рівень має бути вищим за поточний.</div>';
    return;
  }

  const { cumCost, plan } = buildPlan(itemType, method, settings);
  const stepsAll: Array<PlanStep & { level: number }> = plan.map((p, i) => ({
    ...p,
    level: i + 1,
  }));
  const steps = stepsAll.filter((s) => s.level > start && s.level <= target);

  const totalCoins = cumCost[target] - cumCost[start];
  const totals = totalsForPlan(plan, steps, itemType);

  const banner = `
      <div class="banner info">
        Очікувана вартість з +${start} до +${target}:
        <b>${fmt(totalCoins)}</b> монет · <b>${fmtGold(totalCoins, settings.goldPrice)}</b>
        &nbsp;·&nbsp; міражів: <b>${fmt(totals.mirages)}</b>
      </div>
    `;

  const rows = steps
    .map((s) => {
      const meta = STONE_META[s.method];
      const cumHere = cumCost[s.level] - cumCost[start];
      return `
        <tr>
          <td><b>+${s.level}</b></td>
          <td><span class="badge ${meta.cls}">${meta.label}</span></td>
          <td class="num">${(s.successRate * 100).toFixed(2)}%</td>
          <td class="num">${fmt2(1 / s.successRate)}</td>
          <td class="num">
            ${fmt(cumHere)}
            <div class="sub">${fmtGold(cumHere, settings.goldPrice)}</div>
          </td>
          <td class="num">
            ${fmt(s.stepCost)}
            <div class="sub">${fmtGold(s.stepCost, settings.goldPrice)}</div>
          </td>
        </tr>`;
    })
    .join('');

  refineResult.innerHTML = `
      ${banner}
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Рівень</th>
              <th>Метод</th>
              <th class="num">Шанс</th>
              <th class="num">Спроб, сер.</th>
              <th class="num">Загальна ціна</th>
              <th class="num">Ціна за рівень</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="muted" style="margin-top:12px;font-size:13px">
        «Загальна ціна» — сумарна очікувана вартість з поточного рівня
        (+${start}) до даного. «Ціна за рівень» — наскільки збільшується
        ця сума на цьому кроці. Формула кроку враховує штраф повернення:
        <code>E = (вартість_спроби + (1−p)·штраф) / p</code>.
      </p>
    `;
}
