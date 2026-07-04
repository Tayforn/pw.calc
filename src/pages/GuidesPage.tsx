// Сторінка «guides» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function GuidesPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Бібліотека гайдів</span>
        <h2>Гайди спільноти PW Helper <span className="byline">(by Pharmacist)</span></h2>
        <p>
          Куб Долі по кімнатах, ланцюжки титулів, корисні ресурси та база
          гільдії. Матеріали зібрані з діскорд-серверу{' '}
          <b>PW&nbsp;Helper</b>. Обери розділ і гайд зліва.
        </p>
        <a className="discord-btn" href="https://discord.gg/GgpbKamWhm" target="_blank" rel="noopener">
          <svg className="discord-ico" viewBox="0 0 24 18" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M20.32 1.49A19.7 19.7 0 0 0 15.45 0c-.21.38-.45.89-.62 1.29a18.3 18.3 0 0 0-5.46 0C9.2.89 8.95.38 8.74 0a19.6 19.6 0 0 0-4.87 1.49C.77 6.09-.07 10.57.35 14.99a19.8 19.8 0 0 0 6 3.01c.48-.66.91-1.36 1.28-2.1-.7-.26-1.37-.59-2-.97.17-.12.33-.25.49-.38a14.1 14.1 0 0 0 12.06 0c.16.14.32.26.49.38-.63.38-1.31.71-2.01.97.37.74.8 1.44 1.28 2.1a19.7 19.7 0 0 0 6-3.01c.5-5.12-.84-9.56-3.62-13.5ZM8.02 12.27c-1.18 0-2.15-1.08-2.15-2.4 0-1.32.95-2.41 2.15-2.41 1.2 0 2.17 1.09 2.15 2.41 0 1.32-.95 2.4-2.15 2.4Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.4 0-1.32.95-2.41 2.15-2.41 1.2 0 2.17 1.09 2.15 2.41 0 1.32-.94 2.4-2.15 2.4Z"/>
          </svg>
          <span>Discord-сервер PW Helper</span>
        </a>
      </header>

      <div className="guides-layout">
        <aside className="guides-sidebar" id="guidesSidebar">
          <div className="guides-search">
            <input type="search" id="guideSearch" placeholder="Пошук гайда…" autoComplete="off" />
          </div>
          <nav className="guides-nav" id="guidesNav" aria-label="Список гайдів"></nav>
        </aside>
        <article className="guides-content card" id="guidesContent">
          <div className="guide-empty">Завантаження…</div>
        </article>
      </div>
    </>
  );
}
