// =========================================================
// Вартість шарів — ідіоматичний React (фаза 3; legacy renderEggs видалено).
// Ціна яйця — спільний legacy-інпут (.egg-price-input, синхронізується
// між табами модулем settings/eggPrice) → useEggPriceTick.
// =========================================================

import { useEggPriceTick, useSettings } from '../app/useSettings';
import { getEggPrice } from '../settings/eggPrice';
import { fmt, fmtGold } from '../utils/format';
import { computeEggsTable, type EggRow } from '../lib/shards';

function Metric({ label, row, gold, accent }: { label: string; row: EggRow; gold?: number; accent?: boolean }) {
  return (
    <div className={'metric' + (accent ? ' accent' : '')}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{fmt(row.eggs)}</span>
      <span className="metric-sub">яєць · {gold == null ? fmt(row.coinCost) + ' монет' : fmtGold(row.coinCost, gold)}</span>
    </div>
  );
}

export default function EggsPage() {
  const settings = useSettings();
  useEggPriceTick();
  const eggPrice = getEggPrice();
  const rows = computeEggsTable(eggPrice);
  const pick = (lvl: number): EggRow => rows[lvl - 1];

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Драконячі шари · ціна</span>
        <h2>Вартість шарів</h2>
        <p>
          Ціна 1 ★1 шара — фіксовані <b>2 голди</b>. Вартість ★N
          обчислюється з ★1-еквіваленту (за рецептом крафту). Поряд
          показано ймовірнісну оцінку, скільки треба золотих яєць,
          щоб набити такий ★1-еквівалент.
        </p>
      </header>

      <div className="card calc-card">
        <form className="grid-form" autoComplete="off" style={{ marginBottom: 14 }} onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="eggPriceEggs">Ціна 1 яйця (монет)</label>
            {/* некерований: значення синхронізує legacy settings/eggPrice між табами */}
            <input type="number" id="eggPriceEggs" className="egg-price-input" min="0" step="1000" />
            <small className="hint">Дефолт: 2 × ціна голди. Спільне поле з іншими табами.</small>
          </div>
        </form>
        <div id="eggResult" className="result" aria-live="polite">
          <div className="banner info">
            Ціна шара ★N = <code>яйця(★N) × ціна яйця</code>.
            Поточна ціна яйця: <b>{fmt(eggPrice)}</b> монет (поле над таблицею).
            Кількість яєць — ймовірнісна оцінка <code>⌈★1-екв(N)/1.95⌉</code>.
          </div>
          <div className="result-summary">
            <Metric label="Шар ★1" row={pick(1)} accent />
            <Metric label="Шар ★6" row={pick(6)} gold={settings.goldPrice} />
            <Metric label="Шар ★10" row={pick(10)} gold={settings.goldPrice} />
            <Metric label="Шар ★12" row={pick(12)} gold={settings.goldPrice} />
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Шар</th>
                  <th className="num">Потрібно яєць</th>
                  <th className="num">Загальна ціна</th>
                  <th className="num">Ціна за рівень</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const step = r.coinCost - (i > 0 ? rows[i - 1].coinCost : 0);
                  return (
                    <tr key={r.level}>
                      <td><span className="badge orb">★{r.level}</span></td>
                      <td className="num">{fmt(r.eggs)}</td>
                      <td className="num">
                        {fmt(r.coinCost)}
                        <div className="sub">{fmtGold(r.coinCost, settings.goldPrice)}</div>
                      </td>
                      <td className="num">
                        {fmt(step)}
                        <div className="sub">{fmtGold(step, settings.goldPrice)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            «Загальна ціна» — вартість одного шара ★N (з нуля). «Ціна за рівень» —
            наскільки дорожчий шар цього рівня порівняно з попереднім.
          </p>
        </div>
      </div>

      <details className="note">
        <summary>Методика</summary>
        <p>
          Вартість: <code>ціна(★N) = ★1-екв(N) × 2 голди</code>, де
          ★1-екв виводиться з рецепта (★2=4, ★3=10, …, ★12=4645).
        </p>
        <p>
          Яйця: 71% — ★1, 11% — ★2, 8% — ★3, 10% — міраж.
          Очікувана «вага» яйця в ★1: <code>0.71·1 + 0.11·4 + 0.08·10 = 1.95</code>.
          Орієнтовна кількість яєць — <code>⌈★1-екв(N) / 1.95⌉</code>.
        </p>
      </details>
    </>
  );
}
