// =========================================================
// Крафт шарів — ідіоматичний React (фаза 3).
// Розрахунок (з рандомом яєць) виконується ЛИШЕ по кнопці й зберігається
// в state; чисті simulateEggs/buildCraftPlan — у src/lib/shards.ts.
// =========================================================

import { useState } from 'react';
import { fmt, fmtGold } from '../utils/format';
import { EGG_EQ_ONE_STAR, ONE_STAR_EQ, RECIPES } from '../modules/shards/data';
import { buildCraftPlan, simulateEggs, type Counts, type CraftPlan } from '../lib/shards';
import { useSettings } from '../app/useSettings';
import { getEggPrice } from '../settings/eggPrice';

const LEVELS = Array.from({ length: 12 }, (_, i) => i + 1);
const clampInt = (v: string, min: number, max: number, dflt: number) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
};

interface CraftResult {
  eggsOpened: number;
  eggDrops: Counts | null;
  plan: CraftPlan;
  needFirst: number;
  targetCoinCost: number;
  invCoinValue: number;
  invEq: number;
  remainsCoinValue: number;
  remainsEq: number;
  missingCoinCost: number;
  missingEggs: number;
  goldPrice: number;
}

export default function CraftPage() {
  const settings = useSettings();
  const [inv, setInv] = useState<Counts>(() => Object.fromEntries(LEVELS.map((l) => [l, 0])));
  const [eggs, setEggs] = useState('0');
  const [targetLv, setTargetLv] = useState('12');
  const [qty, setQty] = useState('1');
  const [result, setResult] = useState<CraftResult | null>(null);

  const setInvLv = (lv: number, v: string) =>
    setInv((prev) => ({ ...prev, [lv]: clampInt(v, 0, 99999, 0) }));

  const calc = () => {
    const eggsN = clampInt(eggs, 0, 99999, 0);
    const tLv = clampInt(targetLv, 1, 12, 12);
    const q = clampInt(qty, 1, 100, 1);

    // Робоча копія інвентарю + випадкові дропи з яєць.
    const work: Counts = { ...inv };
    let eggDrops: Counts | null = null;
    if (eggsN > 0) {
      eggDrops = simulateEggs(eggsN);
      for (let lv = 1; lv <= 3; lv++) work[lv] = (work[lv] || 0) + eggDrops[lv];
    }

    const plan = buildCraftPlan(work, tLv, q);

    const targetEq = ONE_STAR_EQ[tLv] * q;
    let invEq = 0;
    let remainsEq = 0;
    for (let i = 1; i <= 12; i++) {
      invEq += (work[i] || 0) * ONE_STAR_EQ[i];
      remainsEq += (plan.remains[i] || 0) * ONE_STAR_EQ[i];
    }
    const oneStarCoinCost = getEggPrice() / EGG_EQ_ONE_STAR;

    setResult({
      eggsOpened: eggsN,
      eggDrops,
      plan,
      needFirst: plan.needFirst,
      targetCoinCost: targetEq * oneStarCoinCost,
      invCoinValue: invEq * oneStarCoinCost,
      invEq,
      remainsCoinValue: remainsEq * oneStarCoinCost,
      remainsEq,
      missingCoinCost: plan.needFirst * oneStarCoinCost,
      missingEggs: plan.needFirst > 0 ? Math.ceil(plan.needFirst / EGG_EQ_ONE_STAR) : 0,
      goldPrice: settings.goldPrice,
    });
  };

  const reset = () => {
    setInv(Object.fromEntries(LEVELS.map((l) => [l, 0])));
    setEggs('0');
    setResult(null);
  };

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Крафт шарів · інвентар</span>
        <h2>Калькулятор крафта шарів дракона</h2>
        <p>
          Вкажи, які шари вже є в інвентарі, обери ціль — отримаєш покроковий
          план крафту з урахуванням залишків. Опційно можна «відкрити» партію
          золотих яєць і додати випадкові дропи до інвентарю.
        </p>
        <div className="banner" style={{ marginTop: 10 }}>
          <b>Увага:</b> відкриття яєць — це <b>рандом</b>. Кожне натискання
          «Розрахувати» з ненульовим полем «Яйця» генерує нові випадкові дропи,
          тому результати щоразу будуть різні.
          <br /><br />
          {' '}Натомість значення в блоках статистики (скільки яєць на ★1, вартість
          нестачі тощо) — це <b>середнє очікування</b>:{' '}
          <code>0.71·1 + 0.11·4 + 0.08·10 = 1.95</code> ★1-еквівалента з
          одного яйця (71% дає ★1 = 1, 11% дає ★2 = 4×★1, 8% дає ★3 = 10×★1,
          10% — камінь, не враховується).
        </div>
      </header>

      <div className="card calc-card">
        <form className="grid-form" autoComplete="off" style={{ marginBottom: 14 }} onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="eggPriceCraft">Ціна 1 яйця (монет)</label>
            {/* некерований: значення синхронізує legacy settings/eggPrice між табами */}
            <input type="number" id="eggPriceCraft" className="egg-price-input" min="0" step="1000" />
            <small className="hint">Дефолт: 2 × ціна голди. Спільне поле з іншими табами.</small>
          </div>
        </form>
        <div className="craft-grid">
          <div>
            <h3 className="craft-h">Інвентар (вже є)</h3>
            <div id="craftInv" className="craft-inv">
              {LEVELS.map((lv) => (
                <div key={lv} className="inv-row">
                  <span className="badge orb">★{lv}</span>
                  <input
                    type="number"
                    id={'invLv' + lv}
                    min={0}
                    max={99999}
                    step={1}
                    value={inv[lv]}
                    onChange={(e) => setInvLv(lv, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="craft-egg-row">
              <label htmlFor="craftEggs"><span className="badge orb">Яйця</span> відкрити</label>
              <input type="number" id="craftEggs" min={0} max={99999} step={1} value={eggs} onChange={(e) => setEggs(e.target.value)} />
              <small className="hint">Симулює випадковий дроп: 71% ★1, 11% ★2, 8% ★3, 10% камінь.</small>
            </div>
          </div>

          <div>
            <h3 className="craft-h">Що крафтимо</h3>
            <div className="craft-form">
              <div className="field">
                <label htmlFor="craftTarget">Рівень цілі</label>
                <select id="craftTarget" value={targetLv} onChange={(e) => setTargetLv(e.target.value)}>
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>★{lv}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="craftQty">Кількість</label>
                <input type="number" id="craftQty" min={1} max={100} step={1} value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="field craft-actions">
                <button type="button" id="craftCalc" className="btn btn-primary" onClick={calc}>Розрахувати</button>
                <button type="button" id="craftReset" className="btn btn-ghost" onClick={reset}>Очистити інвентар</button>
              </div>
            </div>

            <h3 className="craft-h" style={{ marginTop: 18 }}>Рецепти</h3>
            <div className="recipes-grid" id="recipesList">
              {LEVELS.filter((lv) => lv >= 2).map((lv) => (
                <div key={lv} className="recipe-row">
                  <span className="badge orb">★{lv}</span>{' '}
                  <span className="recipe-body">
                    = {Object.entries(RECIPES[lv]).map(([sub, q]) => `${q}×★${sub}`).join(' + ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="craftResult" className="result" aria-live="polite">
          {result && <CraftResultView r={result} />}
        </div>
      </div>
    </>
  );
}

function CraftResultView({ r }: { r: CraftResult }) {
  const steps = LEVELS.filter((lv) => lv >= 2 && r.plan.make[lv] > 0);
  const leftovers = LEVELS.filter((lv) => (r.plan.remains[lv] || 0) > 0);

  return (
    <>
      {r.eggDrops && (
        <div className="banner info">
          Відкрито {fmt(r.eggsOpened)} яєць →{' '}
          {[1, 2, 3].filter((lv) => r.eggDrops![lv] > 0).length === 0 ? (
            <span className="muted">нічого корисного</span>
          ) : (
            [1, 2, 3]
              .filter((lv) => r.eggDrops![lv] > 0)
              .map((lv, i) => (
                <span key={lv}>
                  {i > 0 && ', '}
                  <span className="badge orb">★{lv}</span> × {r.eggDrops![lv]}
                </span>
              ))
          )}
        </div>
      )}

      <div className="result-summary">
        <div className="metric accent">
          <span className="metric-label">Ціль коштує</span>
          <span className="metric-value">{fmt(r.targetCoinCost)}</span>
          <span className="metric-sub">монет · {fmtGold(r.targetCoinCost, r.goldPrice)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Інвентар вартує</span>
          <span className="metric-value">{fmt(r.invCoinValue)}</span>
          <span className="metric-sub">монет · {fmt(r.invEq)} ★1-екв</span>
        </div>
        <div className={'metric ' + (r.needFirst > 0 ? 'bad' : 'good')}>
          <span className="metric-label">{r.needFirst > 0 ? 'Бракує ★1' : 'Хватає на крафт'}</span>
          <span className="metric-value">{r.needFirst > 0 ? fmt(r.needFirst) : '✓'}</span>
          <span className="metric-sub">
            {r.needFirst > 0 ? '≈ ' + fmt(r.missingEggs) + ' яєць · ' + fmtGold(r.missingCoinCost, r.goldPrice) : 'або надлишок інвентарю'}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Залишок після крафту</span>
          <span className="metric-value">{fmt(r.remainsCoinValue)}</span>
          <span className="metric-sub">монет · {fmt(r.remainsEq)} ★1-екв</span>
        </div>
      </div>

      {r.needFirst > 0 ? (
        <div className="banner" style={{ color: '#ffc2c6', background: 'rgba(255,94,108,0.06)', borderColor: 'rgba(255,94,108,0.35)' }}>
          <b>Не вистачає шарів для повного крафту.</b><br />
          Докупити <b>{fmt(r.needFirst)}</b> × <span className="badge orb">★1</span>
          {' '}({fmt(r.missingCoinCost)} монет · {fmtGold(r.missingCoinCost, r.goldPrice)}).
          Орієнтовно <b>{fmt(r.missingEggs)}</b> золотих яєць, якщо вибивати з яєць.
        </div>
      ) : steps.length === 0 ? (
        <div className="banner info">Нічого крафтити — у інвентарі вже є потрібні шари.</div>
      ) : (
        <div className="craft-steps">
          <h3 className="craft-h">План крафту</h3>
          {steps.map((lv, i) => {
            const c = r.plan.make[lv];
            return (
              <div key={lv} className="craft-step">
                <span className="step-idx">{i + 1}</span>
                Скрафтити <b style={{ color: 'var(--accent-2)' }}>{c}</b> ×{' '}
                <span className="badge orb">★{lv}</span> з{' '}
                {Object.entries(RECIPES[lv]).map(([sub, q], j) => (
                  <span key={sub}>
                    {j > 0 && ' + '}
                    {q * c} × <span className="badge orb">★{sub}</span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {r.needFirst === 0 && leftovers.length > 0 && (
        <div className="craft-leftovers">
          <h3 className="craft-h">Залишки в інвентарі</h3>
          <div className="leftover-line">
            {leftovers.map((lv, i) => (
              <span key={lv}>
                {i > 0 && ', '}
                <span className="badge orb">★{lv}</span> × {r.plan.remains[lv]}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
