// Сторінка «refine» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function RefinePage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Заточка спорядження</span>
        <h2>Оптимальний план заточки</h2>
        <p>
          Алгоритм обирає найдешевший очікуваний шлях на кожному рівні,
          враховуючи штраф повернення при провалі. Ціни — з{' '}
          <a href="#settings" className="link" data-goto="settings">налаштувань</a>.
        </p>
      </header>

      <div className="card calc-card">
        <form id="refineForm" className="grid-form" autoComplete="off">
          <div className="field">
            <label>Тип предмета</label>
            <div className="segmented" role="radiogroup" aria-label="Тип предмета">
              <input type="radio" id="typeArmor" name="itemType" defaultValue="armor" defaultChecked />
              <label htmlFor="typeArmor">Броня</label>
              <input type="radio" id="typeWeapon" name="itemType" defaultValue="weapon" />
              <label htmlFor="typeWeapon">Зброя</label>
            </div>
            <small className="hint">Броня — 1 міраж/спробу<br />Зброя — 2 міражі/спробу</small>
          </div>

          <div className="field">
            <label htmlFor="startLevel">Поточний рівень</label>
            <select id="startLevel">
              <option value="0" selected>+0</option>
              <option value="1">+1</option>
              <option value="2">+2</option>
              <option value="3">+3</option>
              <option value="4">+4</option>
              <option value="5">+5</option>
              <option value="6">+6</option>
              <option value="7">+7</option>
              <option value="8">+8</option>
              <option value="9">+9</option>
              <option value="10">+10</option>
              <option value="11">+11</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="targetLevel">Цільовий рівень</label>
            <select id="targetLevel">
              <option value="1">+1</option>
              <option value="2">+2</option>
              <option value="3">+3</option>
              <option value="4">+4</option>
              <option value="5">+5</option>
              <option value="6">+6</option>
              <option value="7">+7</option>
              <option value="8">+8</option>
              <option value="9">+9</option>
              <option value="10">+10</option>
              <option value="11">+11</option>
              <option value="12" selected>+12</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="stoneStrategy">Метод</label>
            <select id="stoneStrategy">
              <option value="auto" selected>Авто — оптимальний</option>
              <option value="mirage">Лише міражі</option>
              <option value="under">Лише підземні</option>
              <option value="sky">Лише небесні</option>
              <option value="world">Лише світобудови</option>
            </select>
          </div>
        </form>

        <div id="refineResult" className="result" aria-live="polite"></div>
      </div>

      <div className="card calc-card mc-card">
        <div className="mc-head">
          <h3>📊 Розподіл вартості (Monte Carlo)</h3>
          <p className="muted">
            Тисячі симульованих прогонів того самого плану (тип, рівні й метод —
            беруться з форми вище). Показує не лише середнє, а й розкид: медіану,
            найкращі/найгірші 10% та шанс уложитися в бюджет.
          </p>
        </div>
        <form id="mcForm" className="mc-form" autoComplete="off">
          <div className="field">
            <label htmlFor="mcRuns">Кількість прогонів</label>
            <input type="text" inputMode="numeric" id="mcRuns" defaultValue="10 000" autoComplete="off" />
            <small className="hint">100–50 000. Більше — точніше, але повільніше.</small>
          </div>
          <div className="field">
            <label htmlFor="mcBudget">Бюджет, юані (необов'язково)</label>
            <input type="text" inputMode="numeric" id="mcBudget" placeholder="напр. 700 000 000" autoComplete="off" />
            <small className="hint" id="mcBudgetHint">Юані = монети.</small>
          </div>
          <div className="field mc-submit">
            <label aria-hidden="true">&nbsp;</label>
            <button type="submit" className="btn btn-primary" id="mcRun">Прорахувати розподіл</button>
          </div>
        </form>
        <div id="mcResult" className="result" aria-live="polite"></div>
      </div>

      <div className="card calc-card rev-card">
        <div className="mc-head">
          <h3>🎯 Зворотний розрахунок: бюджет → ризик</h3>
          <p className="muted">
            «Я хочу +N з бюджетом X». Береш ціль і рівні з форми вище, вводиш бюджет —
            рахуємо шанс дійти за цей бюджет для кожної стратегії та підбираємо
            оптимальну за ризиком (камінь обирається на кожному кроці залежно від
            рівня й залишку бюджету).
          </p>
        </div>
        <form id="revForm" className="mc-form" autoComplete="off">
          <div className="field">
            <label htmlFor="revBudget">Бюджет, юані</label>
            <input type="text" inputMode="numeric" id="revBudget" placeholder="напр. 700 000 000" autoComplete="off" />
            <small className="hint" id="revBudgetHint">Юані = монети.</small>
          </div>
          <div className="field mc-submit">
            <label aria-hidden="true">&nbsp;</label>
            <button type="submit" className="btn btn-primary" id="revRun">Прорахувати ризик</button>
          </div>
        </form>
        <div id="revResult" className="result" aria-live="polite"></div>
      </div>
    </>
  );
}
