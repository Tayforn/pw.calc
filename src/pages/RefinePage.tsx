// =========================================================
// Заточка (Калькулятор) — ідіоматичний React (фаза 3).
// Три секції: план (реактивний), Monte Carlo та зворотний бюджет
// (обчислення — src/lib/refineMc.ts). Спільна форма — у стані сторінки.
// =========================================================

import { useMemo, useRef, useState } from 'react';
import type { ItemType, MethodSelection, StoneMethod } from '../types';
import { fmt, fmt2, fmtGold, fmtYuan, groupDigits } from '../utils/format';
import { STONE_META, buildPlan, totalsForPlan } from '../modules/refine/data';
import {
  MC_MAX_RUNS,
  budgetForProb,
  computeReverse,
  mcCountLE,
  mcHistogram,
  mcSamples,
  mcStats,
  type McStats,
  type ReverseResult,
} from '../lib/refineMc';
import { useSettings } from '../app/useSettings';
import { routeUrl } from '../app/useRoute';

const parseMasked = (s: string) => parseFloat(s.replace(/\s/g, ''));
const START_LEVELS = Array.from({ length: 12 }, (_, i) => i); // 0..11
const TARGET_LEVELS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const METHODS: Array<{ v: MethodSelection; label: string }> = [
  { v: 'auto', label: 'Авто — оптимальний' },
  { v: 'mirage', label: 'Лише міражі' },
  { v: 'under', label: 'Лише підземні' },
  { v: 'sky', label: 'Лише небесні' },
  { v: 'world', label: 'Лише світобудови' },
];

export default function RefinePage() {
  const settings = useSettings();
  const [itemType, setItemType] = useState<ItemType>('armor');
  const [start, setStart] = useState(0);
  const [target, setTarget] = useState(12);
  const [method, setMethod] = useState<MethodSelection>('auto');

  const valid = start < target;

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Заточка спорядження</span>
        <h2>Оптимальний план заточки</h2>
        <p>
          Алгоритм обирає найдешевший очікуваний шлях на кожному рівні,
          враховуючи штраф повернення при провалі. Ціни — з{' '}
          <a href={routeUrl('settings')} className="link" data-goto="settings">налаштувань</a>.
        </p>
      </header>

      <div className="card calc-card">
        <form id="refineForm" className="grid-form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label>Тип предмета</label>
            <div className="segmented" role="radiogroup" aria-label="Тип предмета">
              <input type="radio" id="typeArmor" name="itemType" checked={itemType === 'armor'} onChange={() => setItemType('armor')} />
              <label htmlFor="typeArmor">Броня</label>
              <input type="radio" id="typeWeapon" name="itemType" checked={itemType === 'weapon'} onChange={() => setItemType('weapon' as ItemType)} />
              <label htmlFor="typeWeapon">Зброя</label>
            </div>
            <small className="hint">Броня — 1 міраж/спробу<br />Зброя — 2 міражі/спробу</small>
          </div>
          <div className="field">
            <label htmlFor="startLevel">Поточний рівень</label>
            <select id="startLevel" value={start} onChange={(e) => setStart(parseInt(e.target.value, 10))}>
              {START_LEVELS.map((i) => <option key={i} value={i}>+{i}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="targetLevel">Цільовий рівень</label>
            <select id="targetLevel" value={target} onChange={(e) => setTarget(parseInt(e.target.value, 10))}>
              {TARGET_LEVELS.map((i) => <option key={i} value={i}>+{i}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="stoneStrategy">Метод</label>
            <select id="stoneStrategy" value={method} onChange={(e) => setMethod(e.target.value as MethodSelection)}>
              {METHODS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
        </form>

        <div id="refineResult" className="result" aria-live="polite">
          {!valid ? (
            <div className="banner">Цільовий рівень має бути вищим за поточний.</div>
          ) : (
            <PlanTable itemType={itemType} start={start} target={target} method={method} goldPrice={settings.goldPrice} />
          )}
        </div>
      </div>

      <MonteCarloCard itemType={itemType} start={start} target={target} method={method} />
      <ReverseCard itemType={itemType} start={start} target={target} />
    </>
  );
}

function PlanTable({ itemType, start, target, method, goldPrice }: { itemType: ItemType; start: number; target: number; method: MethodSelection; goldPrice: number }) {
  const settings = useSettings();
  const { cumCost, plan } = buildPlan(itemType, method, settings);
  const steps = plan.map((p, i) => ({ ...p, level: i + 1 })).filter((s) => s.level > start && s.level <= target);
  const totalCoins = cumCost[target] - cumCost[start];
  const totals = totalsForPlan(plan, steps, itemType);
  return (
    <>
      <div className="banner info">
        Очікувана вартість з +{start} до +{target}:
        {' '}<b>{fmt(totalCoins)}</b> монет · <b>{fmtGold(totalCoins, goldPrice)}</b>
        &nbsp;·&nbsp; міражів: <b>{fmt(totals.mirages)}</b>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Рівень</th><th>Метод</th><th className="num">Шанс</th>
              <th className="num">Спроб, сер.</th><th className="num">Загальна ціна</th><th className="num">Ціна за рівень</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => {
              const meta = STONE_META[s.method];
              const cumHere = cumCost[s.level] - cumCost[start];
              return (
                <tr key={s.level}>
                  <td><b>+{s.level}</b></td>
                  <td><span className={'badge ' + meta.cls}>{meta.label}</span></td>
                  <td className="num">{(s.successRate * 100).toFixed(2)}%</td>
                  <td className="num">{fmt2(1 / s.successRate)}</td>
                  <td className="num">{fmt(cumHere)}<div className="sub">{fmtGold(cumHere, goldPrice)}</div></td>
                  <td className="num">{fmt(s.stepCost)}<div className="sub">{fmtGold(s.stepCost, goldPrice)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        «Загальна ціна» — сумарна очікувана вартість з поточного рівня
        (+{start}) до даного. «Ціна за рівень» — наскільки збільшується
        ця сума на цьому кроці. Формула кроку враховує штраф повернення:
        {' '}<code>E = (вартість_спроби + (1−p)·штраф) / p</code>.
      </p>
    </>
  );
}

// Спільне поле бюджету/прогонів із маскою розрядки + підказка курсу.
function BudgetHint({ raw, goldPrice }: { raw: string; goldPrice: number }) {
  let txt = 'Юані = монети · 1 голда = ' + fmt(goldPrice) + ' юані';
  const bud = parseMasked(raw);
  if (Number.isFinite(bud) && bud > 0 && goldPrice > 0) txt += ' · уведено ≈ ' + fmtGold(bud, goldPrice);
  return <>{txt}</>;
}

interface McResult {
  stats: McStats;
  capped: number;
  runs: number;
  mean: number;
  attSum: number;
  mirSum: number;
  stoneSum: { sky: number; under: number; world: number };
  start: number;
  target: number;
  meanTooWide: boolean;
}

function MonteCarloCard({ itemType, start, target, method }: { itemType: ItemType; start: number; target: number; method: MethodSelection }) {
  const settings = useSettings();
  const [runs, setRuns] = useState('10 000');
  const [budget, setBudget] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<McResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const tokenRef = useRef(0);

  const run = () => {
    if (start >= target) { setMsg('Цільовий рівень має бути вищим за поточний.'); setResult(null); setProgress(null); return; }
    setMsg(null);
    let RUNS = Math.floor(parseMasked(runs));
    if (!Number.isFinite(RUNS) || RUNS < 100) RUNS = 10000;
    if (RUNS > MC_MAX_RUNS) RUNS = MC_MAX_RUNS;
    setRuns(groupDigits(String(RUNS)));

    const { plan, cumCost } = buildPlan(itemType, method, settings);
    const mean = cumCost[target] - cumCost[start];
    const CHUNK = 300;
    const token = ++tokenRef.current;
    const costs: number[] = [];
    const agg = { attSum: 0, mirSum: 0, stoneSum: { sky: 0, under: 0, world: 0 } };
    let capped = 0;
    let done = 0;
    setResult(null);
    setProgress(0);

    const finalize = (total: number) => {
      const stats = mcStats(costs);
      const cappedPct = total ? capped / total : 1;
      setProgress(null);
      setResult({
        stats, capped, runs: total, mean,
        attSum: agg.attSum, mirSum: agg.mirSum, stoneSum: agg.stoneSum,
        start, target,
        meanTooWide: !costs.length || cappedPct > 0.5,
      });
    };

    const chunk = () => {
      if (token !== tokenRef.current) return;
      const part = mcSamples(itemType, start, target, method, plan, Math.min(CHUNK, RUNS - done), settings);
      for (const c of part.costs) costs.push(c);
      capped += part.capped;
      agg.attSum += part.attSum;
      agg.mirSum += part.mirSum;
      agg.stoneSum.sky += part.stoneSum.sky;
      agg.stoneSum.under += part.stoneSum.under;
      agg.stoneSum.world += part.stoneSum.world;
      done += CHUNK;
      if (capped / done > 0.5) finalize(done);
      else if (done >= RUNS) finalize(RUNS);
      else { setProgress(Math.round((done / RUNS) * 100)); setTimeout(chunk, 0); }
    };
    chunk();
  };

  return (
    <div className="card calc-card mc-card">
      <div className="mc-head">
        <h3>📊 Розподіл вартості (Monte Carlo)</h3>
        <p className="muted">
          Тисячі симульованих прогонів того самого плану (тип, рівні й метод —
          беруться з форми вище). Показує не лише середнє, а й розкид: медіану,
          найкращі/найгірші 10% та шанс уложитися в бюджет.
        </p>
      </div>
      <form id="mcForm" className="mc-form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <div className="field">
          <label htmlFor="mcRuns">Кількість прогонів</label>
          <input type="text" inputMode="numeric" id="mcRuns" autoComplete="off" value={runs} onChange={(e) => setRuns(groupDigits(e.target.value))} />
          <small className="hint">100–50 000. Більше — точніше, але повільніше.</small>
        </div>
        <div className="field">
          <label htmlFor="mcBudget">Бюджет, юані (необов'язково)</label>
          <input type="text" inputMode="numeric" id="mcBudget" placeholder="напр. 700 000 000" autoComplete="off" value={budget} onChange={(e) => setBudget(groupDigits(e.target.value))} />
          <small className="hint" id="mcBudgetHint"><BudgetHint raw={budget} goldPrice={settings.goldPrice} /></small>
        </div>
        <div className="field mc-submit">
          <label aria-hidden="true">&nbsp;</label>
          <button type="submit" className="btn btn-primary" id="mcRun">Прорахувати розподіл</button>
        </div>
      </form>
      <div id="mcResult" className="result" aria-live="polite">
        {msg && <div className="banner">{msg}</div>}
        {progress != null && <div className="banner info">Симуляція… <b id="mcProg">{progress}%</b></div>}
        {result && <McView r={result} budgetRaw={budget} goldPrice={settings.goldPrice} />}
      </div>
    </div>
  );
}

function McView({ r, budgetRaw, goldPrice }: { r: McResult; budgetRaw: string; goldPrice: number }) {
  if (r.meanTooWide) {
    return (
      <div className="banner">
        Розкид надто великий для симуляції: на високих рівнях обраний метод скидає
        заточку у +0, і прогони майже не завершуються. Орієнтуйся на аналітичне
        середнє — <b>{fmtGold(r.mean, goldPrice)}</b> ({fmtYuan(r.mean)}).
      </div>
    );
  }
  const { sorted, n, sampMean, std, p10, p50, p90 } = r.stats;
  const per = (v: number) => v / n;
  const budYuan = parseMasked(budgetRaw);
  const hasBud = Number.isFinite(budYuan) && budYuan > 0;
  const pctl = (q: number) => sorted[Math.min(n - 1, Math.max(0, Math.round(q * (n - 1))))];
  const hist = mcHistogram(sorted);

  const thresholds: Array<[string, number, boolean]> = [
    ['½ середнього', sampMean * 0.5, false],
    ['¾ середнього', sampMean * 0.75, false],
    ['Середнє', sampMean, false],
    ['×1.25 середнього', sampMean * 1.25, false],
    ['×1.5 середнього', sampMean * 1.5, false],
    ['×2 середнього', sampMean * 2, false],
  ];
  if (hasBud) thresholds.push(['Ваш бюджет', budYuan, true]);
  thresholds.sort((a, b) => a[1] - b[1]);

  const pctlRows: Array<[string, number, string?]> = [
    ['Мінімум', sorted[0]], ['10% — щастить', p10, 'mc-good'], ['25%', pctl(0.25)],
    ['Медіана (50%)', p50, 'mc-mid'], ['75%', pctl(0.75)], ['90% — не щастить', p90, 'mc-bad'],
    ['95%', pctl(0.95)], ['99%', pctl(0.99)], ['Максимум', sorted[n - 1]],
  ];
  const resRows: Array<[string, string]> = [
    ['Спроб', fmt2(per(r.attSum))],
    ['Міражів', fmt2(per(r.mirSum))],
  ];
  if (r.stoneSum.sky > 0) resRows.push(['Небесних каменів', fmt2(per(r.stoneSum.sky))]);
  if (r.stoneSum.under > 0) resRows.push(['Підземних каменів', fmt2(per(r.stoneSum.under))]);
  if (r.stoneSum.world > 0) resRows.push(['Каменів світобудови', fmt2(per(r.stoneSum.world))]);

  return (
    <>
      <div className="banner info">
        Симуляція: <b>{fmt(n)}</b> прогонів (+{r.start} → +{r.target}). Середнє MC{' '}
        <b>{fmtGold(sampMean, goldPrice)}</b> ≈ аналітичне <b>{fmtGold(r.mean, goldPrice)}</b>.
      </div>
      <div className="result-summary mc-summary">
        <Metric label="Середнє" coins={sampMean} goldPrice={goldPrice} cls="accent" />
        <Metric label="Медіана" coins={p50} goldPrice={goldPrice} />
        <Metric label="Щастить (краще 10%)" coins={p10} goldPrice={goldPrice} cls="good" />
        <Metric label="Не щастить (гірше 10%)" coins={p90} goldPrice={goldPrice} cls="bad" />
        <Metric label="Розкид (σ)" coins={std} goldPrice={goldPrice} />
        <div className="metric"><span className="metric-label">Спроб (сер.)</span><span className="metric-value">{fmt2(per(r.attSum))}</span><span className="metric-sub">на 1 заточку</span></div>
      </div>
      {hist && (
        <>
          <div className="mc-hist">
            {hist.bins.map((b, i) => (
              <div key={i} className="mc-bar" style={{ height: (b.h * 100).toFixed(1) + '%' }} title={fmtGold(b.from, goldPrice) + ' · ' + b.count + ' прогонів'}></div>
            ))}
          </div>
          <div className="mc-hist-axis">
            <span>{fmtGold(hist.lo, goldPrice)}</span>
            <span>дешевше ←&nbsp;розподіл&nbsp;→ дорожче</span>
            <span>{fmtGold(hist.hi, goldPrice)}+</span>
          </div>
        </>
      )}
      {hasBud && (
        <div className="banner info" style={{ marginTop: 14 }}>
          <b>{(mcCountLE(sorted, budYuan) / n * 100).toFixed(0)}%</b> шансів заточити +{r.start} → +{r.target} дешевше ніж за{' '}
          <b>{fmt(budYuan)} юані</b> (≈ {fmtGold(budYuan, goldPrice)}).
        </div>
      )}
      <h4 className="mc-h">Розподіл вартості по перцентилях</h4>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Перцентиль</th><th className="num">Голд</th><th className="num">Юані</th></tr></thead>
        <tbody>{pctlRows.map(([label, v, cls]) => (
          <tr key={label} className={cls}><td>{label}</td><td className="num">{fmtGold(v, goldPrice)}</td><td className="num">{fmt(v)}</td></tr>
        ))}</tbody></table></div>
      <h4 className="mc-h">Шанс уложитися в бюджет</h4>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Поріг</th><th className="num">Голд</th><th className="num">Юані</th><th className="num">Шанс ≤</th></tr></thead>
        <tbody>{thresholds.map((t) => (
          <tr key={t[0]} className={t[2] ? 'mc-mid' : undefined}>
            <td>{t[0]}</td><td className="num">{fmtGold(t[1], goldPrice)}</td><td className="num">{fmt(t[1])}</td>
            <td className="num"><b>{(mcCountLE(sorted, t[1]) / n * 100).toFixed(0)}%</b></td>
          </tr>
        ))}</tbody></table></div>
      <h4 className="mc-h">Середні витрати на 1 заточку (+{r.start} → +{r.target})</h4>
      <div className="table-wrap"><table className="data-table"><tbody>{resRows.map(([a, b]) => (
        <tr key={a}><td>{a}</td><td className="num">{b}</td></tr>
      ))}</tbody></table></div>
      {r.capped > 0 && (
        <p className="muted" style={{ marginTop: 10, fontSize: '12.5px' }}>
          {r.capped} з {r.runs} прогонів обрізано за межею спроб — їх не враховано в розподілі.
        </p>
      )}
    </>
  );
}

function Metric({ label, coins, goldPrice, cls }: { label: string; coins: number; goldPrice: number; cls?: string }) {
  return (
    <div className={'metric' + (cls ? ' ' + cls : '')}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{fmtGold(coins, goldPrice)}</span>
      <span className="metric-sub">{fmtYuan(coins)}</span>
    </div>
  );
}

function ReverseCard({ itemType, start, target }: { itemType: ItemType; start: number; target: number }) {
  const settings = useSettings();
  const [budget, setBudget] = useState('');
  const [computing, setComputing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<(ReverseResult & { budget: number; start: number; target: number }) | null>(null);

  const run = () => {
    if (start >= target) { setMsg('Цільовий рівень має бути вищим за поточний.'); setResult(null); return; }
    const bud = parseMasked(budget);
    if (!Number.isFinite(bud) || bud <= 0) { setMsg('Введи бюджет у юанях.'); setResult(null); return; }
    setMsg(null);
    setResult(null);
    setComputing(true);
    setTimeout(() => {
      const res = computeReverse(itemType, start, target, bud, settings);
      setResult({ ...res, budget: bud, start, target });
      setComputing(false);
    }, 0);
  };

  return (
    <div className="card calc-card rev-card">
      <div className="mc-head">
        <h3>🎯 Зворотний розрахунок: бюджет → ризик</h3>
        <p className="muted">
          «Я хочу +N з бюджетом X». Береш ціль і рівні з форми вище, вводиш бюджет —
          рахуємо шанс дійти за цей бюджет для кожної стратегії та підбираємо
          оптимальну за ризиком (камінь обирається на кожному кроці залежно від
          рівня й залишку бюджету).
        </p>
      </div>
      <form id="revForm" className="mc-form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <div className="field">
          <label htmlFor="revBudget">Бюджет, юані</label>
          <input type="text" inputMode="numeric" id="revBudget" placeholder="напр. 700 000 000" autoComplete="off" value={budget} onChange={(e) => setBudget(groupDigits(e.target.value))} />
          <small className="hint" id="revBudgetHint"><BudgetHint raw={budget} goldPrice={settings.goldPrice} /></small>
        </div>
        <div className="field mc-submit">
          <label aria-hidden="true">&nbsp;</label>
          <button type="submit" className="btn btn-primary" id="revRun">Прорахувати ризик</button>
        </div>
      </form>
      <div id="revResult" className="result" aria-live="polite">
        {msg && <div className="banner">{msg}</div>}
        {computing && <div className="banner info">Рахую оптимальну стратегію…</div>}
        {result && <ReverseView r={result} goldPrice={settings.goldPrice} />}
      </div>
    </div>
  );
}

function ReverseView({ r, goldPrice }: { r: ReverseResult & { budget: number; start: number; target: number }; goldPrice: number }) {
  const { optWide, pOpt, fixed, budget, start, target } = r;
  const pct = (p: number) => (p * 100).toFixed(p > 0 && p < 0.1 ? 1 : 0) + '%';
  const openLabel = optWide.opening ? STONE_META[optWide.opening].label : '—';
  const nonBinding = pOpt > 0.999;

  const optRow = { key: 'opt', label: 'Оптимальна (адаптивна)', p: pOpt, opening: optWide.opening as StoneMethod | null };
  const rows = [optRow, ...fixed.slice().sort((a, b) => b.p - a.p)];

  const BARS = 28;
  const markBar = Number.isFinite(budget) && budget > 0 ? Math.round((Math.min(budget, optWide.N * optWide.bucket) / (optWide.N * optWide.bucket)) * BARS) : -1;
  const bars = Array.from({ length: BARS }, (_, k) => {
    const i = k + 1;
    const b = Math.round((i / BARS) * optWide.N);
    const p = optWide.curve[b] || 0;
    return { mark: i === markBar, h: Math.max(1, p * 100), title: fmtGold(b * optWide.bucket, goldPrice) + ' → ' + (p * 100).toFixed(0) + '%' };
  });

  return (
    <>
      <div className="banner info">
        За бюджет <b>{fmt(budget)} юані</b> (≈ {fmtGold(budget, goldPrice)}) оптимальна стратегія дає{' '}
        <b>{pct(pOpt)}</b> шансів дійти +{start} → +{target}.
        {pOpt <= 0 ? ' Бюджету замало навіть для оптимальної стратегії.' : nonBinding ? (
          <> Бюджету з запасом — будь-яка розумна стратегія дійде; раціональний перший крок: <b>{openLabel}</b>.</>
        ) : (
          <> Раціональний перший крок: <b>{openLabel}</b>.</>
        )}
      </div>

      <h4 className="mc-h">Шанс успіху залежно від бюджету</h4>
      <div className="mc-hist">
        {bars.map((b, i) => (
          <div key={i} className={'mc-bar' + (b.mark ? ' mc-bar-mark' : '')} style={{ height: b.h.toFixed(1) + '%' }} title={b.title}></div>
        ))}
      </div>
      <div className="mc-hist-axis">
        <span>0</span>
        {markBar > 0 ? <span>▮ твій бюджет</span> : <span>бюджет →</span>}
        <span>{fmtGold(optWide.N * optWide.bucket, goldPrice)}</span>
      </div>

      <h4 className="mc-h">Шанс дійти за бюджет — за стратегіями</h4>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Стратегія</th><th className="num">Шанс</th><th>Перший крок</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.key} className={row.key === 'opt' ? 'mc-mid' : undefined}>
            <td>{row.label}</td><td className="num"><b>{pct(row.p)}</b></td><td>{row.opening ? STONE_META[row.opening].label : '—'}</td>
          </tr>
        ))}</tbody></table></div>

      <h4 className="mc-h">Скільки бюджету на який шанс (оптимальна стратегія)</h4>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Ціль шансу</th><th className="num">Голд</th><th className="num">Юані</th></tr></thead>
        <tbody>{[0.5, 0.8, 0.95, 0.99].map((q) => {
          const b = budgetForProb(optWide.curve, optWide.bucket, optWide.N, q);
          return (
            <tr key={q}>
              <td>{q * 100}%</td>
              {b != null ? (
                <>
                  <td className="num">{fmtGold(b, goldPrice)}</td>
                  <td className="num">{fmt(b)}{b > budget ? <span className="rev-delta"> (+{fmtGold(b - budget, goldPrice)} до бюджету)</span> : <span className="rev-delta rev-ok"> (у межах бюджету)</span>}</td>
                </>
              ) : (
                <td className="num" colSpan={2}>понад розрахований діапазон</td>
              )}
            </tr>
          );
        })}</tbody></table></div>
      <p className="muted" style={{ marginTop: 10, fontSize: '12.5px' }}>
        «Оптимальна» обирає камінь на кожному кроці залежно від рівня та залишку
        бюджету (максимізує шанс уложитися), тож вона ніколи не гірша за будь-яку
        фіксовану. Модель провалу: світобудови — без падіння, підземний −1,
        міраж/небесний — скид у +0.
      </p>
    </>
  );
}
