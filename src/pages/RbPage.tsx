// Сторінка «rb» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function RbPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Рейдові боси</span>
        <h2>Світові боси та Хроно</h2>
        <p>
          Карта з мітками босів. Натисни мітку (або пункт зі списку) — відкриється
          назва й координати. Клік по координатах — копіює їх. Карта тайлів{' '}
          <a className="link" href="https://worldmap.pw/" target="_blank" rel="noopener">© worldmap.pw</a>.
        </p>
      </header>

      <div className="rb-subtabs" role="tablist" aria-label="Типи босів">
        <button className="rb-subtab active" role="tab" data-sub="world" aria-selected="true">🌍 Світ</button>
        <button className="rb-subtab" role="tab" data-sub="chrono" aria-selected="false">⏳ Хроно</button>
      </div>

      <div className="rb-sub active" data-sub="world">
        <div className="rb-checklist">
          <div className="rb-subtabs rb-subtabs-fs" role="tablist" aria-label="Типи босів">
            <button className="rb-subtab active" role="tab" data-sub="world" aria-selected="true">🌍 Світ</button>
            <button className="rb-subtab" role="tab" data-sub="chrono" aria-selected="false">⏳ Хроно</button>
          </div>
          <div className="rb-killbar">
            <span className="rb-killcount" id="rbKillCountWorld">Вбито: 0 / 0</span>
            <button type="button" className="rb-reset" id="rbResetWorld">Скинути</button>
            <span className="rb-killhint">✓ — позначити вбитим · авто-скид: вт 20:00 / чт 21:00</span>
          </div>
          <div className="rb-list" id="rbListWorld"></div>
        </div>
        <div className="rb-map" id="rbMapWorld"></div>
      </div>
      <div className="rb-sub" data-sub="chrono">
        <div className="rb-checklist">
          <div className="rb-subtabs rb-subtabs-fs" role="tablist" aria-label="Типи босів">
            <button className="rb-subtab active" role="tab" data-sub="world" aria-selected="true">🌍 Світ</button>
            <button className="rb-subtab" role="tab" data-sub="chrono" aria-selected="false">⏳ Хроно</button>
          </div>
          <div className="rb-killbar">
            <span className="rb-killcount" id="rbKillCountChrono">Вбито: 0 / 0</span>
            <button type="button" className="rb-reset" id="rbResetChrono">Скинути</button>
            <span className="rb-killhint">✓ — позначити вбитим · авто-скид: вт 20:00 / чт 21:00</span>
          </div>
          <div className="rb-list" id="rbListChrono"></div>
        </div>
        <div className="rb-map" id="rbMapChrono"></div>
      </div>
    </>
  );
}
