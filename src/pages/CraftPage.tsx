// Сторінка «craft» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function CraftPage() {
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
        <div className="banner" style={{ marginTop: '10px' }}>
          <b>Увага:</b> відкриття яєць — це <b>рандом</b>. Кожне натискання
          «Розрахувати» з ненульовим полем «Яйця» генерує нові випадкові дропи,
          тому результати щоразу будуть різні.{' '}
          <br /><br />
          {' '}Натомість значення в блоках статистики (скільки яєць на ★1, вартість
          нестачі тощо) — це <b>середнє очікування</b>:{' '}
          <code>0.71·1 + 0.11·4 + 0.08·10 = 1.95</code> ★1-еквівалента з
          одного яйця (71% дає ★1 = 1, 11% дає ★2 = 4×★1, 8% дає ★3 = 10×★1,
          10% — камінь, не враховується).
        </div>
      </header>

      <div className="card calc-card">
        <form className="grid-form" autoComplete="off" style={{ marginBottom: '14px' }}>
          <div className="field">
            <label htmlFor="eggPriceCraft">Ціна 1 яйця (монет)</label>
            <input type="number" id="eggPriceCraft" className="egg-price-input" min="0" step="1000" />
            <small className="hint">Дефолт: 2 × ціна голди. Спільне поле з іншими табами.</small>
          </div>
        </form>
        <div className="craft-grid">
          <div>
            <h3 className="craft-h">Інвентар (вже є)</h3>
            <div id="craftInv" className="craft-inv"></div>
            <div className="craft-egg-row">
              <label htmlFor="craftEggs"><span className="badge orb">Яйця</span> відкрити</label>
              <input type="number" id="craftEggs" min="0" max="99999" step="1" defaultValue="0" />
              <small className="hint">Симулює випадковий дроп: 71% ★1, 11% ★2, 8% ★3, 10% камінь.</small>
            </div>
          </div>

          <div>
            <h3 className="craft-h">Що крафтимо</h3>
            <div className="craft-form">
              <div className="field">
                <label htmlFor="craftTarget">Рівень цілі</label>
                <select id="craftTarget">
                  <option value="1">★1</option>
                  <option value="2">★2</option>
                  <option value="3">★3</option>
                  <option value="4">★4</option>
                  <option value="5">★5</option>
                  <option value="6">★6</option>
                  <option value="7">★7</option>
                  <option value="8">★8</option>
                  <option value="9">★9</option>
                  <option value="10">★10</option>
                  <option value="11">★11</option>
                  <option value="12" selected>★12</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="craftQty">Кількість</label>
                <input type="number" id="craftQty" min="1" max="100" step="1" defaultValue="1" />
              </div>
              <div className="field craft-actions">
                <button type="button" id="craftCalc" className="btn btn-primary">Розрахувати</button>
                <button type="button" id="craftReset" className="btn btn-ghost">Очистити інвентар</button>
              </div>
            </div>

            <h3 className="craft-h" style={{ marginTop: '18px' }}>Рецепти</h3>
            <div className="recipes-grid" id="recipesList"></div>
          </div>
        </div>

        <div id="craftResult" className="result" aria-live="polite"></div>
      </div>
    </>
  );
}
