// Сторінка «r8sim» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function R8simPage() {
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
          <div className="r8s-class-grid" id="r8sClasses" role="radiogroup" aria-label="Клас"></div>
        </div>

        <div className="field" style={{ marginTop: '16px' }}>
          <label>Частина спорядження</label>
          <div className="r8s-piece-grid" id="r8sPieces" role="radiogroup" aria-label="Частина спорядження"></div>
        </div>

        <div id="r8sBody" hidden>
          <div className="r8s-layout">
            <div className="r8s-item" id="r8sItem"></div>

            <div className="r8s-roll">
              <div className="r8s-roll-actions">
                <button type="button" id="r8sRoll" className="btn btn-primary r8s-roll-btn">⚒ Крутити</button>
                <span className="r8s-counter" id="r8sCounter">Круток: 0</span>
              </div>
              <div className="r8s-result" id="r8sResult">
                <div className="hist-empty muted">Натисни «Крутити», щоб отримати 3 випадкові стати.</div>
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
            <div className="r8s-targets" id="r8sTargets"></div>
            <div className="r8s-chosen" id="r8sChosen"></div>
            <div className="r8s-hunt-actions">
              <button type="button" id="r8sHunt" className="btn btn-primary">🎯 Крутити доки не виб'ю</button>
              <button type="button" id="r8sClearTargets" className="btn btn-ghost">Скинути вибір</button>
            </div>
            <div id="r8sHuntResult" className="result" aria-live="polite"></div>
          </div>

          <div className="r8s-stats">
            <div className="r8s-stats-head">
              <h3 className="craft-h" style={{ margin: '0' }}>Статистика сесії</h3>
              <button type="button" id="r8sResetStats" className="btn btn-ghost">↺ Скинути</button>
            </div>
            <div id="r8sStats"></div>
          </div>
        </div>
      </div>
    </>
  );
}
