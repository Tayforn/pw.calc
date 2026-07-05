// =========================================================
// Бій (ПА/ПЗ, деф, рівень) — ідіоматичний React (фаза 3 міграції).
// Формули — src/lib/defense.ts; legacy defInit видалено.
// =========================================================

import { useState, type ReactNode } from 'react';
import { fmt } from '../utils/format';
import {
  DEF_ARMOR_VALUES,
  DEF_DELTA_ROWS,
  PVP_RANGES,
  armorReduction,
  coefEffectText,
  paPzCoef,
  pveLevelCoef,
  pvpLevelCoef,
} from '../lib/defense';

type Mode = 'pvp' | 'pve';

export default function DefensePage() {
  const [mode, setMode] = useState<Mode>('pvp');
  const [atk, setAtk] = useState('100');
  const [pz, setPz] = useState('100');
  const [armor, setArmor] = useState('0');
  const [atkLevel, setAtkLevel] = useState('105');
  const [defLevel, setDefLevel] = useState('105');
  const [baseDmg, setBaseDmg] = useState('');

  const nAtk = parseFloat(atk);
  const nPz = parseFloat(pz);
  const nArmor = parseFloat(armor);
  const nAtkLevel = parseInt(atkLevel, 10);
  const nDefLevel = parseInt(defLevel, 10);
  const nBaseDmg = parseFloat(baseDmg);

  const valid =
    Number.isFinite(nAtk) && nAtk >= 0 &&
    Number.isFinite(nPz) && nPz >= 0 &&
    Number.isFinite(nAtkLevel) && nAtkLevel >= 1 &&
    Number.isFinite(nDefLevel) && nDefLevel >= 1;

  const swap = () => {
    setAtk(pz);
    setPz(atk);
    setAtkLevel(defLevel);
    setDefLevel(atkLevel);
  };

  // Розрахунок (використовується лише при валідних полях).
  const delta = nAtk - nPz;
  const kPaPz = paPzCoef(delta);
  const armorVal = Number.isFinite(nArmor) && nArmor > 0 ? nArmor : 0;
  const reduction = armorReduction(armorVal, nAtkLevel);
  const kArmor = 1 - reduction;
  const targetGap = nDefLevel - nAtkLevel; // ціль − нападник (PWI-таблиця різниці рівнів)
  const kLevel = mode === 'pve' ? pveLevelCoef(nAtkLevel, nDefLevel) : pvpLevelCoef(targetGap);
  const kTotal = kPaPz * kArmor * kLevel;
  const totalCls = kTotal > 1 ? 'bad' : kTotal < 1 ? 'good' : '';
  const armorTableLevel = valid ? nAtkLevel : 105;

  const tips: string[] = [];
  if (valid) {
    if (delta < -100) tips.push('ПА/ПЗ: ти за «точкою розрізу» (Δ < −100) — кожна нова одиниця ПЗ дає < 0.5% дефу.');
    else if (delta < 0) tips.push('ПА/ПЗ: до «точки розрізу» (Δ = −100) ще є простір.');
    else if (delta > 0) tips.push('ПА/ПЗ: перевага атаки — кожна +1 ПА додає +1% урону.');
    if (armorVal > 0 && reduction >= 0.5) tips.push('Деф: ти вже за 50% зрізання — далі diminishing returns, кожна 1k дефу дає все менше.');
    if (mode === 'pvp') {
      tips.push('PvP: понад усе діє базовий PvP-множник — увесь урон у PvP додатково ×25% (−75%). Він НЕ входить у коефіцієнт вище.');
      if (targetGap >= 3)
        tips.push('Рівень: ціль вища за тебе на ' + targetGap + ' лвл — твій урон ріжеться за таблицею PWI (одностороннє: коли нападник вищий — штрафу немає).');
    }
    if (mode === 'pve' && nAtkLevel < nDefLevel) tips.push('Рівень: моб вищий за тебе — урон ріжеться за k = твій_рівень/рівень_моба.');
    if (mode === 'pve' && nAtkLevel >= nDefLevel) tips.push('Рівень: ти не нижчий за моба — PvE-штрафу на урон немає (k = 1.0).');
  }

  const numField = (
    id: string,
    label: ReactNode,
    value: string,
    set: (v: string) => void,
    hint: ReactNode,
    props: Record<string, unknown> = {},
  ) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input type="number" id={id} value={value} onChange={(e) => set(e.target.value)} {...props} />
      <small className="hint">{hint}</small>
    </div>
  );

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Атака, захист, деф і рівень</span>
        <h2>Калькулятор фінальної шкоди</h2>
        <p>
          Фінальна шкода — це добуток трьох незалежних фільтрів:{' '}
          <b>ПА vs ПЗ</b> (різниця рівнів атаки/захисту), <b>фіз/маг деф</b>
          {' '}(нелінійне % зрізання) та <b>різниця рівнів</b> персонажів
          (PvP-сітка або PvE-співвідношення). Введи показники — отримаєш
          покроковий розклад і коефіцієнт фінальної шкоди.
        </p>
      </header>

      <div className="card calc-card">
        <form id="defForm" className="grid-form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label>Режим</label>
            <div className="segmented" role="radiogroup" aria-label="Режим бою">
              <input type="radio" id="defModePvp" name="defMode" checked={mode === 'pvp'} onChange={() => setMode('pvp')} />
              <label htmlFor="defModePvp">PvP</label>
              <input type="radio" id="defModePve" name="defMode" checked={mode === 'pve'} onChange={() => setMode('pve')} />
              <label htmlFor="defModePve">PvE</label>
            </div>
            <small className="hint">PvP — гравець vs гравець. PvE — vs моб/бос.</small>
          </div>
          {numField('defAtk', 'ПА нападника', atk, setAtk, 'Nível de Ataque / Показник атаки.', { min: 0, step: 1 })}
          {numField('defDef', 'ПЗ цілі', pz, setPz, 'Nível de Defesa / Показник захисту.', { min: 0, step: 1 })}
          {numField('defArmor', 'Фіз / Маг деф цілі', armor, setArmor, 'Чистий деф у статах. Фіз і маг — однакова формула.', { min: 0, step: 100 })}
          {numField('defAtkLevel', 'Рівень нападника', atkLevel, setAtkLevel, 'Рівень персонажа-нападника. Впливає на формулу дефу цілі.', { min: 1, max: 200, step: 1 })}
          {numField(
            'defDefLevel',
            mode === 'pve' ? 'Рівень моба/боса' : 'Рівень цілі',
            defLevel,
            setDefLevel,
            mode === 'pve' ? 'Рівень моба — впливає на PvE-штраф.' : 'Рівень цілі — впливає на штраф за різницю рівнів.',
            { min: 1, max: 200, step: 1 },
          )}
          {numField(
            'defBaseDmg',
            <>Базова шкода <span className="muted" style={{ fontWeight: 400 }}>(опційно)</span></>,
            baseDmg,
            setBaseDmg,
            'Якщо ввести — порахуємо фінальний урон.',
            { min: 0, step: 100, placeholder: 'напр. 10000' },
          )}
          <div className="field">
            <label>&nbsp;</label>
            <button type="button" id="defSwap" className="btn btn-ghost" style={{ padding: '10px 14px' }} onClick={swap}>
              ⇄ Поміняти нападника ↔ ціль
            </button>
          </div>
        </form>

        <div id="defResult" className="result" aria-live="polite">
          {!valid ? (
            <div className="banner">Введи коректні (невід'ємні) значення ПА, ПЗ та рівнів.</div>
          ) : (
            <>
              <div className={'result-summary' + (Number.isFinite(nBaseDmg) && nBaseDmg > 0 ? '' : ' three-cols')}>
                <div className="metric accent">
                  <span className="metric-label">Фінальний коефіцієнт</span>
                  <span className="metric-value">×{kTotal.toFixed(3)}</span>
                  <span className="metric-sub">{(kTotal * 100).toFixed(1)}% від базової · {coefEffectText(kTotal)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">ПА/ПЗ (Δ {delta >= 0 ? '+' : ''}{fmt(delta)})</span>
                  <span className="metric-value">×{kPaPz.toFixed(3)}</span>
                  <span className="metric-sub">{coefEffectText(kPaPz)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Деф ({fmt(armorVal)})</span>
                  <span className="metric-value">−{(reduction * 100).toFixed(1)}%</span>
                  <span className="metric-sub">множник ×{kArmor.toFixed(3)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">
                    Рівень ({mode === 'pve' ? 'PvE' : 'PvP, ціль ' + (targetGap >= 0 ? '+' : '') + targetGap})
                  </span>
                  <span className="metric-value">×{kLevel.toFixed(3)}</span>
                  <span className="metric-sub">{coefEffectText(kLevel)}{mode === 'pve' ? ' · приблизна оцінка' : ' · за PWI'}</span>
                </div>
                {Number.isFinite(nBaseDmg) && nBaseDmg > 0 && (
                  <div className={'metric ' + totalCls}>
                    <span className="metric-label">Фінальна шкода</span>
                    <span className="metric-value">{fmt(nBaseDmg * kTotal)}</span>
                    <span className="metric-sub">
                      з {fmt(nBaseDmg)} базової · {nBaseDmg * kTotal - nBaseDmg >= 0 ? '+' : '−'}
                      {fmt(Math.abs(nBaseDmg * kTotal - nBaseDmg))}
                    </span>
                  </div>
                )}
              </div>
              <div className="banner info" style={{ marginTop: 4 }}>
                <code>
                  фінал = k₁ × k₂ × k₃ = {kPaPz.toFixed(3)} × {kArmor.toFixed(3)} × {kLevel.toFixed(3)} = {kTotal.toFixed(3)}
                </code>
                <br />
                <span className="muted" style={{ fontSize: '12.5px' }}>
                  {delta >= 0
                    ? `k₁ = 1 + ${delta}/100 = ${kPaPz.toFixed(3)}`
                    : `k₁ = 1 / (1 + 1.2×${Math.abs(delta)}/100) = ${kPaPz.toFixed(3)}`}
                  {'  ·  '}
                  {armorVal > 0
                    ? `k₂ = 1 − ${armorVal}/(40×${nAtkLevel} + ${armorVal} − 25) = ${kArmor.toFixed(3)}`
                    : 'k₂ = 1.000 (деф = 0)'}
                  {'  ·  '}
                  {mode === 'pve'
                    ? `k₃ = min(1, ${nAtkLevel}/${nDefLevel}) = ${kLevel.toFixed(3)}`
                    : `k₃ = ${kLevel.toFixed(3)} (PvP, ціль − нападник = ${targetGap} лвл)`}
                </span>
                {tips.map((t) => (
                  <span key={t}>
                    <br />
                    {t}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card calc-card" style={{ marginTop: 22 }}>
        <header className="section-head" style={{ marginBottom: 14 }}>
          <span className="eyebrow">Довідкова таблиця · 1</span>
          <h2 style={{ fontSize: 22 }}>Коефіцієнт ПА/ПЗ за різницею Δ = ПА − ПЗ</h2>
          <p>
            Натисни на рядок — значення Δ підставиться у калькулятор вище
            (через ПА при нинішньому ПЗ). Зелені рядки — деф (Δ &lt; 0),
            червоні — бонус до шкоди (Δ &gt; 0).
          </p>
        </header>
        <div className="table-wrap">
          <table className="data-table" id="defTable">
            <thead>
              <tr>
                <th>Δ (ПА − ПЗ)</th>
                <th className="num">Коефіцієнт</th>
                <th className="num">Ефект</th>
                <th>Пояснення</th>
              </tr>
            </thead>
            <tbody>
              {DEF_DELTA_ROWS.map((r) => {
                const k = paPzCoef(r.delta);
                const cls = r.delta > 0 ? 'def-row-attack' : r.delta < 0 ? 'def-row-defense' : '';
                const badgeCls = r.delta > 0 ? 'bad' : r.delta < 0 ? 'good' : '';
                return (
                  <tr
                    key={r.delta}
                    className={'def-row def-row-delta ' + cls}
                    tabIndex={0}
                    onClick={() => {
                      const pzVal = parseFloat(pz);
                      if (Number.isFinite(pzVal)) setAtk(String(Math.max(0, pzVal + r.delta)));
                    }}
                  >
                    <td><span className={'badge ' + badgeCls}>Δ {r.delta > 0 ? '+' + r.delta : r.delta}</span></td>
                    <td className="num"><b>{k.toFixed(2)}</b></td>
                    <td className="num">{coefEffectText(k)}</td>
                    <td>{r.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card calc-card" style={{ marginTop: 22 }}>
        <header className="section-head" style={{ marginBottom: 14 }}>
          <span className="eyebrow">Довідкова таблиця · 2</span>
          <h2 style={{ fontSize: 22 }}>% зрізання від фіз / маг дефу</h2>
          <p>
            Формула <code>редукція = Деф / (40×Рівень + Деф − 25)</code>, кап 95%.
            Таблиця рахується для <b>{armorTableLevel}</b> рівня нападника
            (з поля вище). Натисни рядок — значення дефу підставиться у калькулятор.
          </p>
        </header>
        <div className="table-wrap">
          <table className="data-table" id="defArmorTable">
            <thead>
              <tr>
                <th>Деф у статах</th>
                <th className="num">% зрізання</th>
                <th className="num">Отримаєш шкоди</th>
                <th>Пояснення</th>
              </tr>
            </thead>
            <tbody>
              {DEF_ARMOR_VALUES.map((dv) => {
                const red = armorReduction(dv, armorTableLevel);
                const near50 = Math.abs(red - 0.5) < 0.02;
                return (
                  <tr
                    key={dv}
                    className={'def-row def-row-armor' + (near50 ? ' def-row-defense' : '')}
                    tabIndex={0}
                    onClick={() => setArmor(String(dv))}
                  >
                    <td><span className={'badge' + (near50 ? ' good' : '')}>{fmt(dv)}</span></td>
                    <td className="num"><b>{(red * 100).toFixed(1)}%</b></td>
                    <td className="num">{((1 - red) * 100).toFixed(1)}%</td>
                    <td>
                      {near50
                        ? '«Точка перелому» — урон урізано рівно вдвічі.'
                        : dv === 0
                          ? 'Без дефу — чистий урон.'
                          : 'Diminishing returns: кожна нова 1k дефу зрізає все менше.'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card calc-card" style={{ marginTop: 22 }}>
        <header className="section-head" style={{ marginBottom: 14 }}>
          <span className="eyebrow">Довідкова таблиця · 3</span>
          <h2 style={{ fontSize: 22 }}>
            Штраф за різницю рівнів{' '}
            <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>· за PWI wiki</span>
          </h2>
          <p>
            Одностороння (за вікі PWI): урон ріжеться лише коли <b>ціль вища
            за нападника</b> (рахується <code>рівень_цілі − рівень_нападника</code>).
            Коли нападник вищий — штрафу немає (100%). До 2 рівнів різниці —
            теж 100%. Понад 20 рівнів різниці — стале 25%.
          </p>
        </header>
        <div className="table-wrap">
          <table className="data-table" id="defLevelTable">
            <thead>
              <tr>
                <th>Ціль − нападник</th>
                <th className="num">Коефіцієнт</th>
                <th className="num">Шкоди</th>
              </tr>
            </thead>
            <tbody>
              {PVP_RANGES.map((r) => (
                <tr key={r.lo}>
                  <td><span className="badge">{r.hi === null ? 'понад ' + (r.lo - 1) : r.lo + '–' + r.hi} лвл</span></td>
                  <td className="num"><b>{r.k.toFixed(2)}</b></td>
                  <td className="num">{(r.k * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="note">
        <summary>Формули та джерела</summary>
        <p>
          Фінальний коефіцієнт =
          <code>k_ПА/ПЗ × (1 − редукція_дефу) × k_рівня</code>.
          Три фільтри незалежні й перемножуються.
        </p>
        <p>
          <b>1. ПА/ПЗ (Attack/Defense Level).</b> Δ = <code>ПА − ПЗ</code>.
          Δ ≥ 0: <code>k = 1 + Δ/100</code> (лінійний приріст, +1% урону за
          одиницю). Δ &lt; 0: <code>k = 1/(1 + 1.2×|Δ|/100)</code> (гіперболічний
          деф із множником <b>1.2</b> за формулою PWI; при Δ = −100 урон ×0.455).
        </p>
        <p>
          <b>2. Фіз / маг деф.</b>
          <code>редукція = Деф / (40×Рівень + Деф − 25)</code>, кап 95%
          (рівень — нападника). Формула <b>однакова</b> для фізичного дефу
          й усіх 5 стихій маг дефу, тому окремих полів немає — введи будь-який із них.
          Diminishing returns: на 105 лвл перші 50% дефу коштують ~4 100
          одиниць, а наступні 25% — ще ~8 000. Деякі теоркрафтери округлюють
          знаменник до <code>Деф + 40×Рівень</code> (тобто +4200 на 105 лвл).
        </p>
        <p>
          <b>3. Різниця рівнів.</b>
          {' '}За PWpedia — сходинкова сітка від <code>рівень_цілі − рівень_нападника</code>
          {' '}(&lt;3: 100%, 3–5: 90%, 6–8: 80%, 9–11: 70%, 12–15: 60%, 16–20: 50%,
          &gt;20: 25%). Одностороння: ріже урон лише коли ціль вища за нападника.
          PvE (наш режим) — приблизно <code>k = Рівень_гравця / Рівень_моба</code>
          {' '}(якщо моб вищий); якщо гравець ≥ моба — k = 1.0.
        </p>
        <p>
          <b>4. PvP flat −75%.</b> За PWpedia, у PvP <b>увесь урон додатково
          множиться на 25%</b> (тобто −75%) — окремий базовий множник поверх
          усього іншого (виняток — деякі атаки петів вомансера). У калькуляторі
          вище він <b>не врахований</b> у коефіцієнті; це окрема постійна знижка PvP.
        </p>
        <p>
          Джерела: <b>PWpedia</b> (Damage, Gear Addons — формули резисту{' '}
          <code>def/(40×AL+def−25)</code>, Attack/Defense Level з множником 1.2,
          Level Difference Reduction, PvP −75%), PWDatabase. Бойовий дух (Spirit),
          %crit, елементалка зброї та пробивання тут не враховуються.
        </p>
      </details>
    </>
  );
}
