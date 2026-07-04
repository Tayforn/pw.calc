// Сторінка «r8» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function R8Page() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Спорядження Р8</span>
        <h2>Бонуси на сетах</h2>
        <p>
          Комплект отримує 3 бонуси, які залежать від класу. Втім, за 2 шмотки з
          набору всім додають здоров'я (змінюється лише значення), а за 4 шмотки
          — всім по +15 ПА. Тож унікальний лише бонус за 3 речі, та й то, якщо
          не рахувати повторів. Прибавки активуються, коли вдягнено певну
          кількість речей, що входять у сет.
        </p>
      </header>

      <div className="card calc-card">
        <div className="table-wrap">
          <table className="data-table" id="r8SetTable">
            <thead>
              <tr>
                <th>Клас / Шмотки</th>
                <th>2</th>
                <th>3</th>
                <th>4</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Воїн</td>       <td>+1500 ХП</td><td>Зменшення шкоди від стихій +15%</td><td>+15 ПА</td></tr>
              <tr><td>Маг</td>        <td>+1200 ХП</td><td>спів −6%</td>                       <td>+15 ПА</td></tr>
              <tr><td>Перевертень</td><td>+1500 ХП</td><td>крит +4%</td>                       <td>+15 ПА</td></tr>
              <tr><td>Друїд</td>      <td>+1500 ХП</td><td>Зменшення фізичної шкоди +15%</td>  <td>+15 ПА</td></tr>
              <tr><td>Жрець</td>      <td>+1200 ХП</td><td>+8 ПЗ</td>                          <td>+15 ПА</td></tr>
              <tr><td>Лучник</td>     <td>+1300 ХП</td><td>−0,1 сек до паузи між атаками</td>  <td>+15 ПА</td></tr>
              <tr><td>Вбивця</td>     <td>+1300 ХП</td><td>−0,1 сек до паузи між атаками</td>  <td>+15 ПА</td></tr>
              <tr><td>Шаман</td>      <td>+1200 ХП</td><td>+1500 до Сили Духа</td>             <td>+15 ПА</td></tr>
              <tr><td>Страж</td>      <td>+1500 ХП</td><td>крит +4%</td>                       <td>+15 ПА</td></tr>
              <tr><td>Містик</td>     <td>+1200 ХП</td><td>крит +4%</td>                       <td>+15 ПА</td></tr>
              <tr><td>Привид</td>     <td>+1300 ХП</td><td>−0,1 сек до паузи між атаками</td>  <td>+15 ПА</td></tr>
              <tr><td>Жнець</td>      <td>+1200 ХП</td><td>+8 ПЗ</td>                          <td>+15 ПА</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
