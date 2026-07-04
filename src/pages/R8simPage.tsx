// =========================================================
// Симулятор крафта Р8 — ідіоматичний React (фаза 3).
// Дані — window.R8_DATA; чисті функції — src/lib/r8sim.ts.
// =========================================================

import { useMemo, useState } from 'react';
import { fmt } from '../utils/format';
import {
  R8S_HUNT_CAP,
  pct,
  r8sComboProb,
  r8sPickStats,
  r8sStatTotals,
  type R8Item,
  type R8Roll,
} from '../lib/r8sim';

const armLabel: Record<string, string> = { light: 'Легка', heavy: 'Важка', int: 'Маг.' };
const cleanName = (n: string) => n.replace(/\s*[+\-]\s*$/, '');

interface HuntResult {
  got: boolean;
  rolls: number;
  prob: number;
  expected: number;
}

export default function R8simPage() {
  const data = window.R8_DATA;
  const [cls, setCls] = useState<string | null>(null);
  const [piece, setPiece] = useState<string | null>(null);
  const [rolls, setRolls] = useState(0);
  const [totalRolls, setTotalRolls] = useState(0);
  const [targets, setTargets] = useState<string[]>([]);
  const [hits, setHits] = useState<Record<string, number>>({});
  const [lastRoll, setLastRoll] = useState<R8Roll[] | null>(null);
  const [huntResult, setHuntResult] = useState<HuntResult | null>(null);

  const item: R8Item | null = useMemo(() => {
    if (!data || !cls || !piece) return null;
    const byClass = data.items[cls];
    return byClass ? byClass[piece] || null : null;
  }, [data, cls, piece]);

  const { map: statMap, total: statTotal } = useMemo(() => r8sStatTotals(item), [item]);

  // Зміна предмета скидає сесію.
  const selectClass = (c: string) => { setCls(c); resetSession(); };
  const selectPiece = (p: string) => { setPiece(p); resetSession(); };
  function resetSession() {
    setRolls(0);
    setTargets([]);
    setHits({});
    setLastRoll(null);
    setHuntResult(null);
  }

  const recordHits = (h: Record<string, number>, roll: R8Roll[]): Record<string, number> => {
    const next = { ...h };
    for (const r of roll) next[r.name] = (next[r.name] || 0) + 1;
    return next;
  };

  const roll = () => {
    if (!item) return;
    const r = r8sPickStats(item.chars, 3);
    setLastRoll(r);
    setRolls((v) => v + 1);
    setTotalRolls((v) => v + 1);
    setHits((h) => recordHits(h, r));
    setHuntResult(null);
  };

  const toggleTarget = (name: string) => {
    if (targets.length >= 3) return;
    setTargets((t) => [...t, name]);
    // зміна цілей скидає лічильник поточного предмета (як у legacy)
    setRolls(0);
    setHits({});
    setHuntResult(null);
  };
  const removeTarget = (idx: number) => {
    setTargets((t) => t.filter((_, i) => i !== idx));
    setRolls(0);
    setHits({});
    setHuntResult(null);
  };
  const clearTargets = () => { setTargets([]); setRolls(0); setHits({}); setHuntResult(null); };

  const hunt = () => {
    if (!item || targets.length === 0) return;
    const prob = r8sComboProb(item, targets);
    if (prob <= 0) {
      setHuntResult({ got: false, rolls: 0, prob: 0, expected: Infinity });
      return;
    }
    const need = new Map<string, number>();
    for (const t of targets) need.set(t, (need.get(t) || 0) + 1);

    let localRolls = 0;
    let got = false;
    let hitRoll: R8Roll[] | null = null;
    let h = { ...hits };
    while (localRolls < R8S_HUNT_CAP) {
      const r = r8sPickStats(item.chars, 3);
      localRolls++;
      h = recordHits(h, r);
      const cnt = new Map<string, number>();
      for (const x of r) cnt.set(x.name, (cnt.get(x.name) || 0) + 1);
      let all = true;
      for (const [nm, req] of need) if ((cnt.get(nm) || 0) < req) { all = false; break; }
      if (all) { got = true; hitRoll = r; break; }
    }
    if (hitRoll) setLastRoll(hitRoll);
    setHits(h);
    setRolls((v) => v + localRolls);
    setTotalRolls((v) => v + localRolls);
    setHuntResult({ got, rolls: localRolls, prob, expected: prob > 0 ? 1 / prob : Infinity });
  };

  const resetStats = () => {
    setRolls(0);
    setTotalRolls(0);
    setHits({});
    setLastRoll(null);
    setHuntResult(null);
  };

  const targetNames = useMemo(
    () => [...statMap.values()].sort((a, b) => b.weight - a.weight),
    [statMap],
  );
  const atMax = targets.length >= 3;

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Симулятор крафта Р8</span>
        <h2>Симулятор спорядження 8 рангу</h2>
        <p>
          Обери клас і частину спорядження — кожна крутка дає 3 випадкові
          бонусні стати зі свого пулу (зважено, з можливими повторами).
          Можна обрати до 3 параметрів, на які «полюєш», і крутити, доки не
          виб'єш. Дані статів — з відкритих джерел, перекладені українською.
        </p>
      </header>

      <div className="card calc-card">
        <div className="field">
          <label>Клас</label>
          <div className="r8s-class-grid" id="r8sClasses" role="radiogroup" aria-label="Клас">
            {data?.classes.map((c) => (
              <button
                key={c.code}
                type="button"
                className={'r8s-chip r8s-class' + (cls === c.code ? ' active' : '')}
                role="radio"
                aria-checked={cls === c.code}
                onClick={() => selectClass(c.code)}
              >
                <span className="r8s-class-name">{c.ua}</span>
                <span className={'r8s-class-arm arm-' + c.arm}>{armLabel[c.arm]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>Частина спорядження</label>
          <div className="r8s-piece-grid" id="r8sPieces" role="radiogroup" aria-label="Частина спорядження">
            {data?.pieces.map((p) => (
              <button
                key={p.code}
                type="button"
                className={'r8s-chip r8s-piece' + (piece === p.code ? ' active' : '')}
                role="radio"
                aria-checked={piece === p.code}
                onClick={() => selectPiece(p.code)}
              >
                {p.ua}
              </button>
            ))}
          </div>
        </div>

        <div id="r8sBody" hidden={!item}>
          {item && (
            <>
              <div className="r8s-layout">
                <div className="r8s-item" id="r8sItem">
                  <div className="r8s-item-name">{item.name}</div>
                  <div className="r8s-item-static">
                    {item.static_char.split('\n').map((line, i) => (
                      <span key={i}>{i > 0 && <br />}{line}</span>
                    ))}
                  </div>
                </div>

                <div className="r8s-roll">
                  <div className="r8s-roll-actions">
                    <button type="button" id="r8sRoll" className="btn btn-primary r8s-roll-btn" onClick={roll}>⚒ Крутити</button>
                    <span className="r8s-counter" id="r8sCounter">Круток: {fmt(rolls)}</span>
                  </div>
                  <div className="r8s-result" id="r8sResult">
                    {!lastRoll ? (
                      <div className="hist-empty muted">Натисни «Крутити», щоб отримати 3 випадкові стати.</div>
                    ) : (
                      <>
                        <div className="r8s-roll-title">Випадкові бонуси:</div>
                        {lastRoll.map((r, i) => (
                          <div key={i} className={'r8s-roll-line' + (targets.includes(r.name) ? ' is-target' : '')}>
                            <span className="r8s-roll-stat">{r.name}</span>
                            <span className="r8s-roll-val">{r.value}{r.um ? ' ' + r.um : ''}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="r8s-hunt">
                <h3 className="craft-h">Полювання на стати</h3>
                <p className="muted" style={{ margin: '4px 0 12px' }}>
                  Обери до <b>3</b> статів (можна один і той самий кілька разів) —
                  крутитимемо, доки всі вони не випадуть в одній крутці. Натисни на
                  стат, щоб додати; натисни на обраний слот нижче, щоб прибрати.
                </p>
                <div className="r8s-targets" id="r8sTargets">
                  {targetNames.map((s) => {
                    const count = targets.filter((t) => t === s.name).length;
                    const p = statTotal ? s.weight / statTotal : 0;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        className={'r8s-target' + (count > 0 ? ' active' : '') + (atMax ? ' is-disabled' : '')}
                        onClick={() => toggleTarget(s.name)}
                      >
                        <span className="r8s-target-name">{cleanName(s.name)}</span>
                        <span className="r8s-target-pct">{pct(p)}</span>
                        {count > 0 && <span className="r8s-target-count">×{count}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="r8s-chosen" id="r8sChosen">
                  {targets.length === 0 ? (
                    <span className="r8s-chosen-empty muted">Обрано 0 / 3 — натисни на стати вище.</span>
                  ) : (
                    <>
                      {targets.map((name, i) => (
                        <button key={i} type="button" className="r8s-slot" title="Прибрати" onClick={() => removeTarget(i)}>
                          <span>{cleanName(name)}</span>
                          <span className="r8s-slot-x">✕</span>
                        </button>
                      ))}
                      <span className="r8s-chosen-empty muted">{targets.length} / 3</span>
                    </>
                  )}
                </div>
                <div className="r8s-hunt-actions">
                  <button type="button" id="r8sHunt" className="btn btn-primary" onClick={hunt}>🎯 Крутити доки не виб'ю</button>
                  <button type="button" id="r8sClearTargets" className="btn btn-ghost" onClick={clearTargets}>Скинути вибір</button>
                </div>
                <div id="r8sHuntResult" className="result" aria-live="polite">
                  {huntResult && <HuntView r={huntResult} />}
                </div>
              </div>

              <div className="r8s-stats">
                <div className="r8s-stats-head">
                  <h3 className="craft-h" style={{ margin: 0 }}>Статистика сесії</h3>
                  <button type="button" id="r8sResetStats" className="btn btn-ghost" onClick={resetStats}>↺ Скинути</button>
                </div>
                <div id="r8sStats">
                  <div className="result-summary three-cols">
                    <div className="metric"><span className="metric-label">Круток (цей предмет)</span><span className="metric-value">{fmt(rolls)}</span></div>
                    <div className="metric"><span className="metric-label">Круток за сесію</span><span className="metric-value">{fmt(totalRolls)}</span></div>
                    <div className="metric"><span className="metric-label">Обрано цілей</span><span className="metric-value">{fmt(targets.length)} / 3</span></div>
                  </div>
                  {rolls > 0 && (
                    <div className="table-wrap" style={{ marginTop: 14 }}>
                      <table className="data-table">
                        <thead>
                          <tr><th>Стат</th><th className="num">Разів</th><th className="num">Факт. за слот</th><th className="num">Шанс за слот</th></tr>
                        </thead>
                        <tbody>
                          {[...statMap.values()]
                            .map((s) => ({ name: s.name, hits: hits[s.name] || 0, theo: statTotal ? s.weight / statTotal : 0 }))
                            .sort((a, b) => b.hits - a.hits)
                            .map((r) => (
                              <tr key={r.name}>
                                <td>{cleanName(r.name)}</td>
                                <td className="num">{fmt(r.hits)}</td>
                                <td className="num">{pct(rolls * 3 > 0 ? r.hits / (rolls * 3) : 0)}</td>
                                <td className="num">{pct(r.theo)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function HuntView({ r }: { r: HuntResult }) {
  if (r.prob <= 0 && !r.got) {
    return <div className="banner">Такий збір неможливий для цього предмета.</div>;
  }
  if (!r.got) {
    return (
      <div className="banner">
        За {fmt(r.rolls)} круток збір так і не випав (ліміт). Шанс надто малий: {pct(r.prob)}.
      </div>
    );
  }
  return (
    <>
      <div className="banner info">
        Готово! Збір вибито за <b>{fmt(r.rolls)}</b> {r.rolls === 1 ? 'крутку' : 'круток'}.
      </div>
      <div className="result-summary three-cols">
        <div className="metric"><span className="metric-label">Круток знадобилось</span><span className="metric-value">{fmt(r.rolls)}</span></div>
        <div className="metric">
          <span className="metric-label">Шанс зібрати за крутку</span>
          <span className="metric-value">{pct(r.prob)}</span>
          <span className="metric-sub">збіг у будь-якому з 3 слотів</span>
        </div>
        <div className="metric"><span className="metric-label">Очікувано (середнє)</span><span className="metric-value">{Number.isFinite(r.expected) ? r.expected.toLocaleString('uk', { maximumFractionDigits: 2 }) : '∞'}</span></div>
      </div>
    </>
  );
}
