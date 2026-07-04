// Сторінка «chests» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function ChestsPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Симулятор скринь</span>
        <h2>Відкриття скрині</h2>
        <p>
          Налаштуй вміст скрині (шанси та кількість), відкривай її та дивись,
          що випало. Інвентар збирає все за поточну сесію. Режим «Симулювати»
          відкриває скриню доти, доки не випаде обраний предмет.
          Налаштування тимчасові — оновлення сторінки скидає скриню до дефолтної.
        </p>
      </header>

      <div className="card calc-card">
        <div className="chest-toolbar">
          <button type="button" id="chestSettingsBtn" className="btn btn-ghost">⚙ Налаштування вмісту</button>
          <span className="muted" id="chestSummary"></span>
        </div>

        <div className="chest-open-row">
          <button type="button" id="chestOpen" className="btn btn-primary chest-open-btn">🎁 Відкрити</button>
          <button type="button" id="chestOpen10" className="btn btn-ghost">Відкрити ×10</button>
          <div className="chest-bulk">
            <input type="number" id="chestCount" min="1" step="1" defaultValue="100" aria-label="Кількість скринь" />
            <button type="button" id="chestOpenAll" className="btn btn-ghost">Відкрити всі</button>
          </div>
          <button type="button" id="chestClearInv" className="btn btn-ghost">↺ Очистити інвентар</button>
        </div>

        <div className="chest-drop" id="chestDrop">
          <div className="hist-empty muted">Натисни «Відкрити», щоб подивитись, що випаде.</div>
        </div>

        <div className="chest-sim-block">
          <h3 className="craft-h">Симуляція до бажаного предмета</h3>
          <p className="muted" style={{ margin: '4px 0 12px' }}>
            Обери предмет — скриня відкриватиметься, доки він не випаде.
            Показуємо, скільки відкриттів знадобилось і скільки б це коштувало.
          </p>
          <form className="chest-sim-form" id="chestSimForm" autoComplete="off">
            <div className="field">
              <label htmlFor="chestTarget">Бажаний предмет</label>
              <select id="chestTarget"></select>
            </div>
            <div className="field">
              <label htmlFor="chestKeyPrice">Ціна 1 ключа/скрині, голда</label>
              <input type="number" id="chestKeyPrice" min="0" step="0.1" defaultValue="0" />
            </div>
            <div className="field chest-sim-submit">
              <button type="submit" id="chestSimulate" className="btn btn-primary">▶ Симулювати</button>
            </div>
          </form>
          <div id="chestSimResult" className="result" aria-live="polite"></div>
        </div>

        <div className="chest-inv-block">
          <div className="chest-inv-head">
            <h3 className="craft-h" style={{ margin: '0' }}>Інвентар (за сесію)</h3>
            <span className="muted" id="chestInvCount">0 відкриттів</span>
          </div>
          <div className="chest-inv-list" id="chestInv">
            <div className="hist-empty muted">Поки що порожньо. Відкрий скриню, щоб щось отримати.</div>
          </div>
        </div>
      </div>
    </>
  );
}
