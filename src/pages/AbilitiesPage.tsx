// Сторінка «abilities» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function AbilitiesPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Спорядження</span>
        <h2>Абілки зброї</h2>
        <p>
          Особливі ефекти зброї («проки»), що з певним шансом спрацьовують під
          час атаки або при отриманні урону. Нижче — назва, тип, опис ефекту та
          шанс спрацювання (де він відомий). Пошук — за назвою чи ефектом.
        </p>
      </header>

      <div className="card calc-card abil-controls">
        <div className="field">
          <label htmlFor="abilSearch">Пошук</label>
          <input type="search" id="abilSearch" placeholder="Назва або ефект абілки…" autoComplete="off" />
        </div>
        <div className="field">
          <label>Тип</label>
          <div className="segmented" role="radiogroup" aria-label="Тип абілки">
            <input type="radio" id="abilCatAll" name="abilCat" defaultValue="all" defaultChecked />
            <label htmlFor="abilCatAll">Усі</label>
            <input type="radio" id="abilCatBuff" name="abilCat" defaultValue="buff" />
            <label htmlFor="abilCatBuff">Бафи</label>
            <input type="radio" id="abilCatDebuff" name="abilCat" defaultValue="debuff" />
            <label htmlFor="abilCatDebuff">Дебафи</label>
            <input type="radio" id="abilCatAttack" name="abilCat" defaultValue="attack" />
            <label htmlFor="abilCatAttack">Атака</label>
          </div>
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: '22px' }}>
        <table className="data-table" id="abilTable">
          <thead>
            <tr>
              <th>Абілка</th>
              <th>Ефект</th>
              <th>Перезаписує</th>
              <th>Нотатки</th>
              <th className="num">Шанс прока</th>
              <th className="num">приклад id зброї</th>
            </tr>
          </thead>
          <tbody id="abilTableBody"></tbody>
        </table>
      </div>
      <p className="muted" id="abilCount" style={{ marginTop: '10px' }}></p>

      <details className="note">
        <summary>Джерела та примітки</summary>
        <p>
          Дані зібрані з відкритих джерел спільноти Perfect World (PWI):
          загальнодоступні описи спорядження та довідники ігрових механік. Шанси
          прока наведено там, де вони задокументовані; позначка <b>~</b> означає
          приблизне або неперевірене значення. Частина новіших абілок не має
          задокументованого шансу — у таких рядках стоїть «—».
        </p>
        <p>
          Назви та описи перекладено українською <b>за допомогою ШІ</b> й вони можуть
          відрізнятися від офіційного формулювання в грі.
        </p>
        <p>
          <b>Перезаписує</b> та <b>Нотатки</b> —
          з PWpedia (англійською, для звірки з джерелом). <b>id зброї</b> — приклади
          предметів, на яких є ця абілка: встав id у базу предметів, щоб перевірити
          самостійно (порожньо — якщо абілки немає на зброї в наших даних).
        </p>
      </details>
    </>
  );
}
