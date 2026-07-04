// Сторінка «gsn» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function GsnPage() {
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
          <div className="gsn-item-grid" id="gsnItems" role="radiogroup" aria-label="Предмет"></div>
        </div>

        <div id="gsnBody" hidden>
          <div className="gsn-odds" id="gsnOdds"></div>

          <div className="r8s-roll gsn-roll">
            <div className="r8s-roll-actions">
              <button type="button" id="gsnRoll" className="btn btn-primary r8s-roll-btn">🎲 Крафтити</button>
              <span className="r8s-counter" id="gsnCounter">Крафтів: 0</span>
            </div>
            <div className="r8s-result" id="gsnResult">
              <div className="hist-empty muted">Натисни «Крафтити», щоб скрафтити річ.</div>
            </div>
          </div>

          <div className="r8s-hunt gsn-hunt">
            <h3 className="craft-h">Полювання</h3>
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              Обери якість і до <b>3</b> статів — крафтитимемо, доки не виб'ємо.
            </p>
            <div className="gsn-tier-pick" id="gsnTierPick" role="radiogroup" aria-label="Цільова якість"></div>
            <div className="r8s-targets" id="gsnTargets"></div>
            <div className="r8s-chosen" id="gsnChosen"></div>
            <div className="r8s-hunt-actions">
              <button type="button" id="gsnHunt" className="btn btn-primary">🎯 Крафтити доки не виб'ю</button>
              <button type="button" id="gsnClearTargets" className="btn btn-ghost">Скинути стати</button>
            </div>
            <div id="gsnHuntResult" className="result" aria-live="polite"></div>
          </div>

          <div className="r8s-stats gsn-stats">
            <div className="r8s-stats-head">
              <h3 className="craft-h" style={{ margin: '0' }}>Статистика сесії</h3>
              <button type="button" id="gsnResetStats" className="btn btn-ghost">↺ Скинути</button>
            </div>
            <div id="gsnStats"></div>
          </div>
        </div>
      </div>
    </>
  );
}
