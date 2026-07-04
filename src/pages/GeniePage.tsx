// Сторінка «genie» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function GeniePage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Скілбаза</span>
        <h2>Джинн: уміння та калькулятор білда</h2>
        <p>
          Клікай уміння в сітці — вони додаються в білд (до 8, лише один
          початковий навик). Калькулятор рахує мінімальний рівень джина,
          потрібну удачу та вимоги спорідненості стихій. Недоступні за
          рівнем, удачею чи фільтрами вміння пригасають.
        </p>
      </header>

      <div className="card calc-card gc-card">
        <form className="grid-form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="gcLevel">Рівень джина</label>
            <input type="number" id="gcLevel" min="1" max="105" step="1" placeholder="105" />
            <small className="hint">Порожньо — без обмеження</small>
          </div>
          <div className="field">
            <label htmlFor="gcLucky">Удача (Lucky)</label>
            <input type="number" id="gcLucky" min="0" max="100" step="1" placeholder="91" />
            <small className="hint">Порожньо — 91 (на 8 умінь)</small>
          </div>
          <div className="field">
            <label htmlFor="gcClass">Клас персонажа</label>
            <select id="gcClass"></select>
          </div>
          <div className="field">
            <label htmlFor="gcTerrain">Місцевість</label>
            <select id="gcTerrain"></select>
          </div>
        </form>
        <div id="gcResult" className="result" aria-live="polite"></div>
      </div>

      <div className="card skl-toolbar">
        <input type="search" id="sklGenieSearch" className="skl-search" placeholder="Пошук вміння джина…" />
      </div>
      <div className="skl-layout">
        <div className="card skl-treewrap"><div className="skl-grid" id="sklGenieGrid"></div></div>
        <div className="card skl-detail" id="sklGenieDetail">
          <p className="muted skl-empty">Завантаження…</p>
        </div>
      </div>
    </>
  );
}
