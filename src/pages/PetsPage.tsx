// Сторінка «pets» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function PetsPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Скілбаза</span>
        <h2>Уміння питомця</h2>
        <p>Бойові вміння питомців. Рівні (1 / 20 / 40 / 60 / 80) показують силу вміння й вартість.</p>
      </header>
      <div className="skl-layout skl-layout-pet">
        <div className="card skl-petwrap"><div className="skl-petlist" id="sklPetGrid"></div></div>
        <div className="card skl-detail" id="sklPetDetail">
          <p className="muted skl-empty">Завантаження…</p>
        </div>
      </div>
    </>
  );
}
