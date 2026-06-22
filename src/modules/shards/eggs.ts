// =========================================================
// ЯЙЦЯ — вартість шарів
// =========================================================

import { $ } from '../../utils/dom';
import { fmt, fmtGold } from '../../utils/format';
import { getSettings } from '../../settings';
import { getEggPrice } from '../../settings/eggPrice';
import { EGGS_FOR_LEVEL } from './data';

interface EggRow {
  level: number;
  eggs: number;
  coinCost: number;
}

export function computeEggsTable(): EggRow[] {
  const rows: EggRow[] = [];
  const eggPrice = getEggPrice();
  for (let lvl = 1; lvl <= 12; lvl++) {
    const eggsCount = EGGS_FOR_LEVEL[lvl];
    rows.push({ level: lvl, eggs: eggsCount, coinCost: eggsCount * eggPrice });
  }
  return rows;
}

export function renderEggs(): void {
  const out = $('#eggResult');
  if (!out) return;
  const settings = getSettings();
  const rows = computeEggsTable();

  const pick = (lvl: number): EggRow => rows[lvl - 1];
  const summary = `
      <div class="result-summary">
        <div class="metric accent">
          <span class="metric-label">Шар ★1</span>
          <span class="metric-value">${fmt(pick(1).eggs)}</span>
          <span class="metric-sub">яєць · ${fmt(pick(1).coinCost)} монет</span>
        </div>
        <div class="metric">
          <span class="metric-label">Шар ★6</span>
          <span class="metric-value">${fmt(pick(6).eggs)}</span>
          <span class="metric-sub">яєць · ${fmtGold(pick(6).coinCost, settings.goldPrice)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Шар ★10</span>
          <span class="metric-value">${fmt(pick(10).eggs)}</span>
          <span class="metric-sub">яєць · ${fmtGold(pick(10).coinCost, settings.goldPrice)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Шар ★12</span>
          <span class="metric-value">${fmt(pick(12).eggs)}</span>
          <span class="metric-sub">яєць · ${fmtGold(pick(12).coinCost, settings.goldPrice)}</span>
        </div>
      </div>
    `;

  const tableRows = rows
    .map((r, i) => {
      const prev = i > 0 ? rows[i - 1].coinCost : 0;
      const step = r.coinCost - prev;
      return `
        <tr>
          <td><span class="badge orb">★${r.level}</span></td>
          <td class="num">${fmt(r.eggs)}</td>
          <td class="num">
            ${fmt(r.coinCost)}
            <div class="sub">${fmtGold(r.coinCost, settings.goldPrice)}</div>
          </td>
          <td class="num">
            ${fmt(step)}
            <div class="sub">${fmtGold(step, settings.goldPrice)}</div>
          </td>
        </tr>
      `;
    })
    .join('');

  out.innerHTML = `
      <div class="banner info">
        Ціна шара ★N = <code>яйця(★N) × ціна яйця</code>.
        Поточна ціна яйця: <b>${fmt(getEggPrice())}</b> монет (поле над таблицею).
        Кількість яєць — ймовірнісна оцінка <code>⌈★1-екв(N)/1.95⌉</code>.
      </div>
      ${summary}
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Шар</th>
              <th class="num">Потрібно яєць</th>
              <th class="num">Загальна ціна</th>
              <th class="num">Ціна за рівень</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <p class="muted" style="margin-top:12px;font-size:13px">
        «Загальна ціна» — вартість одного шара ★N (з нуля). «Ціна за рівень» —
        наскільки дорожчий шар цього рівня порівняно з попереднім.
      </p>
    `;
}
