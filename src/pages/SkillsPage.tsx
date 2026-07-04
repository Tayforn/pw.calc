// Сторінка «skills» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function SkillsPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Скілбаза</span>
        <h2>Уміння класів</h2>
        <p>
          Дерево вмінь усіх 10 класів. Обери клас, далі — вміння у дереві.
          Кнопки рівнів (1–10) показують потрібний рівень, дух і монети та опис
          із числами для цього рівня. <span className="skl-sage-t">Рай</span> /
          <span className="skl-demon-t">Ад</span> — світла й темна культивація.
        </p>
      </header>
      <div className="card skl-classbar" id="sklClassBar"></div>
      <div className="skl-layout">
        <div className="card skl-treewrap"><div className="skl-tree" id="sklTree"></div></div>
        <div className="card skl-detail" id="sklDetail">
          <p className="muted skl-empty">Завантаження…</p>
        </div>
      </div>
    </>
  );
}
