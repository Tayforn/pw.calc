// Сторінка «settings» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function SettingsPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Налаштування</span>
        <h2>Ціни на сервері</h2>
        <p>
          Всі калькулятори використовують ці значення. Зміни тимчасові —
          скидаються до дефолтів при кожному оновленні сторінки. Ціна
          1 ★1 шара зафіксована (2 голди) і не редагується.
        </p>
      </header>

      <div className="card calc-card">
        <form id="settingsForm" className="grid-form" autoComplete="off">
          <div className="field-group">
            <h3>Основне (монет)</h3>
            <div className="grid-form inner">
              <div className="field">
                <label htmlFor="goldPrice">Ціна голди <span className="field-default-badge" id="goldPriceBadge">дефолт</span></label>
                <input type="text" inputMode="numeric" id="goldPrice" defaultValue="318 400" autoComplete="off" />
                <small className="hint">Скільки монет за 1 голду. <b>Уточни актуальну ціну на твоєму сервері</b> — від неї залежать усі розрахунки.</small>
              </div>
              <div className="field">
                <label htmlFor="miragePrice">Ціна міража</label>
                <input type="text" inputMode="numeric" id="miragePrice" defaultValue="40 000" autoComplete="off" />
                <small className="hint">Скільки монет за 1 міраж.</small>
              </div>
            </div>
          </div>

          <div className="field-group">
            <h3>Камені заточки (голд / шт)</h3>
            <div className="grid-form inner">
              <div className="field">
                <label htmlFor="underPrice">Підземний <span className="badge under">+3.5%</span></label>
                <input type="number" id="underPrice" min="0" step="0.01" defaultValue="0.9" />
                <small className="hint">1 шт = 1 г; 10 шт = 9 г (0.9 / шт).</small>
              </div>
              <div className="field">
                <label htmlFor="skyPrice">Небесний <span className="badge sky">+15%</span></label>
                <input type="number" id="skyPrice" min="0" step="0.01" defaultValue="0.9" />
                <small className="hint">1 шт = 1 г; 10 шт = 9 г (0.9 / шт).</small>
              </div>
              <div className="field">
                <label htmlFor="worldPrice">Світобудови <span className="badge world">без падіння</span></label>
                <input type="number" id="worldPrice" min="0" step="0.01" defaultValue="0.9" />
                <small className="hint">10 шт = 4.5 г (0.45); 100 шт = 44 г (0.44).</small>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" id="resetSettings">Скинути до дефолтів</button>
          </div>
        </form>
      </div>
    </>
  );
}
