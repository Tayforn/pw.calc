// Сторінка «compare» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function ComparePage() {
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
        <form id="compareForm" className="grid-form" autoComplete="off">
          <div className="field">
            <label>Тип предмета</label>
            <div className="segmented" role="radiogroup" aria-label="Тип предмета">
              <input type="radio" id="cmpArmor" name="cmpType" defaultValue="armor" defaultChecked />
              <label htmlFor="cmpArmor">Броня</label>
              <input type="radio" id="cmpWeapon" name="cmpType" defaultValue="weapon" />
              <label htmlFor="cmpWeapon">Зброя</label>
            </div>
          </div>
          <div className="field">
            <label htmlFor="eggPrice">Ціна 1 яйця (монет)</label>
            <input type="number" id="eggPrice" className="egg-price-input" min="0" step="1000" />
            <small className="hint">Дефолт: 2 × ціна голди. Спільне поле з іншими табами. Колонки шарів = <code>яйця × ціна яйця</code>.</small>
          </div>
        </form>

        <div id="compareResult" className="result" aria-live="polite"></div>
      </div>
    </>
  );
}
