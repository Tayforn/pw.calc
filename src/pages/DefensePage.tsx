// Сторінка «defense» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function DefensePage() {
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
        <form id="defForm" className="grid-form" autoComplete="off">
          <div className="field">
            <label>Режим</label>
            <div className="segmented" role="radiogroup" aria-label="Режим бою">
              <input type="radio" id="defModePvp" name="defMode" defaultValue="pvp" defaultChecked />
              <label htmlFor="defModePvp">PvP</label>
              <input type="radio" id="defModePve" name="defMode" defaultValue="pve" />
              <label htmlFor="defModePve">PvE</label>
            </div>
            <small className="hint">PvP — гравець vs гравець. PvE — vs моб/бос.</small>
          </div>
          <div className="field">
            <label htmlFor="defAtk">ПА нападника</label>
            <input type="number" id="defAtk" min="0" step="1" defaultValue="100" />
            <small className="hint">Nível de Ataque / Показник атаки.</small>
          </div>
          <div className="field">
            <label htmlFor="defDef">ПЗ цілі</label>
            <input type="number" id="defDef" min="0" step="1" defaultValue="100" />
            <small className="hint">Nível de Defesa / Показник захисту.</small>
          </div>
          <div className="field">
            <label htmlFor="defArmor">Фіз / Маг деф цілі</label>
            <input type="number" id="defArmor" min="0" step="100" defaultValue="0" />
            <small className="hint">Чистий деф у статах. Фіз і маг — однакова формула.</small>
          </div>
          <div className="field">
            <label htmlFor="defAtkLevel">Рівень нападника</label>
            <input type="number" id="defAtkLevel" min="1" max="200" step="1" defaultValue="105" />
            <small className="hint">Рівень персонажа-нападника. Впливає на формулу дефу цілі.</small>
          </div>
          <div className="field">
            <label htmlFor="defDefLevel" id="defDefLevelLabel">Рівень цілі</label>
            <input type="number" id="defDefLevel" min="1" max="200" step="1" defaultValue="105" />
            <small className="hint" id="defDefLevelHint">Рівень цілі — впливає на штраф за різницю рівнів.</small>
          </div>
          <div className="field">
            <label htmlFor="defBaseDmg">Базова шкода <span className="muted" style={{ fontWeight: '400' }}>(опційно)</span></label>
            <input type="number" id="defBaseDmg" min="0" step="100" placeholder="напр. 10000" />
            <small className="hint">Якщо ввести — порахуємо фінальний урон.</small>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button type="button" id="defSwap" className="btn btn-ghost" style={{ padding: '10px 14px' }}>⇄ Поміняти нападника ↔ ціль</button>
          </div>
        </form>

        <div id="defResult" className="result" aria-live="polite"></div>
      </div>

      <div className="card calc-card" style={{ marginTop: '22px' }}>
        <header className="section-head" style={{ marginBottom: '14px' }}>
          <span className="eyebrow">Довідкова таблиця · 1</span>
          <h2 style={{ fontSize: '22px' }}>Коефіцієнт ПА/ПЗ за різницею Δ = ПА − ПЗ</h2>
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
            <tbody id="defTableBody"></tbody>
          </table>
        </div>
      </div>

      <div className="card calc-card" style={{ marginTop: '22px' }}>
        <header className="section-head" style={{ marginBottom: '14px' }}>
          <span className="eyebrow">Довідкова таблиця · 2</span>
          <h2 style={{ fontSize: '22px' }}>% зрізання від фіз / маг дефу</h2>
          <p id="defArmorTableCaption">
            Формула <code>редукція = Деф / (40×Рівень + Деф − 25)</code>, кап 95%.
            Таблиця рахується для <b id="defArmorTableLevel">105</b> рівня нападника
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
            <tbody id="defArmorTableBody"></tbody>
          </table>
        </div>
      </div>

      <div className="card calc-card" style={{ marginTop: '22px' }}>
        <header className="section-head" style={{ marginBottom: '14px' }}>
          <span className="eyebrow">Довідкова таблиця · 3</span>
          <h2 style={{ fontSize: '22px' }}>
            Штраф за різницю рівнів{' '}
            <span className="muted" style={{ fontWeight: '400', fontSize: '15px' }}>· за PWI wiki</span>
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
            <tbody id="defLevelTableBody"></tbody>
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
