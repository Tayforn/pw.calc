// =========================================================
// Порівняння «Шари vs Камені» — ідіоматичний React (фаза 3).
// Розрахунок — src/lib/shards.ts (computeCompare); legacy renderCompare видалено.
// Тултіпи .has-tip відкриває делегований клік-слухач у legacyInit.
// =========================================================

import { useState } from 'react';
import type { ItemType } from '../types';
import { fmt, fmtGold } from '../utils/format';
import { STONE_META } from '../modules/refine/data';
import { computeCompare } from '../lib/shards';
import { useEggPriceTick, useSettings } from '../app/useSettings';
import { getEggPrice } from '../settings/eggPrice';

export default function ComparePage() {
  const settings = useSettings();
  useEggPriceTick();
  const [itemType, setItemType] = useState<ItemType>('armor');
  const eggPrice = getEggPrice();
  const res = computeCompare(itemType, settings, eggPrice);

  const winnerBadge = (w: 'stones' | 'orb' | 'tie') =>
    w === 'orb' ? (
      <span className="badge good">Шар</span>
    ) : w === 'stones' ? (
      <span className="badge good">Камені</span>
    ) : (
      <span className="badge">Однаково</span>
    );

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Порівняння методів</span>
        <h2>Шари vs Камені</h2>
        <p>
          Два шляхи дістати предмет +N: заточувати камінням та міражами або
          купити/скрафтити шар ★N (миттєво +N). Нижче — вартість обох для
          кожного рівня, з визначенням переможця.
        </p>
      </header>

      <div className="card calc-card">
        <form id="compareForm" className="grid-form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label>Тип предмета</label>
            <div className="segmented" role="radiogroup" aria-label="Тип предмета">
              <input type="radio" id="cmpArmor" name="cmpType" checked={itemType === 'armor'} onChange={() => setItemType('armor')} />
              <label htmlFor="cmpArmor">Броня</label>
              <input type="radio" id="cmpWeapon" name="cmpType" checked={itemType === 'weapon'} onChange={() => setItemType('weapon')} />
              <label htmlFor="cmpWeapon">Зброя</label>
            </div>
          </div>
          <div className="field">
            <label htmlFor="eggPrice">Ціна 1 яйця (монет)</label>
            {/* некерований: значення синхронізує legacy settings/eggPrice між табами */}
            <input type="number" id="eggPrice" className="egg-price-input" min="0" step="1000" />
            <small className="hint">Дефолт: 2 × ціна голди. Спільне поле з іншими табами. Колонки шарів = <code>яйця × ціна яйця</code>.</small>
          </div>
        </form>

        <div id="compareResult" className="result" aria-live="polite">
          <div className="result-summary">
            <div className="metric">
              <span className="metric-label">Камені вигідні</span>
              <span className="metric-value">{res.stoneWins}</span>
              <span className="metric-sub">із 12 рівнів</span>
            </div>
            <div className="metric">
              <span className="metric-label">Шари вигідні</span>
              <span className="metric-value">{res.orbWins}</span>
              <span className="metric-sub">із 12 рівнів</span>
            </div>
            <div className="metric">
              <span className="metric-label">+12 камнями</span>
              <span className="metric-value">{fmtGold(res.stoneCum12, settings.goldPrice)}</span>
              <span className="metric-sub">{fmt(res.stoneCum12)} монет</span>
            </div>
            <div className="metric accent">
              <span className="metric-label">+12 шарами ★1..★12</span>
              <span className="metric-value">{fmt(res.orbCum12)}</span>
              <span className="metric-sub">{fmt(res.orbCumEggs12)} яєць · {fmt(eggPrice)}/яйце</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th>Рівень</th>
                  <th className="num">Загальна ціна<br /><small>камені</small></th>
                  <th className="num">Загальна ціна<br /><small>шари</small></th>
                  <th className="num">Ціна за рівень<br /><small>камені</small></th>
                  <th className="num">Ціна за рівень<br /><small>шари</small></th>
                  <th>Оптим. камінь</th>
                  <th className="num">Шаром ★N</th>
                  <th>Дешевше</th>
                  <th className="num">Економія</th>
                  <th className="num">Економія за рівень</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((r) => {
                  const stone = STONE_META[r.method];
                  const tipCum =
                    `Сума ★1..★${r.n}: щоб дійти до +${r.n} треба весь ланцюжок шарів ` +
                    `(★N піднімає лише на 1 рівень). Загалом ${r.cumEq} ★1-екв. ` +
                    `Яєць сумарно: ${r.orbCumEggs}. Ціна = ${r.orbCumEggs} × ${fmt(eggPrice)} = ${fmt(r.orbCum)} монет.`;
                  const tipStep =
                    `${r.recipeStr}. Яєць у середньому: ⌈${r.stepEq}/1.95⌉ = ${r.orbStepEggs} ` +
                    `(одне яйце дає 0.71·1 + 0.11·4 + 0.08·10 = 1.95 ★1). ` +
                    `Ціна = ${r.orbStepEggs} × ${fmt(eggPrice)} монет за яйце = ${fmt(r.orbStep)} монет.`;
                  return (
                    <tr key={r.n} className={r.winner !== 'tie' ? 'winner' : undefined}>
                      <td><b>+{r.n}</b></td>
                      <td className="num">
                        {fmt(r.stoneCum)}
                        <div className="sub">{fmtGold(r.stoneCum, settings.goldPrice)}</div>
                      </td>
                      <td className="num">
                        <span className="has-tip" tabIndex={0}>{fmt(r.orbCum)}<span className="tip-body">{tipCum}</span></span>
                        <div className="sub">{fmt(r.orbCumEggs)} яєць</div>
                      </td>
                      <td className="num">
                        {fmt(r.stoneStep)}
                        <div className="sub">{fmtGold(r.stoneStep, settings.goldPrice)}</div>
                      </td>
                      <td className="num">
                        <span className="has-tip" tabIndex={0}>{fmt(r.orbStep)}<span className="tip-body">{tipStep}</span></span>
                        <div className="sub">{fmt(r.orbStepEggs)} яєць</div>
                      </td>
                      <td><span className={'badge ' + stone.cls}>{stone.label}</span></td>
                      <td className="num">
                        <span className="badge orb">★{r.n}</span>
                        <div className="sub">{fmt(r.orbStepEggs)} яєць</div>
                      </td>
                      <td>{winnerBadge(r.winner)}</td>
                      <td className="num">
                        {r.winner === 'tie' ? '—' : fmt(r.savings)}
                        <div className="sub">{r.savingsPct.toFixed(1)}%</div>
                      </td>
                      <td className="num">
                        {r.stepWinner === 'tie' ? '—' : fmt(r.stepSavings)}
                        <div className="sub">{r.stepWinner === 'tie' ? '' : `${r.stepSavingsPct.toFixed(1)}%`}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
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
        </div>
      </div>
    </>
  );
}
