/* =========================================================
   PW Калькулятор — клієнтська логіка.

   Заточка:
     • 1 спроба = N міражів (броня: N=1, зброя: N=2)
     • З камнем додається ціна каменю × курс голди
     • Провал: міраж/небесний → +0, підземний → -1, світобудови —
       рівень зберігається
     • Для кожного рівня вибирається найдешевший очікуваний шлях
       (окрім ручного режиму)

   Яйця:
     • 71% ★1, 11% ★2, 8% ★3 (10% міраж не враховується)
     • Кількість яєць на шар ★N — фіксована таблиця (рецепт
       «2 нижчих → 1 вищий»)
   ========================================================= */

(function () {
  'use strict';

  // ---------- Утиліти ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const nf0 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
  const fmt = (n) => (Number.isFinite(n) ? nf0.format(Math.round(n)) : '—');
  const fmt2 = (n) => (Number.isFinite(n) ? nf2.format(n) : '—');
  const fmtGold = (coins, goldRate) => {
    if (!Number.isFinite(coins) || !goldRate) return '—';
    return nf2.format(coins / goldRate) + ' г';
  };
  const escHtml = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Копіювання тексту в буфер (з фолбеком для http / старих браузерів).
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
    } else {
      fallbackCopy(t);
    }
  }
  function fallbackCopy(t) {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }
  // Делеговане копіювання для будь-якого .coord[data-coord] (гайди + попапи карти).
  document.addEventListener('click', (e) => {
    const coord = e.target.closest('.coord[data-coord]');
    if (!coord) return;
    copyText(coord.dataset.coord);
    coord.classList.add('copied');
    clearTimeout(coord._t);
    coord._t = setTimeout(() => coord.classList.remove('copied'), 1100);
  });

  // =========================================================
  // НАЛАШТУВАННЯ
  // =========================================================

  // Дефолти для ComebackPW-подібних серверів. Камені — 0.9 г
  // (bulk-ціна 10 шт за 9 г). Налаштування тимчасові — кожне оновлення
  // сторінки скидає до дефолтів (без localStorage).
  const DEFAULTS = {
    goldPrice: 318400,
    miragePrice: 40000,
    underPrice: 0.9,
    skyPrice: 0.9,
    worldPrice: 0.44,
  };

  // Фіксована ціна 1 ★1 шара в голдах (не редагується в UI).
  const SHARD_PRICE_GOLD = 2;

  let settings = { ...DEFAULTS };
  let goldPriceTouched = false;
  let eggPriceTouched = false;

  function applySettingsToInputs() {
    for (const key of Object.keys(DEFAULTS)) {
      const el = document.getElementById(key);
      if (el) el.value = settings[key];
    }
    updateGoldIndicator();
    updateDefaultIndicators();
  }

  function updateGoldIndicator() {
    const txt = $('.gold-indicator-text', $('#goldIndicator'));
    if (txt) {
      txt.innerHTML =
        `1 <span>голда</span> = ${fmt(settings.goldPrice)} <span>монет</span>`;
    }
  }

  function updateDefaultIndicators() {
    const isDefault = !goldPriceTouched;
    const goldEl = $('#goldIndicator');
    if (goldEl) goldEl.classList.toggle('is-default', isDefault);
    const settingsTab = document.querySelector('.tab[data-tab="settings"]');
    if (settingsTab) settingsTab.classList.toggle('needs-attention', isDefault);
    const fieldBadge = $('#goldPriceBadge');
    if (fieldBadge) fieldBadge.classList.toggle('is-shown', isDefault);
  }

  $('#settingsForm').addEventListener('input', (e) => {
    const id = e.target.id;
    if (!(id in settings)) return;
    const v = parseFloat(e.target.value);
    if (!Number.isFinite(v) || v < 0) return;
    if (id === 'goldPrice') {
      goldPriceTouched = true;
      updateDefaultIndicators();
    }
    settings[id] = v;
    updateGoldIndicator();
    if (id === 'goldPrice' && !eggPriceTouched) applyDefaultEggPrice();
    renderAll();
  });

  $('#resetSettings').addEventListener('click', () => {
    settings = { ...DEFAULTS };
    goldPriceTouched = false;
    eggPriceTouched = false;
    applySettingsToInputs();
    applyDefaultEggPrice();
    renderAll();
  });
  // =========================================================
  // ТАБИ
  // =========================================================
  const VALID_TABS = ['refine', 'eggs', 'compare', 'craft', 'simulator', 'defense', 'r8', 'guides', 'rb', 'settings'];
  function setTab(name) {
    if (!VALID_TABS.includes(name)) name = 'refine';
    $$('.tab').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    $$('.tab-panel').forEach((p) =>
      p.classList.toggle('active', p.dataset.panel === name)
    );
    if (location.hash !== '#' + name && !location.hash.startsWith('#' + name + '/'))
      history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'rb') rbActivate();
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
  $$('[data-goto]').forEach((a) =>
    a.addEventListener('click', (e) => { e.preventDefault(); setTab(a.dataset.goto); })
  );

  // =========================================================
  // ЗАТОЧКА — ДАНІ
  // =========================================================

  // Шанси успіху заточки, RATES[method][level] — level 1..12
  const RATES = {
    mirage: [null, 0.50, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.25, 0.20, 0.12, 0.05],
    sky:    [null, 0.60, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.40, 0.35, 0.27, 0.20],
    under:  [null, 0.535, 0.335, 0.335, 0.335, 0.335, 0.335, 0.335, 0.335, 0.285, 0.235, 0.155, 0.085],
    world:  [null, 1.00, 0.25, 0.10, 0.04, 0.0167, 0.0077, 0.0047, 0.0025, 0.0013, 0.0007, 0.0004, 0.0002],
  };

  const STONE_META = {
    mirage: { label: 'Міраж',       cls: 'mirage', short: 'міраж',      priceKey: null },
    sky:    { label: 'Небесний',    cls: 'sky',    short: 'небесний',   priceKey: 'skyPrice' },
    under:  { label: 'Підземний',   cls: 'under',  short: 'підземний',  priceKey: 'underPrice' },
    world:  { label: 'Світобудови', cls: 'world',  short: 'світобудови',priceKey: 'worldPrice' },
  };

  /** Скільки міражів витрачається на одну спробу. */
  function miragesPerAttempt(itemType) {
    return itemType === 'weapon' ? 2 : 1;
  }

  /** Вартість однієї спроби у монетах. */
  function attemptCost(method, itemType) {
    const mirages = miragesPerAttempt(itemType) * settings.miragePrice;
    if (method === 'mirage') return mirages;
    const stoneGold = settings[STONE_META[method].priceKey];
    return mirages + stoneGold * settings.goldPrice;
  }

  /**
   * Будує оптимальний план заточки з +0 до +12.
   * Повертає { cumCost[0..12], plan[0..11] }, де:
   *   cumCost[n] — очікувана вартість у монетах дійти від 0 до +n
   *   plan[n-1]  — опис обраного методу для кроку +n
   */
  function buildPlan(itemType, forcedMethod) {
    const methods = forcedMethod && forcedMethod !== 'auto'
      ? [forcedMethod]
      : ['mirage', 'sky', 'under', 'world'];

    const cumCost = [0];
    const plan = [];

    for (let n = 1; n <= 12; n++) {
      let best = null;
      for (const m of methods) {
        const p = RATES[m][n];
        if (!p || p <= 0) continue;

        const att = attemptCost(m, itemType);

        // Поведінка при провалі:
        //  world   — рівень лишається, penalty = 0
        //  under   — -1 рівень: треба перепройти лише попередній крок
        //  mirage, sky — +0: треба перепройти всі попередні кроки
        let penalty;
        if (m === 'world') {
          penalty = 0;
        } else if (m === 'under') {
          penalty = n >= 2 ? cumCost[n - 1] - cumCost[n - 2] : 0;
        } else {
          penalty = cumCost[n - 1];
        }

        // E = (att + (1-p) * penalty) / p
        const stepCost = (att + (1 - p) * penalty) / p;
        const attempts = 1 / p;

        if (!best || stepCost < best.stepCost) {
          best = { method: m, stepCost, attempts, successRate: p, attemptCost: att };
        }
      }

      if (!best) {
        best = { method: 'mirage', stepCost: 0, attempts: 0, successRate: 0, attemptCost: 0 };
      }
      cumCost[n] = cumCost[n - 1] + best.stepCost;
      plan.push(best);
    }
    return { cumCost, plan };
  }

  /**
   * Сумарні ресурси (міражі та камені) для відрізку плану.
   *
   * Для кожного рівня L у відрізку беремо «ефективну кількість спроб»
   *   N_L = stepCost_L / attemptCost_L
   * де stepCost_L — очікувана загальна вартість пройти цей рівень
   * (разом із штрафом повернення після провалу), а attemptCost_L —
   * вартість однієї спроби (міражі + камінь) на цьому рівні.
   *
   * Ця величина враховує ВСІ повторні підйоми з нижчих рівнів
   * (якщо невдача скинула заточку у +0 або на -1). Саме стільки
   * «повних» спроб цього каменя доведеться оплатити, якщо рахувати
   * всю вартість кроку так, ніби вона витрачається на цьому рівні.
   */
  function totalsForPlan(plan, steps, itemType) {
    const totals = { mirages: 0, sky: 0, under: 0, world: 0 };
    const mirPerAtt = miragesPerAttempt(itemType);

    for (const step of steps) {
      const expAttempts = step.attemptCost > 0
        ? step.stepCost / step.attemptCost
        : 0;
      totals.mirages += expAttempts * mirPerAtt;
      if (step.method !== 'mirage') {
        totals[step.method] += expAttempts;
      }
    }
    return totals;
  }

  // =========================================================
  // ЗАТОЧКА — UI
  // =========================================================

  const refineForm = $('#refineForm');
  const refineResult = $('#refineResult');
  refineForm.addEventListener('change', renderRefine);

  function renderRefine() {
    const itemType = $('input[name="itemType"]:checked').value;
    const start = parseInt($('#startLevel').value, 10);
    const target = parseInt($('#targetLevel').value, 10);
    const method = $('#stoneStrategy').value;

    if (start >= target) {
      refineResult.innerHTML =
        '<div class="banner">Цільовий рівень має бути вищим за поточний.</div>';
      return;
    }

    const { cumCost, plan } = buildPlan(itemType, method);
    const stepsAll = plan.map((p, i) => ({ ...p, level: i + 1 }));
    const steps = stepsAll.filter((s) => s.level > start && s.level <= target);

    const totalCoins = cumCost[target] - cumCost[start];
    const totals = totalsForPlan(plan, steps, itemType);

    const banner = `
      <div class="banner info">
        Очікувана вартість з +${start} до +${target}:
        <b>${fmt(totalCoins)}</b> монет · <b>${fmtGold(totalCoins, settings.goldPrice)}</b>
        &nbsp;·&nbsp; міражів: <b>${fmt(totals.mirages)}</b>
      </div>
    `;


    const rows = steps.map((s) => {
      const meta = STONE_META[s.method];
      const cumHere = cumCost[s.level] - cumCost[start];
      return `
        <tr>
          <td><b>+${s.level}</b></td>
          <td><span class="badge ${meta.cls}">${meta.label}</span></td>
          <td class="num">${(s.successRate * 100).toFixed(2)}%</td>
          <td class="num">${fmt2(1 / s.successRate)}</td>
          <td class="num">
            ${fmt(cumHere)}
            <div class="sub">${fmtGold(cumHere, settings.goldPrice)}</div>
          </td>
          <td class="num">
            ${fmt(s.stepCost)}
            <div class="sub">${fmtGold(s.stepCost, settings.goldPrice)}</div>
          </td>
        </tr>`;
    }).join('');

    refineResult.innerHTML = `
      ${banner}
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Рівень</th>
              <th>Метод</th>
              <th class="num">Шанс</th>
              <th class="num">Спроб, сер.</th>
              <th class="num">Загальна ціна</th>
              <th class="num">Ціна за рівень</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="muted" style="margin-top:12px;font-size:13px">
        «Загальна ціна» — сумарна очікувана вартість з поточного рівня
        (+${start}) до даного. «Ціна за рівень» — наскільки збільшується
        ця сума на цьому кроці. Формула кроку враховує штраф повернення:
        <code>E = (вартість_спроби + (1−p)·штраф) / p</code>.
      </p>
    `;
  }

  // =========================================================
  // ЯЙЦЯ ТА КРАФТ — ДАНІ
  // =========================================================

  // Рецепти крафту: ★N збирається з перелічених нижчих шарів (count × level).
  const RECIPES = {
    2:  { 1: 4 },
    3:  { 1: 2, 2: 2 },
    4:  { 1: 1, 2: 1, 3: 2 },
    5:  { 3: 1, 4: 2 },
    6:  { 3: 1, 5: 2 },
    7:  { 4: 1, 5: 1, 6: 1 },
    8:  { 5: 1, 6: 1, 7: 1 },
    9:  { 6: 1, 7: 1, 8: 1 },
    10: { 7: 1, 8: 1, 9: 1 },
    11: { 8: 1, 9: 1, 10: 1 },
    12: { 9: 1, 10: 1, 11: 1 },
  };

  // Ймовірності дропу з яйця (10% — камінь, ігнорується для шарів).
  const EGG_DROP_CRAFT = { 1: 0.71, 2: 0.11, 3: 0.08 };

  // ★1-еквівалент кожного рівня — обчислюється з RECIPES.
  const ONE_STAR_EQ = (() => {
    const eq = { 1: 1 };
    for (let lv = 2; lv <= 12; lv++) {
      let sum = 0;
      for (const [sub, qty] of Object.entries(RECIPES[lv])) {
        sum += qty * eq[Number(sub)];
      }
      eq[lv] = sum;
    }
    return eq;
  })();

  // Очікувана кількість ★1-еквівалентів на 1 яйце (≈ 1.95).
  const EGG_EQ_ONE_STAR =
    EGG_DROP_CRAFT[1] * ONE_STAR_EQ[1] +
    EGG_DROP_CRAFT[2] * ONE_STAR_EQ[2] +
    EGG_DROP_CRAFT[3] * ONE_STAR_EQ[3];

  // Очікувана кількість яєць для одного шара ★N — round-up від ★1-екв / 1.95.
  const EGGS_FOR_LEVEL = [0];
  for (let lv = 1; lv <= 12; lv++) {
    EGGS_FOR_LEVEL.push(Math.ceil(ONE_STAR_EQ[lv] / EGG_EQ_ONE_STAR));
  }

  function computeEggsTable() {
    const rows = [];
    const eggPrice = getEggPrice();
    for (let lvl = 1; lvl <= 12; lvl++) {
      const eggsCount = EGGS_FOR_LEVEL[lvl];
      rows.push({
        level: lvl,
        eggs: eggsCount,
        coinCost: eggsCount * eggPrice,
      });
    }
    return rows;
  }

  function renderEggs() {
    const rows = computeEggsTable();

    const pick = (lvl) => rows[lvl - 1];
    const summary = `
      <div class="result-summary">
        <div class="metric accent">
          <span class="metric-label">Шар ★1</span>
          <span class="metric-value">${fmt(pick(1).eggs)}</span>
          <span class="metric-sub">яєць · ${fmt(pick(1).coinCost)} монет</span>
        </div>
        <div class="metric">
          <span class="metric-label">Шар ★6</span>
          <span class="metric-value">${fmt(pick(6).eggs)}</span>
          <span class="metric-sub">яєць · ${fmtGold(pick(6).coinCost, settings.goldPrice)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Шар ★10</span>
          <span class="metric-value">${fmt(pick(10).eggs)}</span>
          <span class="metric-sub">яєць · ${fmtGold(pick(10).coinCost, settings.goldPrice)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Шар ★12</span>
          <span class="metric-value">${fmt(pick(12).eggs)}</span>
          <span class="metric-sub">яєць · ${fmtGold(pick(12).coinCost, settings.goldPrice)}</span>
        </div>
      </div>
    `;

    const tableRows = rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1].coinCost : 0;
      const step = r.coinCost - prev;
      return `
        <tr>
          <td><span class="badge orb">★${r.level}</span></td>
          <td class="num">${fmt(r.eggs)}</td>
          <td class="num">
            ${fmt(r.coinCost)}
            <div class="sub">${fmtGold(r.coinCost, settings.goldPrice)}</div>
          </td>
          <td class="num">
            ${fmt(step)}
            <div class="sub">${fmtGold(step, settings.goldPrice)}</div>
          </td>
        </tr>
      `;
    }).join('');

    $('#eggResult').innerHTML = `
      <div class="banner info">
        Ціна шара ★N = <code>яйця(★N) × ціна яйця</code>.
        Поточна ціна яйця: <b>${fmt(getEggPrice())}</b> монет (поле над таблицею).
        Кількість яєць — ймовірнісна оцінка <code>⌈★1-екв(N)/1.95⌉</code>.
      </div>
      ${summary}
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Шар</th>
              <th class="num">Потрібно яєць</th>
              <th class="num">Загальна ціна</th>
              <th class="num">Ціна за рівень</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <p class="muted" style="margin-top:12px;font-size:13px">
        «Загальна ціна» — вартість одного шара ★N (з нуля). «Ціна за рівень» —
        наскільки дорожчий шар цього рівня порівняно з попереднім.
      </p>
    `;
  }

  // =========================================================
  // ПОРІВНЯННЯ
  // =========================================================

  const compareForm = $('#compareForm');
  compareForm.addEventListener('change', renderCompare);

  // Спільне поле eggPrice на табах compare/eggs/craft. Усі інпути з класом
  // .egg-price-input синхронізуються між собою, getEggPrice() читає
  // перший валідний.
  function getEggPrice() {
    for (const inp of document.querySelectorAll('.egg-price-input')) {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return 2 * settings.goldPrice;
  }

  function applyDefaultEggPrice() {
    const v = 2 * settings.goldPrice;
    document.querySelectorAll('.egg-price-input').forEach((el) => {
      el.value = v;
    });
  }

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t && t.classList && t.classList.contains('egg-price-input'))) return;
    eggPriceTouched = true;
    const v = parseFloat(t.value);
    if (Number.isFinite(v) && v > 0) {
      document.querySelectorAll('.egg-price-input').forEach((el) => {
        if (el !== t) el.value = v;
      });
    }
    renderAll();
  });

  function renderCompare() {
    const itemType = $('input[name="cmpType"]:checked').value;
    const { cumCost, plan } = buildPlan(itemType, 'auto');
    const eggs = computeEggsTable();
    const eggPrice = getEggPrice();

    let stoneWins = 0, orbWins = 0;
    const tableRows = [];

    // Колонки шарів тепер вимірюються в монетах через ціну яйця:
    //   ціна_за_рівень = яйця(★N) × eggPrice
    //   загальна_ціна  = сумарні_яйця(★1..★N) × eggPrice
    const orbEggsByLevel = [0];
    for (let k = 1; k <= 12; k++) {
      orbEggsByLevel[k] = orbEggsByLevel[k - 1] + eggs[k - 1].eggs;
    }
    const orbCumByLevel = orbEggsByLevel.map((e) => e * eggPrice);

    for (let n = 1; n <= 12; n++) {
      const stoneCum = cumCost[n];                            // камені: сума з +0 до +n
      const stoneStep = plan[n - 1].stepCost;                 // камені: приріст на цьому рівні
      const orbStepEggs = eggs[n - 1].eggs;
      const orbCumEggs = orbEggsByLevel[n];
      const orbCum = orbCumByLevel[n];                        // шари: сума ★1..★n у монетах
      const orbStep = orbStepEggs * eggPrice;                 // шари: ціна шара ★n у монетах

      const diff = stoneCum - orbCum;
      const winner = Math.abs(diff) < 1 ? 'tie' : diff > 0 ? 'orb' : 'stones';
      if (winner === 'orb') orbWins++;
      if (winner === 'stones') stoneWins++;

      const savings = Math.abs(diff);
      const maxCost = Math.max(stoneCum, orbCum);
      const savingsPct = maxCost > 0 ? (savings / maxCost) * 100 : 0;
      const winnerBadge = winner === 'orb'
        ? '<span class="badge good">Шар</span>'
        : winner === 'stones'
          ? '<span class="badge good">Камені</span>'
          : '<span class="badge">Однаково</span>';

      const stepDiff = stoneStep - orbStep;
      const stepWinner = Math.abs(stepDiff) < 1 ? 'tie' : stepDiff > 0 ? 'orb' : 'stones';
      const stepSavings = Math.abs(stepDiff);
      const maxStep = Math.max(stoneStep, orbStep);
      const stepSavingsPct = maxStep > 0 ? (stepSavings / maxStep) * 100 : 0;
      const chosenStone = STONE_META[plan[n - 1].method];

      const stepEq = ONE_STAR_EQ[n];
      let cumEq = 0;
      for (let k = 1; k <= n; k++) cumEq += ONE_STAR_EQ[k];

      const recipeStr = n === 1
        ? '★1 — базовий шар (1 ★1-екв)'
        : `★${n} = ` + Object.entries(RECIPES[n])
            .map(([sub, qty]) => `${qty}×★${sub}`).join(' + ')
          + ` = ${stepEq} ★1-екв`;

      const tipBodyStep =
        `${recipeStr}. ` +
        `Яєць у середньому: ⌈${stepEq}/1.95⌉ = ${orbStepEggs} ` +
        `(одне яйце дає 0.71·1 + 0.11·4 + 0.08·10 = 1.95 ★1). ` +
        `Ціна = ${orbStepEggs} × ${fmt(eggPrice)} монет за яйце = ${fmt(orbStep)} монет.`;

      const tipBodyCum =
        `Сума ★1..★${n}: щоб дійти до +${n} треба весь ланцюжок шарів ` +
        `(★N піднімає лише на 1 рівень). Загалом ${cumEq} ★1-екв. ` +
        `Яєць сумарно: ${orbCumEggs}. Ціна = ${orbCumEggs} × ${fmt(eggPrice)} = ${fmt(orbCum)} монет.`;

      tableRows.push(`
        <tr class="${winner !== 'tie' ? 'winner' : ''}">
          <td><b>+${n}</b></td>
          <td class="num">
            ${fmt(stoneCum)}
            <div class="sub">${fmtGold(stoneCum, settings.goldPrice)}</div>
          </td>
          <td class="num">
            <span class="has-tip" tabindex="0">${fmt(orbCum)}<span class="tip-body">${tipBodyCum}</span></span>
            <div class="sub">${fmt(orbCumEggs)} яєць</div>
          </td>
          <td class="num">
            ${fmt(stoneStep)}
            <div class="sub">${fmtGold(stoneStep, settings.goldPrice)}</div>
          </td>
          <td class="num">
            <span class="has-tip" tabindex="0">${fmt(orbStep)}<span class="tip-body">${tipBodyStep}</span></span>
            <div class="sub">${fmt(orbStepEggs)} яєць</div>
          </td>
          <td><span class="badge ${chosenStone.cls}">${chosenStone.label}</span></td>
          <td class="num">
            <span class="badge orb">★${n}</span>
            <div class="sub">${fmt(eggs[n - 1].eggs)} яєць</div>
          </td>
          <td>${winnerBadge}</td>
          <td class="num">
            ${winner === 'tie' ? '—' : fmt(savings)}
            <div class="sub">${savingsPct.toFixed(1)}%</div>
          </td>
          <td class="num">
            ${stepWinner === 'tie' ? '—' : fmt(stepSavings)}
            <div class="sub">${stepWinner === 'tie' ? '' : `${stepSavingsPct.toFixed(1)}%`}</div>
          </td>
        </tr>
      `);
    }

    const summary = `
      <div class="result-summary">
        <div class="metric">
          <span class="metric-label">Камені вигідні</span>
          <span class="metric-value">${stoneWins}</span>
          <span class="metric-sub">із 12 рівнів</span>
        </div>
        <div class="metric">
          <span class="metric-label">Шари вигідні</span>
          <span class="metric-value">${orbWins}</span>
          <span class="metric-sub">із 12 рівнів</span>
        </div>
        <div class="metric">
          <span class="metric-label">+12 камнями</span>
          <span class="metric-value">${fmtGold(cumCost[12], settings.goldPrice)}</span>
          <span class="metric-sub">${fmt(cumCost[12])} монет</span>
        </div>
        <div class="metric accent">
          <span class="metric-label">+12 шарами ★1..★12</span>
          <span class="metric-value">${fmt(orbCumByLevel[12])}</span>
          <span class="metric-sub">${fmt(orbEggsByLevel[12])} яєць · ${fmt(eggPrice)}/яйце</span>
        </div>
      </div>
    `;

    $('#compareResult').innerHTML = `
      ${summary}
      <div class="table-wrap">
        <table class="data-table compare-table">
          <thead>
            <tr>
              <th>Рівень</th>
              <th class="num">Загальна ціна<br><small>камені</small></th>
              <th class="num">Загальна ціна<br><small>шари</small></th>
              <th class="num">Ціна за рівень<br><small>камені</small></th>
              <th class="num">Ціна за рівень<br><small>шари</small></th>
              <th>Оптим. камінь</th>
              <th class="num">Шаром ★N</th>
              <th>Дешевше</th>
              <th class="num">Економія</th>
              <th class="num">Економія за рівень</th>
            </tr>
          </thead>
          <tbody>${tableRows.join('')}</tbody>
        </table>
      </div>
      <p class="muted" style="margin-top:12px;font-size:13px">
        <b>Загальна ціна (камені)</b> — сумарна очікувана вартість пройти
        з +0 до +N оптимальним поєднанням каменів (у монетах).
        <b>Загальна ціна (шари)</b> — <code>сумарні_яйця × ціна_яйця</code>;
        один ★N орб підвищує лише на 1 рівень, тож щоб дійти до +N
        треба весь ланцюжок ★1+★2+…+★N.
        <b>Ціна за рівень (шари)</b> — <code>яйця(★N) × ціна_яйця</code>.
        <b>Шаром ★N</b> — кількість золотих яєць у середньому на 1 шар
        відповідного рівня. Ціна яйця змінюється у полі над таблицею
        (дефолт = 2 × ціна голди, тобто 1 яйце ≈ 1 ★1 шар).
      </p>
    `;
  }

  // =========================================================
  // КРАФТ ШАРІВ
  // =========================================================

  /** Симуляція відкриття яєць — випадковий дроп. */
  function simulateEggs(n) {
    const counts = { 1: 0, 2: 0, 3: 0 };
    const weights = [
      { lv: 1, w: EGG_DROP_CRAFT[1] },
      { lv: 2, w: EGG_DROP_CRAFT[2] },
      { lv: 3, w: EGG_DROP_CRAFT[3] },
      { lv: 0, w: 0.10 },
    ];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      let acc = 0;
      for (const { lv, w } of weights) {
        acc += w;
        if (r <= acc) { if (lv) counts[lv]++; break; }
      }
    }
    return counts;
  }

  /**
   * Будує план крафту: що робити, з чого, скільки бракує ★1.
   * Рекурсивно «розбирає» ціль на складові, використовуючи інвентар.
   */
  function buildCraftPlan(inv, targetLv, targetQty) {
    const stock = {};
    for (let i = 1; i <= 12; i++) stock[i] = inv[i] || 0;
    const make = {};
    for (let i = 2; i <= 12; i++) make[i] = 0;
    let needFirst = 0;

    function produce(lv, count) {
      if (count <= 0) return;
      if (lv === 1) {
        if (stock[1] >= count) stock[1] -= count;
        else { needFirst += count - stock[1]; stock[1] = 0; }
        return;
      }
      if (stock[lv] >= count) { stock[lv] -= count; return; }
      const need = count - stock[lv];
      stock[lv] = 0;
      const req = RECIPES[lv] || {};
      for (const [sub, qty] of Object.entries(req)) {
        produce(Number(sub), qty * need);
      }
      make[lv] += need;
    }

    produce(targetLv, targetQty);

    const remains = {};
    for (let i = 1; i <= 12; i++) remains[i] = stock[i];
    return { needFirst, make, remains };
  }

  // ---------- UI ----------

  function buildCraftInventory() {
    const wrap = $('#craftInv');
    wrap.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
      const row = document.createElement('div');
      row.className = 'inv-row';
      row.innerHTML = `
        <span class="badge orb">★${i}</span>
        <input type="number" id="invLv${i}" min="0" max="99999" step="1" value="0" />
      `;
      wrap.appendChild(row);
    }
  }

  function buildRecipesList() {
    const wrap = $('#recipesList');
    wrap.innerHTML = '';
    for (let lv = 2; lv <= 12; lv++) {
      const parts = Object.entries(RECIPES[lv])
        .map(([sub, qty]) => `${qty}×★${sub}`)
        .join(' + ');
      const row = document.createElement('div');
      row.className = 'recipe-row';
      row.innerHTML = `<span class="badge orb">★${lv}</span> <span class="recipe-body">= ${parts}</span>`;
      wrap.appendChild(row);
    }
  }

  function readInventory() {
    const inv = {};
    for (let i = 1; i <= 12; i++) {
      const el = document.getElementById('invLv' + i);
      const v = parseInt(el.value, 10);
      inv[i] = Number.isFinite(v) && v > 0 ? Math.min(v, 99999) : 0;
    }
    return inv;
  }

  function renderCraft() {
    const inv = readInventory();
    const eggs = Math.max(0, Math.min(99999, parseInt($('#craftEggs').value, 10) || 0));
    const targetLv = Math.max(1, Math.min(12, parseInt($('#craftTarget').value, 10) || 12));
    const qty = Math.max(1, Math.min(100, parseInt($('#craftQty').value, 10) || 1));

    const out = $('#craftResult');
    const parts = [];

    // Крок: симуляція яєць (якщо є)
    let eggDrops = null;
    if (eggs > 0) {
      eggDrops = simulateEggs(eggs);
      for (let lv = 1; lv <= 3; lv++) inv[lv] += eggDrops[lv];
      const dropLine = [1, 2, 3]
        .filter(lv => eggDrops[lv] > 0)
        .map(lv => `<span class="badge orb">★${lv}</span> × ${eggDrops[lv]}`)
        .join(', ') || '<span class="muted">нічого корисного</span>';
      parts.push(`
        <div class="banner info">
          Відкрито ${fmt(eggs)} яєць → ${dropLine}
        </div>
      `);
    }

    const plan = buildCraftPlan(inv, targetLv, qty);

    // Статистика вартості (в ★1-еквіваленті і в монетах)
    const targetEq = ONE_STAR_EQ[targetLv] * qty;
    const invEq = (() => {
      let s = 0;
      for (let i = 1; i <= 12; i++) s += (inv[i] || 0) * ONE_STAR_EQ[i];
      return s;
    })();
    const remainsEq = (() => {
      let s = 0;
      for (let i = 1; i <= 12; i++) s += (plan.remains[i] || 0) * ONE_STAR_EQ[i];
      return s;
    })();

    // Усе виражаємо через ціну яйця: 1 яйце ≈ 1.95 ★1, тому
    // 1 ★1-екв ≈ eggPrice / 1.95 монет.
    const eggPrice = getEggPrice();
    const oneStarCoinCost = eggPrice / EGG_EQ_ONE_STAR;
    const targetCoinCost = targetEq * oneStarCoinCost;
    const invCoinValue = invEq * oneStarCoinCost;
    const remainsCoinValue = remainsEq * oneStarCoinCost;
    const missingCoinCost = plan.needFirst * oneStarCoinCost;
    const missingEggs = plan.needFirst > 0 ? Math.ceil(plan.needFirst / EGG_EQ_ONE_STAR) : 0;

    parts.push(`
      <div class="result-summary">
        <div class="metric accent">
          <span class="metric-label">Ціль коштує</span>
          <span class="metric-value">${fmt(targetCoinCost)}</span>
          <span class="metric-sub">монет · ${fmtGold(targetCoinCost, settings.goldPrice)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Інвентар вартує</span>
          <span class="metric-value">${fmt(invCoinValue)}</span>
          <span class="metric-sub">монет · ${fmt(invEq)} ★1-екв</span>
        </div>
        <div class="metric ${plan.needFirst > 0 ? 'bad' : 'good'}">
          <span class="metric-label">${plan.needFirst > 0 ? 'Бракує ★1' : 'Хватає на крафт'}</span>
          <span class="metric-value">${plan.needFirst > 0 ? fmt(plan.needFirst) : '✓'}</span>
          <span class="metric-sub">${plan.needFirst > 0 ? '≈ ' + fmt(missingEggs) + ' яєць · ' + fmtGold(missingCoinCost, settings.goldPrice) : 'або надлишок інвентарю'}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Залишок після крафту</span>
          <span class="metric-value">${fmt(remainsCoinValue)}</span>
          <span class="metric-sub">монет · ${fmt(remainsEq)} ★1-екв</span>
        </div>
      </div>
    `);

    // Попередження про нестачу
    if (plan.needFirst > 0) {
      parts.push(`
        <div class="banner" style="color:#ffc2c6;background:rgba(255,94,108,0.06);border-color:rgba(255,94,108,0.35)">
          <b>Не вистачає шарів для повного крафту.</b><br/>
          Докупити <b>${fmt(plan.needFirst)}</b> × <span class="badge orb">★1</span>
          (${fmt(missingCoinCost)} монет · ${fmtGold(missingCoinCost, settings.goldPrice)}).
          Орієнтовно <b>${fmt(missingEggs)}</b> золотих яєць, якщо вибивати з яєць.
        </div>
      `);
    } else {
      // План крафту
      const steps = [];
      let idx = 1;
      for (let lv = 2; lv <= 12; lv++) {
        const c = plan.make[lv];
        if (c > 0) {
          const recipe = Object.entries(RECIPES[lv])
            .map(([sub, qty]) => `${qty * c} × <span class="badge orb">★${sub}</span>`)
            .join(' + ');
          steps.push(`
            <div class="craft-step">
              <span class="step-idx">${idx++}</span>
              Скрафтити <b style="color:var(--accent-2)">${c}</b> ×
              <span class="badge orb">★${lv}</span> з ${recipe}
            </div>
          `);
        }
      }
      if (steps.length === 0) {
        parts.push('<div class="banner info">Нічого крафтити — у інвентарі вже є потрібні шари.</div>');
      } else {
        parts.push(`<div class="craft-steps"><h3 class="craft-h">План крафту</h3>${steps.join('')}</div>`);
      }

      // Залишки
      const leftovers = Object.entries(plan.remains).filter(([, q]) => q > 0);
      if (leftovers.length > 0) {
        const list = leftovers
          .map(([lv, q]) => `<span class="badge orb">★${lv}</span> × ${q}`)
          .join(', ');
        parts.push(`
          <div class="craft-leftovers">
            <h3 class="craft-h">Залишки в інвентарі</h3>
            <div class="leftover-line">${list}</div>
          </div>
        `);
      }
    }

    out.innerHTML = parts.join('');
  }

  $('#craftCalc').addEventListener('click', renderCraft);
  $('#craftReset').addEventListener('click', () => {
    for (let i = 1; i <= 12; i++) $('#invLv' + i).value = 0;
    $('#craftEggs').value = 0;
    $('#craftResult').innerHTML = '';
  });

  // =========================================================
  // СИМУЛЯТОР
  // =========================================================

  const SIM_DEFAULT_START = 0;
  const SIM_DEFAULT_TARGET = 12;
  const SIM_HISTORY_MAX = 200;
  const SIM_SPEEDS = {
    slow:  { batch: 1,    delay: 200 },
    med:   { batch: 1,    delay: 16  },
    fast:  { batch: 50,   delay: 0   },
    turbo: { batch: 5000, delay: 0   },
  };

  const simState = {
    itemType: 'armor',
    start: SIM_DEFAULT_START,
    target: SIM_DEFAULT_TARGET,
    currentLevel: SIM_DEFAULT_START,
    bestLevel: SIM_DEFAULT_START,
    selectedStone: null,
    totalAttempts: 0,
    mirages: 0,
    stones:          { mirage: 0, under: 0, sky: 0, world: 0 },
    successByStone:  { mirage: 0, under: 0, sky: 0, world: 0 },
    failByStone:     { mirage: 0, under: 0, sky: 0, world: 0 },
    lastAttempt: null,
    history: [],
    running: false,
    rafId: null,
    timerId: null,
  };
  let simHistoryRenderedAt = 0;

  function simStop() {
    simState.running = false;
    if (simState.rafId) cancelAnimationFrame(simState.rafId);
    if (simState.timerId) clearTimeout(simState.timerId);
    simState.rafId = null;
    simState.timerId = null;
  }

  function simResetCounters() {
    simState.currentLevel = simState.start;
    simState.bestLevel = simState.start;
    simState.totalAttempts = 0;
    simState.mirages = 0;
    simState.stones         = { mirage: 0, under: 0, sky: 0, world: 0 };
    simState.successByStone = { mirage: 0, under: 0, sky: 0, world: 0 };
    simState.failByStone    = { mirage: 0, under: 0, sky: 0, world: 0 };
    simState.lastAttempt = null;
    simState.history = [];
    simHistoryRenderedAt = 0;
  }

  function simReset() {
    simStop();
    simResetCounters();
    simRender();
  }

  /** Виконує одну спробу заточки і оновлює стан. Повертає true, якщо
   *  спроба була зроблена. */
  function simAttempt(stone) {
    const nextLv = simState.currentLevel + 1;
    // Заточуватись можна аж до максимального +12 — цільовий рівень тут
    // не є межею для ручних спроб (auto-цикли стопляться окремо за `target`).
    if (nextLv > 12) return false;
    const p = RATES[stone] && RATES[stone][nextLv];
    if (!p || p <= 0) return false;

    simState.totalAttempts++;
    simState.mirages += miragesPerAttempt(simState.itemType);
    simState.stones[stone]++;

    const success = Math.random() < p;
    const beforeLv = simState.currentLevel;
    if (success) {
      simState.currentLevel = nextLv;
      simState.successByStone[stone]++;
    } else {
      simState.failByStone[stone]++;
      if (stone === 'world') {
        // рівень зберігається
      } else if (stone === 'under') {
        simState.currentLevel = Math.max(0, simState.currentLevel - 1);
      } else {
        // mirage / sky → +0
        simState.currentLevel = 0;
      }
    }
    if (simState.currentLevel > simState.bestLevel) {
      simState.bestLevel = simState.currentLevel;
    }
    simState.lastAttempt = { stone, success, before: beforeLv, after: simState.currentLevel };
    simState.history.push({
      idx: simState.totalAttempts,
      stone,
      success,
      before: beforeLv,
      after: simState.currentLevel,
    });
    // Лінива обрізка: тримаємо в пам'яті не більше ніж 2× ліміт, щоб
    // splice спрацьовував рідко (амортизована O(1) на додавання).
    if (simState.history.length > SIM_HISTORY_MAX * 2) {
      simState.history.splice(0, simState.history.length - SIM_HISTORY_MAX);
    }
    return true;
  }

  function simRunAuto(mode) {
    if (simState.running) return;
    if (simState.currentLevel >= simState.target) {
      simRender();
      return;
    }

    let attemptFn;
    if (mode === 'optimal') {
      const { plan } = buildPlan(simState.itemType, 'auto');
      attemptFn = () => {
        const lv = simState.currentLevel + 1;
        if (lv > 12) return false;
        const m = plan[lv - 1] && plan[lv - 1].method;
        if (!m) return false;
        return simAttempt(m);
      };
    } else {
      if (!simState.selectedStone) {
        simState.selectedStone = 'mirage';
      }
      attemptFn = () => simAttempt(simState.selectedStone);
    }

    simState.running = true;
    simRender();

    function step() {
      if (!simState.running) return;
      const speed = SIM_SPEEDS[$('#simSpeed').value] || SIM_SPEEDS.med;

      for (let i = 0; i < speed.batch; i++) {
        if (!simState.running) break;
        if (simState.currentLevel >= simState.target) break;
        if (!attemptFn()) break;
      }

      simRender();

      if (simState.currentLevel >= simState.target) {
        simStop();
        simRender();
        return;
      }
      if (!simState.running) return;

      if (speed.delay > 0) {
        simState.timerId = setTimeout(step, speed.delay);
      } else {
        simState.rafId = requestAnimationFrame(step);
      }
    }

    step();
  }

  function simRender() {
    if (!document.getElementById('simCurrentLevel')) return; // panel ще не зібраний
    const cur = simState.currentLevel;
    const target = simState.target;

    $('#simCurrentLevel').textContent = '+' + cur;
    $('#simTargetDisplay').textContent =
      'Ціль: +' + target + (cur >= target ? '  ✓' : '');

    const progress = target > 0
      ? Math.max(0, Math.min(100, (cur / target) * 100))
      : 100;
    $('#simProgressBar').style.width = progress + '%';

    const nextLv = cur + 1;
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    const mirPerAtt = miragesPerAttempt(simState.itemType);
    const mirageGoldPerAtt = (mirPerAtt * settings.miragePrice) / settings.goldPrice;
    for (const stone of ['mirage', 'under', 'sky', 'world']) {
      const el = document.getElementById('rate' + cap(stone));
      if (el) {
        if (nextLv > 12) {
          el.textContent = '—';
        } else {
          const p = RATES[stone][nextLv];
          el.textContent = p ? (p * 100).toFixed(2) + '%' : '—';
        }
      }
      const priceEl = document.getElementById('price' + cap(stone));
      if (priceEl) {
        if (stone === 'mirage') {
          // Камінця як такого немає — показуємо вартість міражів за спробу.
          priceEl.textContent = fmt2(mirageGoldPerAtt) + ' г / спробу';
        } else {
          const stonePrice = settings[STONE_META[stone].priceKey];
          priceEl.textContent = fmt2(stonePrice) + ' г / шт';
        }
      }
    }

    $$('.stone-btn').forEach((b) => {
      const sel = b.dataset.stone === simState.selectedStone;
      b.classList.toggle('selected', sel);
      b.setAttribute('aria-checked', String(sel));
      // Радіо-вибір: можна перевибирати навіть на максимумі (поки не запущено).
      b.disabled = simState.running;
    });
    $('#simStep').disabled =
      simState.running || cur >= 12 || !simState.selectedStone;
    $('#simRunSelected').disabled = simState.running || cur >= target;
    $('#simRunOptimal').disabled = simState.running || cur >= target;
    $('#simStop').disabled = !simState.running;

    const last = simState.lastAttempt;
    const lastEl = $('#simLastResult');
    const runIndicator = simState.running ? ' <span class="sim-running">⟳ симулюємо…</span>' : '';
    if (!last) {
      const base = simState.totalAttempts === 0
        ? 'Натисни на камінець, щоб зробити спробу, або запусти авто-симуляцію.'
        : 'Спроб усього: ' + fmt(simState.totalAttempts);
      lastEl.innerHTML = base + runIndicator;
    } else {
      const meta = STONE_META[last.stone];
      const arrow = last.success
        ? '<span class="succ">✓ успіх</span> · +' + last.before + ' → +' + last.after
        : '<span class="fail">✗ провал</span> · +' + last.before + ' → +' + last.after;
      lastEl.innerHTML =
        'Останнє: <span class="badge ' + meta.cls + '">' + meta.label + '</span> ' +
        arrow + runIndicator;
    }

    const bestEl = $('#simBestResult');
    if (bestEl) {
      if (simState.bestLevel > cur) {
        bestEl.hidden = false;
        bestEl.innerHTML =
          '<span class="sim-best-text">Найкращий рівень, який ви могли мати… але збили:</span> ' +
          '<span class="sim-best-value">+' + simState.bestLevel + '</span>';
      } else {
        bestEl.hidden = true;
      }
    }

    simRenderHistory();
    simRenderStats();
  }

  function simRenderHistory() {
    const out = $('#simHistory');
    const cnt = $('#simHistoryCount');
    if (!out) return;

    // Дроселимо рендер історії під час біжучої симуляції — ~10 fps
    // (200 рядків × 60 fps × innerHTML — забагато).
    if (simState.running) {
      const now = performance.now();
      if (now - simHistoryRenderedAt < 100) return;
      simHistoryRenderedAt = now;
    }

    if (simState.history.length === 0 && simState.totalAttempts === 0) {
      out.innerHTML =
        '<div class="hist-empty muted">Поки що порожньо. Натисни на камінець або запусти авто-симуляцію.</div>';
      if (cnt) cnt.textContent = '0 спроб';
      return;
    }

    const visible = simState.history.slice(-SIM_HISTORY_MAX);
    if (cnt) {
      cnt.textContent = simState.totalAttempts > visible.length
        ? 'останні ' + fmt(visible.length) + ' з ' + fmt(simState.totalAttempts) + ' спроб'
        : fmt(simState.totalAttempts) + ' спроб';
    }

    const rows = new Array(visible.length);
    // Newest at top: ітеруємо з кінця масиву.
    for (let i = visible.length - 1, j = 0; i >= 0; i--, j++) {
      const h = visible[i];
      const meta = STONE_META[h.stone];
      const cls = h.success ? 'succ' : 'fail';
      const mark = h.success ? '✓' : '✗';
      rows[j] =
        '<div class="hist-row ' + cls + '">' +
          '<span class="hist-idx">#' + fmt(h.idx) + '</span>' +
          '<span class="badge ' + meta.cls + '">' + meta.label + '</span>' +
          '<span class="hist-mid">+' + h.before + ' → +' + h.after + '</span>' +
          '<span class="hist-mark ' + cls + '">' + mark + '</span>' +
        '</div>';
    }
    out.innerHTML = rows.join('');
  }

  function simRenderStats() {
    const out = $('#simResult');
    if (!out) return;
    if (simState.totalAttempts === 0) {
      out.innerHTML = '';
      return;
    }

    const mirPerAtt = miragesPerAttempt(simState.itemType);
    const mirageCoinsTotal = simState.mirages * settings.miragePrice;
    const stoneCoins =
      simState.stones.under * settings.underPrice * settings.goldPrice +
      simState.stones.sky   * settings.skyPrice   * settings.goldPrice +
      simState.stones.world * settings.worldPrice * settings.goldPrice;
    const totalCost = mirageCoinsTotal + stoneCoins;
    const reachedTarget = simState.currentLevel >= simState.target;
    const stonesUsed =
      simState.stones.under + simState.stones.sky + simState.stones.world;

    const stoneRows = ['mirage', 'under', 'sky', 'world']
      .filter((s) => simState.stones[s] > 0)
      .map((s) => {
        const meta = STONE_META[s];
        const total = simState.stones[s];
        const succ = simState.successByStone[s];
        const fail = simState.failByStone[s];
        const realPct = total > 0 ? ((succ / total) * 100).toFixed(2) : '0.00';
        const mirShare = total * mirPerAtt * settings.miragePrice;
        const stoneShare = s === 'mirage'
          ? 0
          : total * settings[STONE_META[s].priceKey] * settings.goldPrice;
        const cost = mirShare + stoneShare;
        return (
          '<tr>' +
            '<td><span class="badge ' + meta.cls + '">' + meta.label + '</span></td>' +
            '<td class="num">' + fmt(total) + '</td>' +
            '<td class="num">' + fmt(succ) + '</td>' +
            '<td class="num">' + fmt(fail) + '</td>' +
            '<td class="num">' + realPct + '%</td>' +
            '<td class="num">' + fmt(cost) +
              '<div class="sub">' + fmtGold(cost, settings.goldPrice) + '</div>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');

    let comparison = '';
    if (reachedTarget) {
      try {
        const { cumCost } = buildPlan(simState.itemType, 'auto');
        const expectedCost = cumCost[simState.target] - cumCost[simState.start];
        const diff = totalCost - expectedCost;
        const diffPct = expectedCost > 0 ? (diff / expectedCost) * 100 : 0;
        const sign = diff > 0 ? '+' : '';
        const color = diff < 0 ? 'var(--good)' : diff > 0 ? 'var(--bad)' : 'inherit';
        comparison =
          '<div class="banner info" style="margin-top:14px">' +
            'Очікувана вартість (оптимальний план): <b>' + fmt(expectedCost) + '</b> монет · ' +
            '<b>' + fmtGold(expectedCost, settings.goldPrice) + '</b>. ' +
            'Різниця з фактом: <b style="color:' + color + '">' + sign + fmt(diff) +
            ' монет (' + sign + diffPct.toFixed(1) + '%)</b>.' +
          '</div>';
      } catch (e) { /* ігноруємо помилку */ }
    }

    const stoppedNote = simState.running
      ? ''
      : (reachedTarget
          ? '<div class="banner" style="background:rgba(53,224,161,0.08);border-color:rgba(53,224,161,0.35);color:#9bf3d3">' +
              '<b>✓ Ціль досягнута!</b> Підсумок симуляції нижче.' +
            '</div>'
          : '<div class="banner">Симуляція зупинена. Підсумок поточного прогону нижче.</div>');

    out.innerHTML =
      stoppedNote +
      '<div class="result-summary">' +
        '<div class="metric ' + (reachedTarget ? 'good' : 'accent') + '">' +
          '<span class="metric-label">' + (reachedTarget ? 'Ціль досягнута' : 'Поточний рівень') + '</span>' +
          '<span class="metric-value">+' + simState.currentLevel + '</span>' +
          '<span class="metric-sub">' + (reachedTarget ? 'старт +' + simState.start + ' → +' + simState.target : 'ціль +' + simState.target) + '</span>' +
        '</div>' +
        '<div class="metric">' +
          '<span class="metric-label">Загальна вартість</span>' +
          '<span class="metric-value">' + fmt(totalCost) + '</span>' +
          '<span class="metric-sub">' + fmtGold(totalCost, settings.goldPrice) + '</span>' +
        '</div>' +
        '<div class="metric">' +
          '<span class="metric-label">Спроб</span>' +
          '<span class="metric-value">' + fmt(simState.totalAttempts) + '</span>' +
          '<span class="metric-sub">міражів: ' + fmt(simState.mirages) + '</span>' +
        '</div>' +
        '<div class="metric">' +
          '<span class="metric-label">Камінців</span>' +
          '<span class="metric-value">' + fmt(stonesUsed) + '</span>' +
          '<span class="metric-sub">під: ' + fmt(simState.stones.under) +
            ' · неб: ' + fmt(simState.stones.sky) +
            ' · світ: ' + fmt(simState.stones.world) + '</span>' +
        '</div>' +
      '</div>' +
      (stoneRows
        ? '<div class="table-wrap">' +
            '<table class="data-table">' +
              '<thead><tr>' +
                '<th>Камінь</th>' +
                '<th class="num">Спроб</th>' +
                '<th class="num">Успіх</th>' +
                '<th class="num">Провал</th>' +
                '<th class="num">Факт. %<br><small>з симуляції</small></th>' +
                '<th class="num">Вартість</th>' +
              '</tr></thead>' +
              '<tbody>' + stoneRows + '</tbody>' +
            '</table>' +
          '</div>' +
          '<p class="muted" style="margin-top:10px;font-size:12.5px">' +
            '<b>Факт. %</b> — спостережений % успіху саме в цій симуляції ' +
            '(успіхи ÷ спроби, об\'єднано по всіх рівнях, де використовувався ' +
            'цей камінь). На малій вибірці він <b>не зобов\'язаний</b> ' +
            'збігатися з табличним шансом для конкретного рівня з вкладки ' +
            '«Заточка» (напр. світобудови на +10 = 0.07%, але в прогоні з ' +
            '1 успіх / 1616 спроб реальний результат ≈ 0.06%).' +
          '</p>'
        : '') +
      comparison;
  }

  function simInit() {
    const startSel = $('#simStart');
    const targetSel = $('#simTarget');
    if (!startSel || !targetSel) return;

    for (let i = 0; i <= 11; i++) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = '+' + i;
      if (i === SIM_DEFAULT_START) o.selected = true;
      startSel.appendChild(o);
    }
    for (let i = 1; i <= 12; i++) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = '+' + i;
      if (i === SIM_DEFAULT_TARGET) o.selected = true;
      targetSel.appendChild(o);
    }

    $$('input[name="simType"]').forEach((r) => {
      r.addEventListener('change', () => {
        simState.itemType = $('input[name="simType"]:checked').value;
        simReset();
      });
    });
    startSel.addEventListener('change', () => {
      const v = parseInt(startSel.value, 10);
      if (!Number.isFinite(v)) return;
      simState.start = v;
      if (simState.start >= simState.target) {
        const newT = Math.min(12, simState.start + 1);
        targetSel.value = String(newT);
        simState.target = newT;
      }
      simReset();
    });
    targetSel.addEventListener('change', () => {
      const v = parseInt(targetSel.value, 10);
      if (!Number.isFinite(v)) return;
      simState.target = v;
      if (simState.target <= simState.start) {
        const newS = Math.max(0, simState.target - 1);
        startSel.value = String(newS);
        simState.start = newS;
      }
      simReset();
    });

    $$('.stone-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (simState.running) return;
        // Радіо-поведінка: лише вибираємо камінь, без спроби.
        simState.selectedStone = btn.dataset.stone;
        simRender();
      });
    });

    $('#simStep').addEventListener('click', () => {
      if (simState.running) return;
      if (simState.currentLevel >= 12) return;
      if (!simState.selectedStone) return;
      simAttempt(simState.selectedStone);
      simRender();
    });
    $('#simRunSelected').addEventListener('click', () => simRunAuto('selected'));
    $('#simRunOptimal').addEventListener('click', () => simRunAuto('optimal'));
    $('#simStop').addEventListener('click', () => { simStop(); simRender(); });
    $('#simReset').addEventListener('click', () => {
      simState.selectedStone = 'mirage';
      simReset();
    });

    // За замовчуванням обираємо «Лише міраж», щоб «Покращити» було активне одразу.
    simState.selectedStone = 'mirage';
    simRender();
  }

  // =========================================================
  // АТАКА / ЗАХИСТ / ДЕФ / РІВЕНЬ
  // =========================================================

  // --- Фільтр 1: ПА / ПЗ ---

  // Опорні Δ для довідкової таблиці. Порядок: від найбільшої переваги ПА
  // (бонус урону) до найбільшої переваги ПЗ (макс. деф).
  const DEF_DELTA_ROWS = [
    { delta:  150, note: 'Перевага ПА +150 — шкода ×2.5.' },
    { delta:  100, note: 'Перевага ПА +100 — шкода вдвічі.' },
    { delta:   50, note: 'Перевага ПА +50 — +50% до урону.' },
    { delta:   20, note: 'Невелика перевага атаки, +20% урону.' },
    { delta:    0, note: 'ПА = ПЗ → базова шкода без модифікаторів.' },
    { delta:  -10, note: 'Початок захисту: −9% урону.' },
    { delta:  -20, note: 'Перші 20 одиниць ПЗ дають чудовий приріст.' },
    { delta:  -50, note: 'Супротивник втрачає третину сили.' },
    { delta: -100, note: '«Ponto de corte» — урон урізано рівно вдвічі.' },
    { delta: -150, note: 'Diminishing returns: −60%, але кожна одиниця дешевшає.' },
    { delta: -200, note: 'Урон зменшено на 2/3.' },
    { delta: -300, note: 'Максимально досяжна порізка у ~75% (важко в реальному бою).' },
  ];

  /** Коефіцієнт ПА/ПЗ за різницею Δ = ПА − ПЗ. */
  function paPzCoef(delta) {
    if (delta >= 0) return 1 + delta / 100;
    return 1 / (1 + Math.abs(delta) / 100);
  }

  /** Текстове представлення коефіцієнта як % зміни шкоди. */
  function coefEffectText(k) {
    if (k > 1) return '+' + ((k - 1) * 100).toFixed(0) + '% шкоди';
    if (k < 1) return '−' + ((1 - k) * 100).toFixed(0) + '% шкоди';
    return 'без змін';
  }

  // --- Фільтр 2: фіз / маг деф ---

  // Опорні значення дефу для довідкової таблиці (як у BR-теоркрафті).
  const DEF_ARMOR_VALUES = [0, 1000, 2000, 4200, 10000, 20000, 40000, 80000, 160000];

  /**
   * Частка зрізаної шкоди від фіз/маг дефу за офіційною формулою:
   *   редукція = Деф / (Деф + 40×Рівень − 85)
   * Повертає число в [0, 1).
   */
  function armorReduction(def, level) {
    if (!(def > 0)) return 0;
    const denom = def + 40 * level - 85;
    if (denom <= 0) return 0;
    const r = def / denom;
    return Math.max(0, Math.min(0.999, r));
  }

  // --- Фільтр 3: різниця рівнів ---

  /** PvP-коефіцієнт за абсолютною різницею рівнів (дзеркальний). */
  function pvpLevelCoef(levelDiff) {
    const d = Math.abs(levelDiff);
    if (d <= 2) return 1.0;
    if (d <= 5) return 0.9;
    if (d <= 8) return 0.8;
    if (d <= 11) return 0.7;
    if (d <= 15) return 0.6;
    if (d <= 20) return 0.5;
    // Понад 20 рівнів урон стрімко падає до ~0.2 (офіційні цифри приблизні).
    // Лінійна апроксимація 0.5 → 0.2 на проміжку 20..40, далі фіксовано 0.2.
    if (d >= 40) return 0.2;
    return 0.5 - (d - 20) * (0.3 / 20);
  }

  /** PvE-коефіцієнт: рівень_гравця / рівень_моба, не більше 1.0. */
  function pveLevelCoef(playerLevel, monsterLevel) {
    if (!(monsterLevel > 0)) return 1;
    return Math.min(1, playerLevel / monsterLevel);
  }

  // Діапазони для PvP-таблиці.
  const PVP_RANGES = [
    { lo: 0,  hi: 2,  k: 1.0 },
    { lo: 3,  hi: 5,  k: 0.9 },
    { lo: 6,  hi: 8,  k: 0.8 },
    { lo: 9,  hi: 11, k: 0.7 },
    { lo: 12, hi: 15, k: 0.6 },
    { lo: 16, hi: 20, k: 0.5 },
    { lo: 21, hi: null, k: null }, // 0.4…0.2
  ];

  function getDefMode() {
    const el = document.querySelector('input[name="defMode"]:checked');
    return el ? el.value : 'pvp';
  }

  // ---------- Таблиці ----------

  function buildDeltaTable() {
    const body = document.getElementById('defTableBody');
    if (!body) return;
    body.innerHTML = DEF_DELTA_ROWS.map((r) => {
      const k = paPzCoef(r.delta);
      let cls = '', badgeCls = '', deltaTxt;
      if (r.delta > 0) { cls = 'def-row-attack'; badgeCls = 'bad'; deltaTxt = '+' + r.delta; }
      else if (r.delta < 0) { cls = 'def-row-defense'; badgeCls = 'good'; deltaTxt = String(r.delta); }
      else { deltaTxt = '0'; }
      return (
        '<tr class="def-row def-row-delta ' + cls + '" data-delta="' + r.delta + '" tabindex="0">' +
          '<td><span class="badge ' + badgeCls + '">Δ ' + deltaTxt + '</span></td>' +
          '<td class="num"><b>' + k.toFixed(2) + '</b></td>' +
          '<td class="num">' + coefEffectText(k) + '</td>' +
          '<td>' + r.note + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function buildArmorTable(level) {
    const body = document.getElementById('defArmorTableBody');
    if (!body) return;
    const lvlEl = document.getElementById('defArmorTableLevel');
    if (lvlEl) lvlEl.textContent = String(level);
    body.innerHTML = DEF_ARMOR_VALUES.map((dv) => {
      const red = armorReduction(dv, level);
      const left = (1 - red) * 100;
      const near50 = Math.abs(red - 0.5) < 0.02;
      return (
        '<tr class="def-row def-row-armor' + (near50 ? ' def-row-defense' : '') + '" data-armor="' + dv + '" tabindex="0">' +
          '<td><span class="badge' + (near50 ? ' good' : '') + '">' + fmt(dv) + '</span></td>' +
          '<td class="num"><b>' + (red * 100).toFixed(1) + '%</b></td>' +
          '<td class="num">' + left.toFixed(1) + '%</td>' +
          '<td>' + (near50 ? '«Точка перелому» — урон урізано рівно вдвічі.'
                          : (dv === 0 ? 'Без дефу — чистий урон.'
                          : 'Diminishing returns: кожна нова 1k дефу зрізає все менше.')) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function buildPvpLevelTable() {
    const body = document.getElementById('defLevelTableBody');
    if (!body) return;
    body.innerHTML = PVP_RANGES.map((r) => {
      const label = r.hi === null ? 'понад ' + (r.lo - 1) : r.lo + '–' + r.hi;
      const kTxt = r.k === null ? '~0.4 … 0.2' : r.k.toFixed(2);
      const dmgTxt = r.k === null ? '~40 … 20%' : (r.k * 100).toFixed(0) + '%';
      return (
        '<tr>' +
          '<td><span class="badge">' + label + ' лвл</span></td>' +
          '<td class="num"><b>' + kTxt + '</b></td>' +
          '<td class="num">' + dmgTxt + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  // ---------- Рендер калькулятора ----------

  function renderDefense() {
    const out = document.getElementById('defResult');
    if (!out) return;

    const mode = getDefMode();
    const atk = parseFloat(($('#defAtk') || {}).value);
    const pz = parseFloat(($('#defDef') || {}).value);
    const armor = parseFloat(($('#defArmor') || {}).value);
    const atkLevel = parseInt(($('#defAtkLevel') || {}).value, 10);
    const defLevel = parseInt(($('#defDefLevel') || {}).value, 10);
    const baseDmgRaw = parseFloat(($('#defBaseDmg') || {}).value);

    // Динамічні підписи режиму.
    const defLevelLabel = document.getElementById('defDefLevelLabel');
    const defLevelHint = document.getElementById('defDefLevelHint');
    if (defLevelLabel) defLevelLabel.textContent = mode === 'pve' ? 'Рівень моба/боса' : 'Рівень цілі';
    if (defLevelHint) {
      defLevelHint.textContent = mode === 'pve'
        ? 'Рівень моба — впливає на формулу дефу та PvE-штраф.'
        : 'Рівень цілі — впливає й на формулу дефу.';
    }

    if (!Number.isFinite(atk) || atk < 0 || !Number.isFinite(pz) || pz < 0 ||
        !Number.isFinite(atkLevel) || atkLevel < 1 ||
        !Number.isFinite(defLevel) || defLevel < 1) {
      out.innerHTML = '<div class="banner">Введи коректні (невід\'ємні) значення ПА, ПЗ та рівнів.</div>';
      return;
    }

    // Завжди оновлюємо таблицю дефу під рівень цілі.
    buildArmorTable(defLevel);

    // --- Три фільтри ---
    const delta = atk - pz;
    const kPaPz = paPzCoef(delta);

    const armorVal = Number.isFinite(armor) && armor > 0 ? armor : 0;
    const reduction = armorReduction(armorVal, defLevel);
    const kArmor = 1 - reduction;

    const levelDiff = atkLevel - defLevel;
    const kLevel = mode === 'pve'
      ? pveLevelCoef(atkLevel, defLevel)
      : pvpLevelCoef(levelDiff);

    const kTotal = kPaPz * kArmor * kLevel;

    // --- Підсумкові метрики ---
    const totalCls = kTotal > 1 ? 'bad' : (kTotal < 1 ? 'good' : '');

    let dmgMetric = '';
    if (Number.isFinite(baseDmgRaw) && baseDmgRaw > 0) {
      const finalDmg = baseDmgRaw * kTotal;
      const diff = finalDmg - baseDmgRaw;
      const sign = diff >= 0 ? '+' : '−';
      dmgMetric =
        '<div class="metric ' + totalCls + '">' +
          '<span class="metric-label">Фінальна шкода</span>' +
          '<span class="metric-value">' + fmt(finalDmg) + '</span>' +
          '<span class="metric-sub">з ' + fmt(baseDmgRaw) +
            ' базової · ' + sign + fmt(Math.abs(diff)) + '</span>' +
        '</div>';
    }

    const summary =
      '<div class="result-summary' + (dmgMetric ? '' : ' three-cols') + '">' +
        '<div class="metric accent">' +
          '<span class="metric-label">Фінальний коефіцієнт</span>' +
          '<span class="metric-value">×' + kTotal.toFixed(3) + '</span>' +
          '<span class="metric-sub">' + (kTotal * 100).toFixed(1) + '% від базової · ' + coefEffectText(kTotal) + '</span>' +
        '</div>' +
        '<div class="metric">' +
          '<span class="metric-label">ПА/ПЗ (Δ ' + (delta >= 0 ? '+' : '') + fmt(delta) + ')</span>' +
          '<span class="metric-value">×' + kPaPz.toFixed(3) + '</span>' +
          '<span class="metric-sub">' + coefEffectText(kPaPz) + '</span>' +
        '</div>' +
        '<div class="metric">' +
          '<span class="metric-label">Деф (' + fmt(armorVal) + ')</span>' +
          '<span class="metric-value">−' + (reduction * 100).toFixed(1) + '%</span>' +
          '<span class="metric-sub">множник ×' + kArmor.toFixed(3) + '</span>' +
        '</div>' +
        '<div class="metric">' +
          '<span class="metric-label">Рівень (' + (mode === 'pve' ? 'PvE' : 'PvP ' + (levelDiff >= 0 ? '+' : '') + levelDiff) + ')</span>' +
          '<span class="metric-value">×' + kLevel.toFixed(3) + '</span>' +
          '<span class="metric-sub">' + coefEffectText(kLevel) + '</span>' +
        '</div>' +
        dmgMetric +
      '</div>';

    // --- Формула + поради ---
    const paPzFormula = delta >= 0
      ? 'k₁ = 1 + ' + delta + '/100 = ' + kPaPz.toFixed(3)
      : 'k₁ = 1 / (1 + ' + Math.abs(delta) + '/100) = ' + kPaPz.toFixed(3);
    const armorFormula = armorVal > 0
      ? 'k₂ = 1 − ' + armorVal + '/(' + armorVal + ' + 40×' + defLevel + ' − 85) = ' + kArmor.toFixed(3)
      : 'k₂ = 1.000 (деф = 0)';
    const levelFormula = mode === 'pve'
      ? 'k₃ = min(1, ' + atkLevel + '/' + defLevel + ') = ' + kLevel.toFixed(3)
      : 'k₃ = ' + kLevel.toFixed(3) + ' (PvP, різниця ' + Math.abs(levelDiff) + ' лвл)';

    const formula =
      '<code>фінал = k₁ × k₂ × k₃ = ' + kPaPz.toFixed(3) + ' × ' +
      kArmor.toFixed(3) + ' × ' + kLevel.toFixed(3) + ' = ' + kTotal.toFixed(3) + '</code>' +
      '<br/><span class="muted" style="font-size:12.5px">' +
        paPzFormula + ' &nbsp;·&nbsp; ' + armorFormula + ' &nbsp;·&nbsp; ' + levelFormula +
      '</span>';

    const tips = [];
    if (delta < -100) tips.push('ПА/ПЗ: ти за «точкою розрізу» (Δ &lt; −100) — кожна нова одиниця ПЗ дає &lt; 0.5% дефу.');
    else if (delta < 0) tips.push('ПА/ПЗ: до «точки розрізу» (Δ = −100, урон навпіл) ще є простір.');
    else if (delta > 0) tips.push('ПА/ПЗ: перевага атаки — кожна +1 ПА додає +1% урону.');
    if (armorVal > 0 && reduction >= 0.5) tips.push('Деф: ти вже за 50% зрізання — далі diminishing returns, кожна 1k дефу дає все менше.');
    if (mode === 'pvp' && Math.abs(levelDiff) >= 3) tips.push('Рівень: різниця ≥ 3 лвл вмикає PvP-штраф (дзеркальний для обох сторін).');
    if (mode === 'pve' && atkLevel < defLevel) tips.push('Рівень: моб вищий за тебе — урон ріжеться за k = твій_рівень/рівень_моба.');
    if (mode === 'pve' && atkLevel >= defLevel) tips.push('Рівень: ти не нижчий за моба — PvE-штрафу на урон немає (k = 1.0).');

    out.innerHTML =
      summary +
      '<div class="banner info" style="margin-top:4px">' + formula +
        (tips.length ? '<br/>' + tips.join('<br/>') : '') +
      '</div>';
  }

  function defInit() {
    const form = document.getElementById('defForm');
    if (!form) return;
    buildDeltaTable();
    buildPvpLevelTable();
    form.addEventListener('input', renderDefense);
    form.addEventListener('change', renderDefense);

    const swap = document.getElementById('defSwap');
    if (swap) {
      swap.addEventListener('click', () => {
        // Міняємо нападника ↔ ціль: ПА↔ПЗ та рівні.
        const a = document.getElementById('defAtk');
        const d = document.getElementById('defDef');
        const al = document.getElementById('defAtkLevel');
        const dl = document.getElementById('defDefLevel');
        if (a && d) { const t = a.value; a.value = d.value; d.value = t; }
        if (al && dl) { const t = al.value; al.value = dl.value; dl.value = t; }
        renderDefense();
      });
    }

    // Клік по рядку довідкових таблиць.
    document.addEventListener('click', (e) => {
      if (!e.target.closest) return;
      const deltaRow = e.target.closest('.def-row-delta');
      if (deltaRow) {
        const dlt = parseFloat(deltaRow.dataset.delta);
        const pzEl = document.getElementById('defDef');
        const atkEl = document.getElementById('defAtk');
        if (Number.isFinite(dlt) && pzEl && atkEl) {
          const pzVal = parseFloat(pzEl.value);
          if (Number.isFinite(pzVal)) {
            atkEl.value = String(Math.max(0, pzVal + dlt));
            renderDefense();
          }
        }
        return;
      }
      const armorRow = e.target.closest('.def-row-armor');
      if (armorRow) {
        const av = parseFloat(armorRow.dataset.armor);
        const armorEl = document.getElementById('defArmor');
        if (Number.isFinite(av) && armorEl) {
          armorEl.value = String(av);
          renderDefense();
        }
      }
    });

    renderDefense();
  }

  // =========================================================
  // ІНІЦІАЛІЗАЦІЯ
  // =========================================================

  function renderAll() {
    renderRefine();
    renderEggs();
    renderCompare();
    simRender();
  }

  document.addEventListener('click', (e) => {
    const tip = e.target.closest('.has-tip');
    document.querySelectorAll('.has-tip.is-open').forEach((el) => {
      if (el !== tip) el.classList.remove('is-open');
    });
    if (tip) tip.classList.toggle('is-open');
  });

  // =========================================================
  // ГАЙДИ (дані з guides-data.js -> window.PW_GUIDES)
  // =========================================================
  function guidesInit() {
    const data = window.PW_GUIDES;
    const nav = $('#guidesNav');
    const content = $('#guidesContent');
    const search = $('#guideSearch');
    if (!data || !nav || !content) return;

    const esc = (s) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const guides = data.guides;
    const cats = data.categories;
    let activeId = null;
    let query = '';
    let openCat = null; // id єдиної відкритої категорії (класичний акордеон)

    const byCat = {};
    for (const g of guides) (byCat[g.cat] = byCat[g.cat] || []).push(g);

    const matches = (g) =>
      !query ||
      g.title.toLowerCase().includes(query) ||
      g.html.toLowerCase().includes(query);

    const catOf = (id) => {
      const g = guides.find((x) => x.id === id);
      return g ? g.cat : null;
    };

    function renderNav() {
      let html = '';
      for (const c of cats) {
        const list = (byCat[c.id] || []).filter(matches);
        if (!list.length) continue;
        // під час пошуку розкриваємо всі категорії зі збігами,
        // інакше — лише одну активну (класичний акордеон)
        const open = query ? true : c.id === openCat;
        html +=
          `<div class="guides-cat${open ? ' open' : ''}">` +
          `<button type="button" class="guides-cat-title" data-cat="${c.id}" aria-expanded="${open}">` +
          `<span class="guides-cat-ico">${c.emoji}</span>` +
          `<span class="guides-cat-name">${esc(c.name)}</span>` +
          `<span class="guides-cat-count">${list.length}</span>` +
          `<span class="guides-cat-chevron" aria-hidden="true">▸</span>` +
          `</button><ul>`;
        for (const g of list) {
          const on = g.id === activeId ? ' class="active"' : '';
          html +=
            `<li><button type="button" data-guide="${g.id}"${on}>` +
            `${esc(g.title)}${g.images ? ' <span class="guide-cam">📷</span>' : ''}` +
            `</button></li>`;
        }
        html += '</ul></div>';
      }
      nav.innerHTML = html || '<div class="guide-empty small">Нічого не знайдено</div>';
    }

    function renderGuide(id) {
      const g = guides.find((x) => x.id === id);
      if (!g) {
        content.innerHTML = '<div class="guide-empty">Обери гайд зі списку зліва.</div>';
        return;
      }
      activeId = id;
      const cat = cats.find((c) => c.id === g.cat);
      content.innerHTML =
        `<div class="guide-head">` +
        (cat ? `<span class="guide-crumb">${cat.emoji} ${esc(cat.name)}</span>` : '') +
        `<h3>${esc(g.title)}</h3>` +
        (g.updated ? `<span class="guide-date">оновлено ${esc(g.updated)}</span>` : '') +
        `</div>` +
        `<div class="guide-body">${g.html}</div>`;
      content.scrollTop = 0;
    }

    function selectGuide(id) {
      const cat = catOf(id);
      if (cat) openCat = cat; // тримаємо категорію активного гайда відкритою
      renderGuide(id);
      renderNav();
      // після вибору гайда показуємо його з початку (під липкою шапкою)
      content.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (location.hash !== '#guides/' + id)
        history.replaceState(null, '', '#guides/' + id);
    }

    nav.addEventListener('click', (e) => {
      const head = e.target.closest('button[data-cat]');
      if (head) {
        const id = head.dataset.cat;
        openCat = openCat === id ? null : id; // одна відкрита за раз
        renderNav();
        const el = nav.querySelector('.guides-cat.open');
        if (el && openCat === id) el.scrollIntoView({ block: 'nearest' });
        return;
      }
      const btn = e.target.closest('button[data-guide]');
      if (btn) selectGuide(btn.dataset.guide);
    });
    content.addEventListener('click', (e) => {
      const link = e.target.closest('.guide-link[data-guide]');
      if (link) {
        e.preventDefault();
        selectGuide(link.dataset.guide);
        return;
      }
      // .coord копіювання обробляється глобальним делегованим слухачем
    });
    if (search)
      search.addEventListener('input', () => {
        query = search.value.trim().toLowerCase();
        renderNav();
      });

    const hash = (location.hash || '').replace('#', '');
    let openId = hash.startsWith('guides/') ? hash.slice(7) : null;
    if (!guides.find((g) => g.id === openId)) openId = guides[0] && guides[0].id;
    if (openId) {
      openCat = catOf(openId);
      renderGuide(openId);
    }
    renderNav();

    // дозволяє відкрити конкретний гайд із заголовка вкладки
    window.__openGuide = selectGuide;
  }

  // =========================================================
  // РБ — карта рейдових босів (тайли worldmap.pw + власні мітки)
  // =========================================================
  const WORLD_BOSSES = [
    { nick: 'Сніги', name: 'Дух селища', x: 159, y: 975 },
    { nick: 'Загадка', name: 'Загадка', x: 314, y: 955 },
    { nick: 'Жестянка', name: 'Енгерранд', x: 235, y: 867 },
    { nick: 'Огірок', name: 'Примарний вершник', x: 171, y: 787 },
    { nick: '24', name: 'Шилонос', x: 251, y: 754 },
    { nick: 'ГМ', name: 'Крилатий воїн', x: 439, y: 752 },
    { nick: 'ПУО', name: 'Сталевий меч демона', x: 487, y: 570 },
    { nick: 'Шабля', name: 'Шабля демона', x: 438, y: 471 },
    { nick: 'Обеан', name: 'Обеан', x: 553, y: 437 },
    { nick: 'Порт 1', name: 'Златий король', x: 652, y: 389 },
    { nick: 'Порт 2', name: 'Мисливець за душами', x: 657, y: 434 },
    { nick: 'Шляпа', name: 'Тінь померлого', x: 659, y: 523 },
    { nick: 'Альфа', name: 'Альфа', x: 162, y: 427 },
    { nick: 'НД', name: 'Аптійський щит', x: 151, y: 339 },
    { nick: 'Сколопендра', name: 'Сколопендра вбивця', x: 639, y: 868 },
  ];
  // Координати — точні з pwdatabase (карта a33 «Лабіринт часу»).
  const CHRONO_BOSSES = [
    { name: 'Потрошитель', tier: 1, x: 366.63, z: 472.18 },
    { name: 'Майстер-воїн з сокирою', tier: 1, x: 345.24, z: 457.87 },
    { name: 'Звір грому', tier: 2, x: 333.83, z: 596.81 },
    { name: 'Обпалений король скелетів', tier: 2, x: 364.58, z: 610.76 },
    { name: 'Воїн Гаї', tier: 3, x: 477.29, z: 623.43 },
    { name: 'Отруєний король скелетів', tier: 3, x: 421.51, z: 570.45 },
    { name: 'Пекельний гончак', tier: 4, x: 462.73, z: 519.77 },
    { name: 'Страж морозу', tier: 4, x: 477.17, z: 475.73 },
  ];
  CHRONO_BOSSES.forEach((b) => (b.sub = 'Хроно ' + b.tier));

  // Перетворення координат гри PW -> карта worldmap.pw: 1 ігрова одиниця =
  // 1 метр у проєкції EPSG:3857 (вивірено через головну карту worldmap.pw,
  // де crs.project відомих локацій дорівнює їхнім ігровим координатам).
  function pwToLatLng(x, y) {
    return L.CRS.EPSG3857.unproject(L.point(x, y));
  }

  const rbMaps = {};
  let rbSub = 'world';
  let rbWired = false;

  // === ТУТ РЕДАГУЙ МІН/МАКС ЗУМИ КАРТИ РБ ===========================
  // windowed   — як виглядає у вкладці (звичайний режим)
  // fullscreen — коли натиснули кнопку «⛶ На весь екран»
  // Значення застосовуються в buildRbMap (initial) і в toggleRbFullscreen.
  const RB_ZOOM = {
    world:  { windowed: { min: 18, max: 21 }, fullscreen: { min: 18, max: 21 } },
    chrono: { windowed: { min: 0, max: 2  }, fullscreen: { min: 0, max: 2  } },
  };
  // ==================================================================

  // Хроно: піксель на зображенні a33 (1024×1024) за формулою pwdatabase
  // -> latlng у L.CRS.Simple (lat = H - pixelY, lng = pixelX).
  const CH_SIZE = 1024;
  function chronoToLatLng(x, z) {
    const px = 4.82 * x - 1424.06;
    const py = 3173.18 - 4.82 * z;
    return [CH_SIZE - py, px];
  }

  function buildRbMap(kind) {
    const el = document.getElementById(kind === 'world' ? 'rbMapWorld' : 'rbMapChrono');
    const listEl = document.getElementById(kind === 'world' ? 'rbListWorld' : 'rbListChrono');
    if (!el) return null;

    const z0 = RB_ZOOM[kind].windowed;
    let map, fit, flyZoom;
    if (kind === 'world') {
      // Ліміти зуму — з RB_ZOOM (див. конфіг-блок вище).
      map = L.map(el, { minZoom: z0.min, maxZoom: z0.max, zoomSnap: 0.5, zoomControl: true });
      const attr = 'Карта © <a href="https://worldmap.pw/" target="_blank" rel="noopener">worldmap.pw</a>';
      // як на worldmap.pw: satmap-фон для зумів 0-18, артистичний map для 18+
      L.tileLayer('https://worldmap.pw/tiles/satmap/{z}/{x}/{y}.webp', {
        minZoom: 0, maxZoom: 18, tileSize: 256, attribution: attr,
      }).addTo(map);
      L.tileLayer('https://worldmap.pw/tiles/map/{z}/{x}/{y}.webp', {
        minZoom: 18, maxZoom: 21, tileSize: 256,
      }).addTo(map);
      flyZoom = 18;
    } else {
      // інстанс «Лабіринт часу» (Хроно 1-4) — статичне зображення, без карти світу
      map = L.map(el, { crs: L.CRS.Simple, minZoom: z0.min, maxZoom: z0.max, zoomSnap: 0.25, zoomControl: true, attributionControl: false });
      const bounds = [[0, 0], [CH_SIZE, CH_SIZE]];
      L.imageOverlay('assets/maps/chrono.webp', bounds).addTo(map);
      map.setMaxBounds(L.latLngBounds(bounds).pad(0.5));
      flyZoom = 1;
    }

    const bosses = kind === 'world' ? WORLD_BOSSES : CHRONO_BOSSES;
    const lls = [];
    let listHtml = '';
    bosses.forEach((b, i) => {
      const ll = kind === 'world' ? pwToLatLng(b.x, b.y) : chronoToLatLng(b.x, b.z);
      b._ll = ll;
      lls.push(ll);
      const label = b.nick || b.name;
      const coordStr = kind === 'world' ? b.x + ' ' + b.y : Math.round(b.x) + ' ' + Math.round(b.z);
      const icon = L.divIcon({
        className: 'rb-marker' + (b.tier ? ' t' + b.tier : ''),
        html: '<span class="rb-pin"></span><span class="rb-lbl">' + escHtml(label) + '</span>',
        iconSize: null,
        iconAnchor: [8, 8],
      });
      const popup =
        '<div class="rb-pop">' +
        (b.sub ? '<span class="rb-pop-sub t' + b.tier + '">' + escHtml(b.sub) + '</span>' : '') +
        '<b>' + escHtml(b.name) + '</b>' +
        (b.nick && b.nick !== b.name ? ' <span class="rb-pop-nick">(' + escHtml(b.nick) + ')</span>' : '') +
        '<br><span class="coord" data-coord="' + coordStr + '" title="Натисни, щоб скопіювати">' + coordStr + '</span>' +
        '</div>';
      b._marker = L.marker(ll, { icon }).addTo(map).bindPopup(popup);
      listHtml +=
        '<button type="button" class="rb-chip' + (b.tier ? ' t' + b.tier : '') + '" data-rb="' + i + '">' +
        (b.tier ? '<span class="rb-chip-tier">' + b.tier + '</span>' : '') +
        escHtml(label) +
        '</button>';
    });

    // обмежуємо панорамування: для світу — навколо ареалу босів,
    // щоб мишею не можна було відтягнути карту «у нікуди».
    if (kind === 'world' && lls.length) {
      map.setMaxBounds(L.latLngBounds(lls).pad(0.5));
    }

    // підгонка вигляду: світ — за мітками; хроно — повне зображення 2×2
    fit = (animate) => {
      if (kind === 'world') {
        if (lls.length) map.fitBounds(L.latLngBounds(lls).pad(0.18), { animate: !!animate });
      } else {
        map.fitBounds([[0, 0], [CH_SIZE, CH_SIZE]], { animate: !!animate });
      }
    };

    // кнопка «на весь екран» — Leaflet-контрол у правому верхньому куті.
    const FsCtrl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const wrap = L.DomUtil.create('div', 'leaflet-bar rb-fs');
        const btn = L.DomUtil.create('a', '', wrap);
        btn.href = '#';
        btn.role = 'button';
        btn.title = 'На весь екран (Esc — закрити)';
        btn.setAttribute('aria-label', 'На весь екран');
        btn.innerHTML = '⛶';
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          L.DomEvent.stop(e);
          toggleRbFullscreen(kind);
        });
        return wrap;
      },
    });
    new FsCtrl().addTo(map);

    if (listEl) {
      listEl.innerHTML = listHtml;
      listEl.addEventListener('click', (e) => {
        const c = e.target.closest('button[data-rb]');
        if (!c) return;
        const b = bosses[+c.dataset.rb];
        map.flyTo(b._ll, flyZoom, { duration: 0.6 });
        b._marker.openPopup();
      });
    }
    fit(false);

    // надійно синхронізуємо розмір, коли контейнер отримує реальні габарити.
    if (window.ResizeObserver) {
      let first = true;
      const ro = new ResizeObserver(() => {
        map.invalidateSize(false);
        if (first) { first = false; fit(false); }
      });
      ro.observe(el);
    }
    return map;
  }

  function rbFit(kind) {
    const m = rbMaps[kind];
    if (!m) return;
    m.invalidateSize(false);
    if (kind === 'world') {
      const lls = WORLD_BOSSES.map((b) => b._ll).filter(Boolean);
      if (lls.length) m.fitBounds(L.latLngBounds(lls).pad(0.18), { animate: false });
    } else {
      m.fitBounds([[0, 0], [CH_SIZE, CH_SIZE]], { animate: false });
    }
  }
  // Кілька проходів, поки контейнер не отримає фінальний розмір (Leaflet
  // інакше лишає карту обрізаною, якщо створена в щойно показаному блоці).
  function rbRefresh(kind) {
    requestAnimationFrame(() => rbFit(kind));
    setTimeout(() => rbFit(kind), 200);
    setTimeout(() => rbFit(kind), 550);
  }

  function rbShowSub(sub) {
    rbSub = sub;
    $$('.rb-subtab').forEach((b) => {
      const on = b.dataset.sub === sub;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $$('.rb-sub').forEach((p) => p.classList.toggle('active', p.dataset.sub === sub));
    if (!rbMaps[sub]) rbMaps[sub] = buildRbMap(sub);
    rbRefresh(sub);
  }

  function toggleRbFullscreen(kind) {
    const el = document.getElementById(kind === 'world' ? 'rbMapWorld' : 'rbMapChrono');
    if (!el) return;
    const on = el.classList.toggle('fullscreen');
    document.body.classList.toggle('rb-fs-active', on);
    // ліміти зуму перемикаємо за конфігом RB_ZOOM (див. вище).
    const map = rbMaps[kind];
    if (map) {
      const z = RB_ZOOM[kind][on ? 'fullscreen' : 'windowed'];
      map.setMinZoom(z.min);
      map.setMaxZoom(z.max);
    }
    // після зміни розмірів контейнера Leaflet треба підказати перерахувати тайли
    // й заново вписати вміст у в'юпорт.
    rbRefresh(kind);
  }

  function rbActivate() {
    if (typeof L === 'undefined') return; // Leaflet не завантажився
    if (!rbMaps.world) rbMaps.world = buildRbMap('world');
    if (!rbWired) {
      rbWired = true;
      $$('.rb-subtab').forEach((btn) => btn.addEventListener('click', () => rbShowSub(btn.dataset.sub)));
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const fs = document.querySelector('.rb-map.fullscreen');
        if (!fs) return;
        toggleRbFullscreen(fs.id === 'rbMapWorld' ? 'world' : 'chrono');
      });
    }
    rbRefresh(rbSub);
  }

  $('#year').textContent = new Date().getFullYear();
  applySettingsToInputs();
  applyDefaultEggPrice();
  buildCraftInventory();
  buildRecipesList();
  simInit();
  defInit();
  guidesInit();
  renderAll();

  const initial = (location.hash || '').replace('#', '').split('/')[0];
  if (VALID_TABS.includes(initial)) setTab(initial);
})();
