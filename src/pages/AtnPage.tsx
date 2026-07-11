// Сторінка «АТН» — розмітка за аналогією з /rb; логіка — src/modules/atn.
export default function AtnPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">АТН · Файне полювання</span>
        <h2>Атака тигрів небожителів</h2>
        <p>
          Карта з мітками босів і зонами полювання. Натисни мітку чи зону (або пункт
          зі списку) — відкриється назва й координати. Клік по координатах — копіює їх,
          ✎ — перейменувати.
        </p>
      </header>

      <div className="rb-sub active">
        <div className="rb-checklist">
          <div className="rb-killbar">
            <span className="rb-killcount" id="atnKillCount">Вбито: 0 / 0</span>
            <button type="button" className="rb-reset" id="atnReset">Скинути</button>
            <span className="rb-killhint">✓ — позначити вбитим · скидання вручну</span>
          </div>
          <div className="rb-list" id="atnList"></div>
          <div className="rb-list" id="atnZoneList"></div>
        </div>
        <div className="rb-map" id="atnMap"></div>
      </div>
    </>
  );
}
