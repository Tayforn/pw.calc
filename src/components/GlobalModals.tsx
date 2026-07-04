// =========================================================
// Глобальні модалки (поза панелями): налаштування вмісту скрині.
// Керуються legacy-модулем chests за id-елементами.
// =========================================================

export default function GlobalModals() {
  return (
    <div className="modal-overlay" id="chestModal" hidden>
      <div className="modal chest-modal" role="dialog" aria-modal="true" aria-labelledby="chestModalTitle">
        <div className="modal-head">
          <h3 id="chestModalTitle">Налаштування вмісту скрині</h3>
          <button type="button" className="modal-close" id="chestModalClose" aria-label="Закрити">✕</button>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ marginTop: 0 }}>
            Шанс — у відсотках. Предмети з шансом &lt;100% утворюють спільний пул:
            за одне відкриття випадає рівно один з них (пропорційно шансам).
            Предмети зі шансом <b>100%</b> — гарантований бонус і випадають завжди.
          </p>
          <div className="chest-cfg-row chest-cfg-head">
            <span>Назва</span>
            <span>Шанс, %</span>
            <span>К-сть</span>
            <span></span>
          </div>
          <div id="chestCfgList" className="chest-cfg-list"></div>
          <div className="chest-cfg-summary" id="chestCfgSummary"></div>
        </div>
        <div className="modal-foot">
          <button type="button" id="chestAddItem" className="btn btn-ghost">+ Додати предмет</button>
          <button type="button" id="chestResetCfg" className="btn btn-ghost">↺ Дефолтна скриня</button>
          <button type="button" id="chestModalDone" className="btn btn-primary">Готово</button>
        </div>
      </div>
    </div>
  );
}
