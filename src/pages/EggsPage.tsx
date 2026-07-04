// Сторінка «eggs» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function EggsPage() {
  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Драконячі шари · ціна</span>
        <h2>Вартість шарів</h2>
        <p>
          Ціна 1 ★1 шара — фіксовані <b>2 голди</b>. Вартість ★N
          обчислюється з ★1-еквіваленту (за рецептом крафту). Поряд
          показано ймовірнісну оцінку, скільки треба золотих яєць,
          щоб набити такий ★1-еквівалент.
        </p>
      </header>

      <div className="card calc-card">
        <form className="grid-form" autoComplete="off" style={{ marginBottom: '14px' }}>
          <div className="field">
            <label htmlFor="eggPriceEggs">Ціна 1 яйця (монет)</label>
            <input type="number" id="eggPriceEggs" className="egg-price-input" min="0" step="1000" />
            <small className="hint">Дефолт: 2 × ціна голди. Спільне поле з іншими табами.</small>
          </div>
        </form>
        <div id="eggResult" className="result" aria-live="polite"></div>
      </div>

      <details className="note">
        <summary>Методика</summary>
        <p>
          Вартість: <code>ціна(★N) = ★1-екв(N) × 2 голди</code>, де
          ★1-екв виводиться з рецепта (★2=4, ★3=10, …, ★12=4645).
        </p>
        <p>
          Яйця: 71% — ★1, 11% — ★2, 8% — ★3, 10% — міраж.
          Очікувана «вага» яйця в ★1: <code>0.71·1 + 0.11·4 + 0.08·10 = 1.95</code>.
          Орієнтовна кількість яєць — <code>⌈★1-екв(N) / 1.95⌉</code>.
        </p>
      </details>
    </>
  );
}
