// =========================================================
// Симулятор ГСН (хроно-біжутерія) — ідіоматичний React (фаза 3).
// Дані — window.GSN_DATA; чисті функції — src/lib/gsn.ts.
// =========================================================

import { useMemo, useState } from 'react';
import { fmt, fmt2 } from '../utils/format';
import { pct } from '../lib/r8sim';
import {
  GSN_HUNT_CAP,
  gsnCountLabel,
  gsnData,
  gsnDispName,
  gsnDispVal,
  gsnDoCraft,
  gsnHuntProb,
  gsnIsUnknown,
  gsnKey,
  gsnPickStats,
  gsnPickCount,
  gsnPickTier,
  gsnTier,
  type GsnChar,
  type GsnLast,
  type GsnTierData,
} from '../lib/gsn';

interface HuntResult {
  got: boolean;
  rolls: number;
  prob: number;
  expected: number;
  tierCode: string;
  hadTargets: boolean;
}

export default function GsnPage() {
  const data = gsnData();
  const [item, setItem] = useState<string | null>(null);
  const [rolls, setRolls] = useState(0);
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({ blue: 0, purple: 0, gold: 0 });
  const [last, setLast] = useState<GsnLast | null>(null);
  const [huntTier, setHuntTier] = useState('gold');
  const [targets, setTargets] = useState<string[]>([]);
  const [huntResult, setHuntResult] = useState<HuntResult | null>(null);

  const tierData: GsnTierData | null = useMemo(
    () => (data && item ? data.data[item] || null : null),
    [data, item],
  );

  const selectItem = (code: string) => {
    setItem(code);
    setRolls(0);
    setTierCounts({ blue: 0, purple: 0, gold: 0 });
    setLast(null);
    setTargets([]);
    setHuntResult(null);
  };

  const applyCraft = (res: GsnLast) => {
    setRolls((v) => v + 1);
    setTierCounts((tc) => ({ ...tc, [res.tier]: (tc[res.tier] || 0) + 1 }));
    setLast(res);
  };

  const craft = () => {
    if (!tierData) return;
    applyCraft(gsnDoCraft(tierData));
    setHuntResult(null);
  };

  const onHuntChange = (nextTargets?: string[], nextTier?: string) => {
    if (nextTargets !== undefined) setTargets(nextTargets);
    if (nextTier !== undefined) setHuntTier(nextTier);
    setHuntResult(null);
  };

  const pickTier = (code: string) => { setHuntTier(code); setTargets([]); setHuntResult(null); };
  const addTarget = (key: string) => { if (targets.length < 3) onHuntChange([...targets, key]); };
  const removeTarget = (idx: number) => onHuntChange(targets.filter((_, i) => i !== idx));
  const clearTargets = () => onHuntChange([]);

  const hunt = () => {
    if (!tierData) return;
    const tierCode = huntTier;
    const tgt = [...targets];
    const prob = gsnHuntProb(tierData, tierCode, tgt);
    if (prob <= 0) {
      setHuntResult({ got: false, rolls: 0, prob: 0, expected: Infinity, tierCode, hadTargets: tgt.length > 0 });
      return;
    }
    const need = new Map<string, number>();
    for (const k of tgt) need.set(k, (need.get(k) || 0) + 1);

    let localRolls = 0;
    let got = false;
    let lastRes: GsnLast | null = null;
    const tc: Record<string, number> = { ...tierCounts };
    while (localRolls < GSN_HUNT_CAP) {
      const tier = gsnPickTier();
      const count = gsnPickCount(tier);
      const stats = gsnPickStats(tierData[tier].chars, count);
      const res: GsnLast = { tier, stats };
      localRolls++;
      tc[tier] = (tc[tier] || 0) + 1;
      lastRes = res;
      if (res.tier === tierCode) {
        const cnt = new Map<string, number>();
        for (const c of res.stats) cnt.set(gsnKey(c), (cnt.get(gsnKey(c)) || 0) + 1);
        let all = true;
        for (const [k, req] of need) if ((cnt.get(k) || 0) < req) { all = false; break; }
        if (all) { got = true; break; }
      }
    }
    setRolls((v) => v + localRolls);
    setTierCounts(tc);
    setLast(got ? lastRes : null);
    setHuntResult({ got, rolls: localRolls, prob, expected: prob > 0 ? 1 / prob : Infinity, tierCode, hadTargets: tgt.length > 0 });
  };

  const resetStats = () => {
    setRolls(0);
    setTierCounts({ blue: 0, purple: 0, gold: 0 });
    setLast(null);
    setHuntResult(null);
  };

  // Опції статів для полювання (за обраною якістю).
  const targetStats = useMemo(() => {
    if (!tierData) return { list: [] as GsnChar[], total: 0 };
    const td = tierData[huntTier];
    const total = td.chars.reduce((s, c) => s + c.weight, 0);
    return { list: td.chars.filter((c) => !gsnIsUnknown(c)), total };
  }, [tierData, huntTier]);
  const atMax = targets.length >= 3;

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Симулятор крафта ГСН</span>
        <h2>Хроно-біжутерія: Намисто та Пояс</h2>
        <p>
          Обери предмет і «крафти»: спершу випадає якість, від неї — кількість
          допів. Можна полювати на конкретну якість і стати.
        </p>
      </header>

      <div className="card calc-card">
        <div className="field gsn-field">
          <label>Предмет</label>
          <div className="gsn-item-grid" id="gsnItems" role="radiogroup" aria-label="Предмет">
            {data?.items.map((i) => (
              <button
                key={i.code}
                type="button"
                className={'r8s-chip gsn-item' + (item === i.code ? ' active' : '')}
                role="radio"
                aria-checked={item === i.code}
                onClick={() => selectItem(i.code)}
              >
                <span className="gsn-item-emoji">{i.emoji}</span>
                <span>{i.ua}</span>
              </button>
            ))}
          </div>
        </div>

        <div id="gsnBody" hidden={!tierData}>
          {data && tierData && (
            <>
              <div className="gsn-odds" id="gsnOdds">
                {data.tiers.map((t) => (
                  <div key={t.code} className={'gsn-odd gsn-tier-' + t.color}>
                    <span className="gsn-odd-star">{t.star}</span>
                    <span className="gsn-odd-name">{t.ua}</span>
                    <span className="gsn-odd-chance">{pct(t.chance)}</span>
                    <span className="gsn-odd-cnt">{gsnCountLabel(t)}</span>
                  </div>
                ))}
              </div>

              <div className="r8s-roll gsn-roll">
                <div className="r8s-roll-actions">
                  <button type="button" id="gsnRoll" className="btn btn-primary r8s-roll-btn" onClick={craft}>🎲 Крафтити</button>
                  <span className="r8s-counter" id="gsnCounter">Крафтів: {fmt(rolls)}</span>
                </div>
                <div className="r8s-result" id="gsnResult">
                  {!last ? (
                    <div className="hist-empty muted">Натисни «Крафтити», щоб скрафтити річ.</div>
                  ) : (
                    <ResultView last={last} targets={targets} />
                  )}
                </div>
              </div>

              <div className="r8s-hunt gsn-hunt">
                <h3 className="craft-h">Полювання</h3>
                <p className="muted" style={{ margin: '4px 0 10px' }}>
                  Обери якість і до <b>3</b> статів — крафтитимемо, доки не виб'ємо.
                </p>
                <div className="gsn-tier-pick" id="gsnTierPick" role="radiogroup" aria-label="Цільова якість">
                  {data.tiers.map((t) => (
                    <button
                      key={t.code}
                      type="button"
                      className={'gsn-tier-btn gsn-tier-' + t.color + (t.code === huntTier ? ' active' : '')}
                      role="radio"
                      aria-checked={t.code === huntTier}
                      onClick={() => pickTier(t.code)}
                    >
                      <span className="gsn-tier-btn-star">{t.star}</span>
                      <span>{t.ua}</span>
                      <span className="gsn-tier-btn-chance">{pct(t.chance)}</span>
                    </button>
                  ))}
                </div>
                <div className="r8s-targets" id="gsnTargets">
                  {targetStats.list.map((c) => {
                    const key = gsnKey(c);
                    const count = targets.filter((t) => t === key).length;
                    const p = targetStats.total ? c.weight / targetStats.total : 0;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={'r8s-target' + (count > 0 ? ' active' : '') + (atMax ? ' is-disabled' : '')}
                        onClick={() => addTarget(key)}
                      >
                        <span className="r8s-target-name">{c.name} {gsnDispVal(c)}</span>
                        <span className="r8s-target-pct">{pct(p)}</span>
                        {count > 0 && <span className="r8s-target-count">×{count}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="r8s-chosen" id="gsnChosen">
                  {targets.length === 0 ? (
                    <span className="r8s-chosen-empty muted">Допи не обрано — полюємо лише на якість.</span>
                  ) : (
                    <>
                      {targets.map((key, i) => (
                        <button key={i} type="button" className="r8s-slot" title="Прибрати" onClick={() => removeTarget(i)}>
                          <span>{key}</span>
                          <span className="r8s-slot-x">✕</span>
                        </button>
                      ))}
                      <span className="r8s-chosen-empty muted">{targets.length} / 3</span>
                    </>
                  )}
                </div>
                <div className="r8s-hunt-actions">
                  <button type="button" id="gsnHunt" className="btn btn-primary" onClick={hunt}>🎯 Крафтити доки не виб'ю</button>
                  <button type="button" id="gsnClearTargets" className="btn btn-ghost" onClick={clearTargets}>Скинути стати</button>
                </div>
                <div id="gsnHuntResult" className="result" aria-live="polite">
                  {huntResult && <HuntView r={huntResult} />}
                </div>
              </div>

              <div className="r8s-stats gsn-stats">
                <div className="r8s-stats-head">
                  <h3 className="craft-h" style={{ margin: 0 }}>Статистика сесії</h3>
                  <button type="button" id="gsnResetStats" className="btn btn-ghost" onClick={resetStats}>↺ Скинути</button>
                </div>
                <div id="gsnStats">
                  <div className="result-summary">
                    <div className="metric"><span className="metric-label">Усього крафтів</span><span className="metric-value">{fmt(rolls)}</span></div>
                  </div>
                  <div className="result-summary three-cols" style={{ marginTop: 10 }}>
                    {data.tiers.map((t) => {
                      const c = tierCounts[t.code] || 0;
                      return (
                        <div key={t.code} className="metric">
                          <span className="metric-label">{t.star} {t.ua}</span>
                          <span className={'metric-value gsn-metric-' + t.color}>{fmt(c)}</span>
                          <span className="metric-sub">{rolls ? pct(c / rolls) : '—'} · теор. {pct(t.chance)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ResultView({ last, targets }: { last: GsnLast; targets: string[] }) {
  const t = gsnTier(last.tier);
  return (
    <>
      <div className={'gsn-result-tier gsn-tier-' + t.color}>
        {t.star} {t.ua}
        <span className="gsn-result-cnt">· {last.stats.length} допів</span>
      </div>
      {last.stats.map((c, i) => (
        <div key={i} className={'r8s-roll-line' + (targets.includes(gsnKey(c)) ? ' is-target' : '')}>
          <span className="r8s-roll-stat">{gsnDispName(c)}</span>
          <span className="r8s-roll-val">{gsnDispVal(c)}</span>
        </div>
      ))}
    </>
  );
}

function HuntView({ r }: { r: HuntResult }) {
  if (r.prob <= 0 && !r.got) {
    return <div className="banner">Такий збір неможливий для цієї якості.</div>;
  }
  const t = gsnTier(r.tierCode);
  if (!r.got) {
    return (
      <div className="banner">
        Не пощастило 😔 За {fmt(r.rolls)} крафтів потрібний збір так і не випав (ліміт). Шанс надто малий: {pct(r.prob)}.
      </div>
    );
  }
  return (
    <>
      <div className="banner info">
        Готово! <b>{t.star} {t.ua}</b>{r.hadTargets ? ' із потрібними статами' : ''} вибито за <b>{fmt(r.rolls)}</b> крафтів.
      </div>
      <div className="result-summary three-cols">
        <div className="metric"><span className="metric-label">Крафтів знадобилось</span><span className="metric-value">{fmt(r.rolls)}</span></div>
        <div className="metric"><span className="metric-label">Шанс за крафт</span><span className="metric-value">{pct(r.prob)}</span></div>
        <div className="metric"><span className="metric-label">Очікувано (середнє)</span><span className="metric-value">{Number.isFinite(r.expected) ? fmt2(r.expected) : '∞'}</span></div>
      </div>
    </>
  );
}
