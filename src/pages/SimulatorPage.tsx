// =========================================================
// Симулятор заточки — ідіоматичний React (фаза 3).
// Двигун (мутабельний стан + цикл авто-прогону) — src/lib/refineSim.ts;
// сторінка читає знімок через useSyncExternalStore.
// =========================================================

import { useMemo, useSyncExternalStore } from 'react';
import type { ItemType, StoneMethod } from '../types';
import { fmt, fmt2, fmtGold } from '../utils/format';
import { RATES, STONE_META, miragesPerAttempt } from '../modules/refine/data';
import { getSettings } from '../settings';
import { computeSimStats, createSim, type SimSpeed } from '../lib/refineSim';
import { useSettings } from '../app/useSettings';
import { routeUrl } from '../app/useRoute';

// Єдиний двигун симуляції на застосунок (панель завжди змонтована).
const sim = createSim(getSettings);

const STONES: Array<{ code: StoneMethod; badge: string; note: string }> = [
  { code: 'mirage', badge: 'Лише міраж', note: 'провал → +0' },
  { code: 'under', badge: '+ Підземний', note: 'провал → −1' },
  { code: 'sky', badge: '+ Небесний', note: 'провал → +0' },
  { code: 'world', badge: '+ Світобудови', note: 'провал → залиш.' },
];

export default function SimulatorPage() {
  const settings = useSettings();
  const s = useSyncExternalStore(sim.subscribe, sim.getSnapshot);
  const stats = useMemo(() => (s.totalAttempts > 0 ? computeSimStats(s, settings) : null), [s, settings]);

  const cur = s.currentLevel;
  const nextLv = cur + 1;
  const reached = cur >= s.target;
  const progress = s.target > 0 ? Math.max(0, Math.min(100, (cur / s.target) * 100)) : 100;
  const mirPerAtt = miragesPerAttempt(s.itemType);
  const mirageGoldPerAtt = (mirPerAtt * settings.miragePrice) / settings.goldPrice;

  const rateFor = (stone: StoneMethod) => {
    if (nextLv > 12) return '—';
    const p = RATES[stone][nextLv];
    return p ? (p * 100).toFixed(2) + '%' : '—';
  };
  const priceFor = (stone: StoneMethod) => {
    if (stone === 'mirage') return fmt2(mirageGoldPerAtt) + ' г / спробу';
    const priceKey = STONE_META[stone].priceKey;
    return fmt2(priceKey ? settings[priceKey] : 0) + ' г / шт';
  };

  const visibleHistory = s.history.slice(-200);
  const histCount =
    s.totalAttempts > visibleHistory.length
      ? 'останні ' + fmt(visibleHistory.length) + ' з ' + fmt(s.totalAttempts) + ' спроб'
      : fmt(s.totalAttempts) + ' спроб';

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Симулятор заточки</span>
        <h2>Симулятор камінцями</h2>
        <p>
          Інтерактивний симулятор: натискай на камінець, щоб зробити одну спробу,
          або запусти авто-симуляцію вибраним каменем чи за оптимальним планом.
          Шанси та поведінка при провалі ідентичні логіці табу «Заточка».
          Ціни на голду, міражі та камені редагуються в{' '}
          <a href={routeUrl('settings')} className="link" data-goto="settings">налаштуваннях</a>.
        </p>
      </header>

      <div className="card calc-card">
        <form id="simForm" className="grid-form" autoComplete="off" style={{ marginBottom: 14 }} onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label>Тип предмета</label>
            <div className="segmented" role="radiogroup" aria-label="Тип предмета">
              <input type="radio" id="simArmor" name="simType" checked={s.itemType === 'armor'} onChange={() => sim.setItemType('armor')} />
              <label htmlFor="simArmor">Броня</label>
              <input type="radio" id="simWeapon" name="simType" checked={s.itemType === 'weapon'} onChange={() => sim.setItemType('weapon' as ItemType)} />
              <label htmlFor="simWeapon">Зброя</label>
            </div>
            <small className="hint">Броня — 1 міраж/спробу, зброя — 2.</small>
          </div>
          <div className="field">
            <label htmlFor="simStart">Стартовий рівень</label>
            <select id="simStart" value={s.start} onChange={(e) => sim.setStart(parseInt(e.target.value, 10))}>
              {Array.from({ length: 12 }, (_, i) => i).map((i) => (
                <option key={i} value={i}>+{i}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="simTarget">Цільовий рівень</label>
            <select id="simTarget" value={s.target} onChange={(e) => sim.setTarget(parseInt(e.target.value, 10))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((i) => (
                <option key={i} value={i}>+{i}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="simSpeed">Швидкість авто-симуляції</label>
            <select id="simSpeed" defaultValue="med" onChange={(e) => sim.setSpeed(e.target.value as SimSpeed)}>
              <option value="slow">Повільно (1 спроба / 200мс)</option>
              <option value="med">Середньо (1 / 16мс)</option>
              <option value="fast">Швидко (50 / кадр)</option>
              <option value="turbo">Турбо (5000 / кадр)</option>
            </select>
          </div>
        </form>

        <div className="sim-display">
          <div className="sim-level">
            <span className="sim-level-label">Поточний рівень</span>
            <span className="sim-level-value" id="simCurrentLevel">+{cur}</span>
          </div>
          <div className="sim-target-info">
            <span className="sim-level-target" id="simTargetDisplay">Ціль: +{s.target}{reached ? '  ✓' : ''}</span>
            <div className="sim-progress" aria-hidden="true">
              <div className="sim-progress-bar" id="simProgressBar" style={{ width: progress + '%' }}></div>
            </div>
          </div>
          <div className="sim-last" id="simLastResult">
            {!s.lastAttempt ? (
              <>
                {s.totalAttempts === 0 ? 'Натисни на камінець, щоб зробити спробу, або запусти авто-симуляцію.' : 'Спроб усього: ' + fmt(s.totalAttempts)}
                {s.running && <span className="sim-running"> ⟳ симулюємо…</span>}
              </>
            ) : (
              <>
                Останнє: <span className={'badge ' + STONE_META[s.lastAttempt.stone].cls}>{STONE_META[s.lastAttempt.stone].label}</span>{' '}
                {s.lastAttempt.success ? <span className="succ">✓ успіх</span> : <span className="fail">✗ провал</span>}
                {' · +'}{s.lastAttempt.before} → +{s.lastAttempt.after}
                {s.running && <span className="sim-running"> ⟳ симулюємо…</span>}
              </>
            )}
          </div>
          <div className="sim-best" id="simBestResult" hidden={!(s.bestLevel > cur)}>
            <span className="sim-best-text">Найкращий рівень, який ви могли мати… але збили:</span>{' '}
            <span className="sim-best-value">+{s.bestLevel}</span>
          </div>
        </div>

        <div className="sim-stones-row">
          <div className="sim-stones" role="radiogroup" aria-label="Вибір камінця">
            {STONES.map((st) => (
              <button
                key={st.code}
                type="button"
                className={'stone-btn' + (s.selectedStone === st.code ? ' selected' : '')}
                role="radio"
                aria-checked={s.selectedStone === st.code}
                disabled={s.running}
                onClick={() => sim.selectStone(st.code)}
              >
                <span className={'badge ' + st.code}>{st.badge}</span>
                <span className="stone-rate">{rateFor(st.code)}</span>
                <span className="stone-price">{priceFor(st.code)}</span>
                <span className="stone-meta">{st.note}</span>
              </button>
            ))}
          </div>
          <button type="button" id="simStep" className="btn btn-primary sim-step-btn" disabled={s.running || cur >= 12 || !s.selectedStone} onClick={() => sim.step()}>⚒ Покращити</button>
        </div>

        <div className="sim-actions">
          <button type="button" id="simRunSelected" className="btn btn-primary" disabled={s.running || reached} onClick={() => sim.runAuto('selected')}>▶ Симуляція вибраним каменем</button>
          <button type="button" id="simRunOptimal" className="btn btn-primary" disabled={s.running || reached} onClick={() => sim.runAuto('optimal')}>▶ Оптимальна симуляція</button>
          <button type="button" id="simStop" className="btn btn-ghost" disabled={!s.running} onClick={() => sim.stop()}>■ Стоп</button>
          <button type="button" id="simReset" className="btn btn-ghost" onClick={() => sim.reset()}>↺ Скинути</button>
        </div>

        <div className="sim-history">
          <div className="sim-history-head">
            <h3 className="craft-h" style={{ margin: 0 }}>Історія симуляції</h3>
            <span className="muted" id="simHistoryCount">{s.totalAttempts === 0 ? '0 спроб' : histCount}</span>
          </div>
          <div className="sim-history-list" id="simHistory" aria-live="off">
            {visibleHistory.length === 0 && s.totalAttempts === 0 ? (
              <div className="hist-empty muted">Поки що порожньо. Натисни на камінець або запусти авто-симуляцію.</div>
            ) : (
              [...visibleHistory].reverse().map((h) => {
                const meta = STONE_META[h.stone];
                const cls = h.success ? 'succ' : 'fail';
                return (
                  <div key={h.idx} className={'hist-row ' + cls}>
                    <span className="hist-idx">#{fmt(h.idx)}</span>
                    <span className={'badge ' + meta.cls}>{meta.label}</span>
                    <span className="hist-mid">+{h.before} → +{h.after}</span>
                    <span className={'hist-mark ' + cls}>{h.success ? '✓' : '✗'}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div id="simResult" className="result" aria-live="polite">
          {stats && <SimStatsView s={s} stats={stats} goldPrice={settings.goldPrice} />}
        </div>
      </div>
    </>
  );
}

function SimStatsView({
  s,
  stats,
  goldPrice,
}: {
  s: import('../lib/refineSim').SimSnapshot;
  stats: import('../lib/refineSim').SimStats;
  goldPrice: number;
}) {
  const { reachedTarget, totalCost, stonesUsed, rows, expectedCost } = stats;
  const diff = expectedCost != null ? totalCost - expectedCost : 0;
  const diffPct = expectedCost && expectedCost > 0 ? (diff / expectedCost) * 100 : 0;
  return (
    <>
      {!s.running && (
        reachedTarget ? (
          <div className="banner" style={{ background: 'rgba(53,224,161,0.08)', borderColor: 'rgba(53,224,161,0.35)', color: '#9bf3d3' }}>
            <b>✓ Ціль досягнута!</b> Підсумок симуляції нижче.
          </div>
        ) : (
          <div className="banner">Симуляція зупинена. Підсумок поточного прогону нижче.</div>
        )
      )}
      <div className="result-summary">
        <div className={'metric ' + (reachedTarget ? 'good' : 'accent')}>
          <span className="metric-label">{reachedTarget ? 'Ціль досягнута' : 'Поточний рівень'}</span>
          <span className="metric-value">+{s.currentLevel}</span>
          <span className="metric-sub">{reachedTarget ? 'старт +' + s.start + ' → +' + s.target : 'ціль +' + s.target}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Загальна вартість</span>
          <span className="metric-value">{fmt(totalCost)}</span>
          <span className="metric-sub">{fmtGold(totalCost, goldPrice)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Спроб</span>
          <span className="metric-value">{fmt(s.totalAttempts)}</span>
          <span className="metric-sub">міражів: {fmt(s.mirages)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Камінців</span>
          <span className="metric-value">{fmt(stonesUsed)}</span>
          <span className="metric-sub">під: {fmt(s.stones.under)} · неб: {fmt(s.stones.sky)} · світ: {fmt(s.stones.world)}</span>
        </div>
      </div>
      {rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Камінь</th>
                  <th className="num">Спроб</th>
                  <th className="num">Успіх</th>
                  <th className="num">Провал</th>
                  <th className="num">Факт. %<br /><small>з симуляції</small></th>
                  <th className="num">Вартість</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STONE_META[r.stone];
                  return (
                    <tr key={r.stone}>
                      <td><span className={'badge ' + meta.cls}>{meta.label}</span></td>
                      <td className="num">{fmt(r.total)}</td>
                      <td className="num">{fmt(r.succ)}</td>
                      <td className="num">{fmt(r.fail)}</td>
                      <td className="num">{r.realPct}%</td>
                      <td className="num">{fmt(r.cost)}<div className="sub">{fmtGold(r.cost, goldPrice)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: '12.5px' }}>
            <b>Факт. %</b> — спостережений % успіху саме в цій симуляції
            (успіхи ÷ спроби, об'єднано по всіх рівнях, де використовувався
            цей камінь). На малій вибірці він <b>не зобов'язаний</b>
            {' '}збігатися з табличним шансом для конкретного рівня з вкладки
            «Заточка» (напр. світобудови на +10 = 0.07%, але в прогоні з
            1 успіх / 1616 спроб реальний результат ≈ 0.06%).
          </p>
        </>
      )}
      {reachedTarget && expectedCost != null && (
        <div className="banner info" style={{ marginTop: 14 }}>
          Очікувана вартість (оптимальний план): <b>{fmt(expectedCost)}</b> монет ·{' '}
          <b>{fmtGold(expectedCost, goldPrice)}</b>. Різниця з фактом:{' '}
          <b style={{ color: diff < 0 ? 'var(--good)' : diff > 0 ? 'var(--bad)' : 'inherit' }}>
            {diff > 0 ? '+' : ''}{fmt(diff)} монет ({diff > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
          </b>.
        </div>
      )}
    </>
  );
}
