// Сторінка «simulator» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function SimulatorPage() {
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
          <a href="#settings" className="link" data-goto="settings">налаштуваннях</a>.
        </p>
      </header>

      <div className="card calc-card">
        <form id="simForm" className="grid-form" autoComplete="off" style={{ marginBottom: '14px' }}>
          <div className="field">
            <label>Тип предмета</label>
            <div className="segmented" role="radiogroup" aria-label="Тип предмета">
              <input type="radio" id="simArmor" name="simType" defaultValue="armor" defaultChecked />
              <label htmlFor="simArmor">Броня</label>
              <input type="radio" id="simWeapon" name="simType" defaultValue="weapon" />
              <label htmlFor="simWeapon">Зброя</label>
            </div>
            <small className="hint">Броня — 1 міраж/спробу, зброя — 2.</small>
          </div>
          <div className="field">
            <label htmlFor="simStart">Стартовий рівень</label>
            <select id="simStart"></select>
          </div>
          <div className="field">
            <label htmlFor="simTarget">Цільовий рівень</label>
            <select id="simTarget"></select>
          </div>
          <div className="field">
            <label htmlFor="simSpeed">Швидкість авто-симуляції</label>
            <select id="simSpeed">
              <option value="slow">Повільно (1 спроба / 200мс)</option>
              <option value="med" selected>Середньо (1 / 16мс)</option>
              <option value="fast">Швидко (50 / кадр)</option>
              <option value="turbo">Турбо (5000 / кадр)</option>
            </select>
          </div>
        </form>

        <div className="sim-display">
          <div className="sim-level">
            <span className="sim-level-label">Поточний рівень</span>
            <span className="sim-level-value" id="simCurrentLevel">+0</span>
          </div>
          <div className="sim-target-info">
            <span className="sim-level-target" id="simTargetDisplay">Ціль: +12</span>
            <div className="sim-progress" aria-hidden="true">
              <div className="sim-progress-bar" id="simProgressBar"></div>
            </div>
          </div>
          <div className="sim-last" id="simLastResult">Натисни на камінець, щоб зробити спробу, або запусти авто-симуляцію.</div>
          <div className="sim-best" id="simBestResult" hidden></div>
        </div>

        <div className="sim-stones-row">
          <div className="sim-stones" role="radiogroup" aria-label="Вибір камінця">
            <button type="button" className="stone-btn" data-stone="mirage" role="radio" aria-checked="false">
              <span className="badge mirage">Лише міраж</span>
              <span className="stone-rate" id="rateMirage">—</span>
              <span className="stone-price" id="priceMirage">—</span>
              <span className="stone-meta">провал → +0</span>
            </button>
            <button type="button" className="stone-btn" data-stone="under" role="radio" aria-checked="false">
              <span className="badge under">+ Підземний</span>
              <span className="stone-rate" id="rateUnder">—</span>
              <span className="stone-price" id="priceUnder">—</span>
              <span className="stone-meta">провал → −1</span>
            </button>
            <button type="button" className="stone-btn" data-stone="sky" role="radio" aria-checked="false">
              <span className="badge sky">+ Небесний</span>
              <span className="stone-rate" id="rateSky">—</span>
              <span className="stone-price" id="priceSky">—</span>
              <span className="stone-meta">провал → +0</span>
            </button>
            <button type="button" className="stone-btn" data-stone="world" role="radio" aria-checked="false">
              <span className="badge world">+ Світобудови</span>
              <span className="stone-rate" id="rateWorld">—</span>
              <span className="stone-price" id="priceWorld">—</span>
              <span className="stone-meta">провал → залиш.</span>
            </button>
          </div>
          <button type="button" id="simStep" className="btn btn-primary sim-step-btn">⚒ Покращити</button>
        </div>

        <div className="sim-actions">
          <button type="button" id="simRunSelected" className="btn btn-primary">▶ Симуляція вибраним каменем</button>
          <button type="button" id="simRunOptimal" className="btn btn-primary">▶ Оптимальна симуляція</button>
          <button type="button" id="simStop" className="btn btn-ghost" disabled>■ Стоп</button>
          <button type="button" id="simReset" className="btn btn-ghost">↺ Скинути</button>
        </div>

        <div className="sim-history">
          <div className="sim-history-head">
            <h3 className="craft-h" style={{ margin: '0' }}>Історія симуляції</h3>
            <span className="muted" id="simHistoryCount">0 спроб</span>
          </div>
          <div className="sim-history-list" id="simHistory" aria-live="off">
            <div className="hist-empty muted">Поки що порожньо. Натисни на камінець або запусти авто-симуляцію.</div>
          </div>
        </div>

        <div id="simResult" className="result" aria-live="polite"></div>
      </div>
    </>
  );
}
