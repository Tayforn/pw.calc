// =========================================================
// СИМУЛЯТОР СКРИНЬ
// =========================================================

import { $ } from '../../utils/dom';
import { fmt, fmt2, escHtml } from '../../utils/format';
import { getSettings } from '../../settings';

interface ChestItem {
  uid: number;
  name: string;
  chance: number;
  qty: number;
}
interface ChestDefault {
  name: string;
  chance: number;
  qty: number;
}
interface ChestDrop {
  name: string;
  qty: number;
  chance: number;
}
interface InvEntry {
  name: string;
  count: number;
  chance: number;
}

// Дефолтна скриня — «Куб Долі» (36 нагород).
const CHEST_DEFAULT: ChestDefault[] = [
  { name: 'Ідеальний приз', chance: 80.69, qty: 15 },
  { name: 'Бронзова монета', chance: 9, qty: 1 },
  { name: 'Знак перемоги', chance: 2, qty: 1 },
  { name: 'Чудовий приз', chance: 1.8, qty: 1 },
  { name: 'Платиновий ідол', chance: 1.25, qty: 1 },
  { name: 'Платиновий амулет', chance: 1.25, qty: 1 },
  { name: 'Орден з гравіювання', chance: 0.7, qty: 1 },
  { name: 'Золота монета', chance: 0.35, qty: 1 },
  { name: 'Загадкова скринька', chance: 0.25, qty: 1 },
  { name: 'Камінь безмежності', chance: 0.25, qty: 1 },
  { name: 'Камінь морської блакиті', chance: 0.25, qty: 1 },
  { name: 'Камінь Нюйві', chance: 0.2, qty: 1 },
  { name: 'Камінь Сюань Юань', chance: 0.2, qty: 1 },
  { name: 'Скринька таємничого світу', chance: 0.2, qty: 1 },
  { name: 'Червоне око', chance: 0.2, qty: 1 },
  { name: 'Камінь Джунглів', chance: 0.15, qty: 1 },
  { name: 'Знак командира', chance: 0.12, qty: 1 },
  { name: 'Печатка Кубу', chance: 0.12, qty: 1 },
  { name: 'Книга долі', chance: 0.1, qty: 1 },
  { name: 'Алмазна броня', chance: 0.1, qty: 1 },
  { name: "Кам'яна броня", chance: 0.1, qty: 1 },
  { name: 'Меч літнього літа', chance: 0.1, qty: 1 },
  { name: 'Крила бога удачі', chance: 0.09, qty: 1 },
  { name: '★Крила Пегаса', chance: 0.09, qty: 1 },
  { name: 'Прикраса·Знак місяця', chance: 0.08, qty: 1 },
  { name: 'Зброя·Знак місяця', chance: 0.08, qty: 1 },
  { name: '★★Повний контроль ситуації', chance: 0.05, qty: 1 },
  { name: '★★Долоня, що керує хмарами', chance: 0.05, qty: 1 },
  { name: '★★Унікальне крило', chance: 0.05, qty: 1 },
  { name: 'Божественний сувій', chance: 0.015, qty: 1 },
  { name: 'Загадкова лампа', chance: 0.012, qty: 1 },
  { name: 'Орден слави', chance: 0.01, qty: 1 },
  { name: '★★★Плащ вознесіння', chance: 0.01, qty: 1 },
  { name: 'Сокровенна перлина', chance: 0.008, qty: 1 },
  { name: '★★★Шолом героя', chance: 0.005, qty: 1 },
  { name: 'Осколок метеорита', chance: 100, qty: 1 },
];

let chestUid = 0;
function chestClone(list: ChestDefault[]): ChestItem[] {
  return list.map((it) => ({ uid: ++chestUid, name: it.name, chance: it.chance, qty: it.qty }));
}

const chestState: {
  items: ChestItem[];
  inventory: Map<string, InvEntry>;
  opens: number;
  lastDrop: ChestDrop[] | null;
} = {
  items: chestClone(CHEST_DEFAULT),
  inventory: new Map(),
  opens: 0,
  lastDrop: null,
};

/** Клас рідкості за шансом — для кольорового маркера. */
function chestRarity(chance: number): string {
  if (chance >= 100) return 'gtd';
  if (chance < 0.02) return 'legendary';
  if (chance < 0.1) return 'epic';
  if (chance < 1) return 'rare';
  return 'common';
}

function chestFmtChance(c: number): string {
  if (!Number.isFinite(c)) return '—';
  if (c >= 100) return '100%';
  const s = c.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',') + '%';
}

/** Розбиває скриню на гарантовані предмети й зважений пул. */
function chestPools(): { guaranteed: ChestItem[]; roll: ChestItem[]; totalWeight: number } {
  const guaranteed: ChestItem[] = [];
  const roll: ChestItem[] = [];
  for (const it of chestState.items) {
    if (!it.name || !(it.qty > 0)) continue;
    if (it.chance >= 100) guaranteed.push(it);
    else if (it.chance > 0) roll.push(it);
  }
  const totalWeight = roll.reduce((s, it) => s + it.chance, 0);
  return { guaranteed, roll, totalWeight };
}

/** Одне відкриття. */
function chestRollOnce(): ChestDrop[] | null {
  const { guaranteed, roll, totalWeight } = chestPools();
  const drop: ChestDrop[] = [];
  for (const it of guaranteed) drop.push({ name: it.name, qty: it.qty, chance: it.chance });
  if (totalWeight > 0) {
    let r = Math.random() * totalWeight;
    let picked = roll[roll.length - 1];
    for (const it of roll) {
      r -= it.chance;
      if (r < 0) {
        picked = it;
        break;
      }
    }
    drop.push({ name: picked.name, qty: picked.qty, chance: picked.chance });
  }
  return drop.length ? drop : null;
}

function chestAddToInventory(drop: ChestDrop[]): void {
  for (const d of drop) {
    const cur = chestState.inventory.get(d.name);
    if (cur) cur.count += d.qty;
    else chestState.inventory.set(d.name, { name: d.name, count: d.qty, chance: d.chance });
  }
}

function chestRenderDrop(): void {
  const el = $('#chestDrop');
  if (!el) return;
  const drop = chestState.lastDrop;
  if (!drop || !drop.length) {
    el.innerHTML = '<div class="hist-empty muted">Натисни «Відкрити», щоб подивитись, що випаде.</div>';
    return;
  }
  const sorted = [...drop].sort((a, b) => a.chance - b.chance);
  el.innerHTML = sorted
    .map((d) => {
      const rar = chestRarity(d.chance);
      const tag = d.chance >= 100 ? 'бонус' : chestFmtChance(d.chance);
      return (
        '<div class="chest-drop-item rarity-' + rar + '">' +
        '<span class="chest-gem">◈</span>' +
        '<span class="chest-drop-name">' + escHtml(d.name) + '</span>' +
        '<span class="chest-drop-qty">×' + fmt(d.qty) + '</span>' +
        '<span class="chest-drop-chance">' + tag + '</span>' +
        '</div>'
      );
    })
    .join('');
}

function chestRenderInventory(): void {
  const out = $('#chestInv');
  const cnt = $('#chestInvCount');
  if (!out) return;
  if (cnt) {
    cnt.textContent = fmt(chestState.opens) + (chestState.opens === 1 ? ' відкриття' : ' відкриттів');
  }
  if (chestState.inventory.size === 0) {
    out.innerHTML = '<div class="hist-empty muted">Поки що порожньо. Відкрий скриню, щоб щось отримати.</div>';
    return;
  }
  const rows = [...chestState.inventory.values()].sort(
    (a, b) => a.chance - b.chance || b.count - a.count,
  );
  out.innerHTML = rows
    .map((r) => {
      const rar = chestRarity(r.chance);
      return (
        '<div class="chest-inv-item rarity-' + rar + '">' +
        '<span class="chest-gem">◈</span>' +
        '<span class="chest-inv-name">' + escHtml(r.name) + '</span>' +
        '<span class="chest-inv-num">×' + fmt(r.count) + '</span>' +
        '</div>'
      );
    })
    .join('');
}

function chestRenderSummary(): void {
  const el = $('#chestSummary');
  if (!el) return;
  const { guaranteed, roll, totalWeight } = chestPools();
  el.textContent =
    'Предметів: ' + fmt(chestState.items.length) +
    ' · у пулі: ' + fmt(roll.length) +
    ' (сума шансів ' + chestFmtChance(totalWeight) + ')' +
    (guaranteed.length ? ' · гарантованих: ' + fmt(guaranteed.length) : '');
}

function chestRenderTargetOptions(): void {
  const sel = $<HTMLSelectElement>('#chestTarget');
  if (!sel) return;
  const prev = sel.value;
  const names = chestState.items
    .filter((it) => it.name && it.chance > 0)
    .sort((a, b) => a.chance - b.chance);
  sel.innerHTML = names
    .map(
      (it) =>
        '<option value="' + escHtml(it.name) + '">' +
        escHtml(it.name) + ' — ' + chestFmtChance(it.chance) + '</option>',
    )
    .join('');
  if (prev && names.some((it) => it.name === prev)) sel.value = prev;
}

function chestRenderAll(): void {
  chestRenderDrop();
  chestRenderInventory();
  chestRenderSummary();
  chestRenderTargetOptions();
}

function chestOpen(times: number): void {
  let lastDrop: ChestDrop[] | null = null;
  for (let i = 0; i < times; i++) {
    const drop = chestRollOnce();
    if (!drop) break;
    chestAddToInventory(drop);
    chestState.opens++;
    lastDrop = drop;
  }
  if (lastDrop) chestState.lastDrop = lastDrop;
  chestRenderAll();
}

function chestClearInventory(): void {
  chestState.inventory.clear();
  chestState.opens = 0;
  chestState.lastDrop = null;
  chestRenderAll();
  const out = $('#chestSimResult');
  if (out) out.innerHTML = '';
}

// --- Симуляція «до бажаного предмета» ---
const CHEST_SIM_CAP = 5000000;

function chestSimulate(): void {
  const out = $('#chestSimResult');
  if (!out) return;
  const target = ($<HTMLSelectElement>('#chestTarget')?.value ?? '');
  if (!target) {
    out.innerHTML = '<div class="banner">Спершу додай предмети у скриню.</div>';
    return;
  }

  const { roll, totalWeight, guaranteed } = chestPools();
  const isGuaranteed = guaranteed.some((it) => it.name === target);
  const targetWeight = roll.filter((it) => it.name === target).reduce((s, it) => s + it.chance, 0);

  if (!isGuaranteed && (targetWeight <= 0 || totalWeight <= 0)) {
    out.innerHTML = '<div class="banner">У цього предмета шанс 0% — його неможливо отримати.</div>';
    return;
  }

  let opens = 0;
  let got = false;
  let gotQty = 0;
  while (opens < CHEST_SIM_CAP) {
    const drop = chestRollOnce();
    opens++;
    chestState.opens++;
    if (drop) {
      chestAddToInventory(drop);
      chestState.lastDrop = drop;
      const hit = drop.find((d) => d.name === target);
      if (hit) {
        got = true;
        gotQty = hit.qty;
        break;
      }
    }
  }

  chestRenderAll();

  const prob = isGuaranteed ? 1 : targetWeight / totalWeight;
  const expected = prob > 0 ? 1 / prob : Infinity;
  const keyPrice = parseFloat($<HTMLInputElement>('#chestKeyPrice')?.value ?? '') || 0;
  const goldSpent = keyPrice * opens;
  const coinsSpent = goldSpent * getSettings().goldPrice;

  const costLine =
    keyPrice > 0
      ? '<div class="metric"><span class="metric-label">Витрачено на ключі</span>' +
        '<span class="metric-value">' + fmt2(goldSpent) + ' г</span>' +
        '<span class="metric-sub">' + fmt(coinsSpent) + ' монет</span></div>'
      : '';

  if (!got) {
    out.innerHTML =
      '<div class="banner">За ' + fmt(opens) + ' відкриттів предмет «' + escHtml(target) +
      '» так і не випав (ліміт симуляції). Шанс надто малий.</div>';
    return;
  }

  out.innerHTML =
    '<div class="banner info">Готово! «' + escHtml(target) + '» (×' + fmt(gotQty) +
    ') випав за <b>' + fmt(opens) + '</b> ' + (opens === 1 ? 'відкриття' : 'відкриттів') + '.</div>' +
    '<div class="result-summary three-cols">' +
    '<div class="metric"><span class="metric-label">Відкриттів знадобилось</span>' +
    '<span class="metric-value">' + fmt(opens) + '</span></div>' +
    '<div class="metric"><span class="metric-label">Очікувано (в середньому)</span>' +
    '<span class="metric-value">' + (Number.isFinite(expected) ? fmt2(expected) : '∞') + '</span>' +
    '<span class="metric-sub">шанс ' + chestFmtChance(prob * 100) + ' за відкриття</span></div>' +
    costLine +
    '</div>';
}

// --- Модалка налаштувань вмісту ---
function chestRenderCfg(): void {
  const list = $('#chestCfgList');
  if (!list) return;
  list.innerHTML = chestState.items
    .map(
      (it) =>
        '<div class="chest-cfg-row" data-uid="' + it.uid + '">' +
        '<input type="text" class="chest-cfg-name" value="' + escHtml(it.name) + '" placeholder="Назва предмета" />' +
        '<input type="number" class="chest-cfg-chance" value="' + it.chance + '" min="0" step="any" />' +
        '<input type="number" class="chest-cfg-qty" value="' + it.qty + '" min="1" step="1" />' +
        '<button type="button" class="chest-cfg-del" aria-label="Видалити">✕</button>' +
        '</div>',
    )
    .join('');
  chestRenderCfgSummary();
}

function chestRenderCfgSummary(): void {
  const el = $('#chestCfgSummary');
  if (!el) return;
  const { roll, totalWeight, guaranteed } = chestPools();
  const warn =
    totalWeight > 0
      ? ''
      : ' <span style="color:var(--warn)">— пул порожній, додай предмети з шансом &lt;100%</span>';
  el.innerHTML =
    'У пулі: <b>' + fmt(roll.length) + '</b>, сума шансів: <b>' + chestFmtChance(totalWeight) + '</b>' +
    (guaranteed.length ? ' · гарантованих: <b>' + fmt(guaranteed.length) + '</b>' : '') +
    warn;
}

function chestOpenModal(): void {
  chestRenderCfg();
  const modal = $('#chestModal') as HTMLElement | null;
  if (modal) modal.hidden = false;
  document.body.classList.add('modal-open');
}
function chestCloseModal(): void {
  const modal = $('#chestModal') as HTMLElement | null;
  if (modal) modal.hidden = true;
  document.body.classList.remove('modal-open');
  chestRenderAll();
}

export function chestsInit(): void {
  const openBtn = $('#chestOpen');
  if (!openBtn) return;

  openBtn.addEventListener('click', () => chestOpen(1));
  $('#chestOpen10')?.addEventListener('click', () => chestOpen(10));
  $('#chestOpenAll')?.addEventListener('click', () => {
    const n = parseInt($<HTMLInputElement>('#chestCount')?.value ?? '', 10);
    if (!Number.isFinite(n) || n < 1) return;
    chestOpen(Math.min(n, 5000000));
  });
  $('#chestClearInv')?.addEventListener('click', chestClearInventory);
  $('#chestSimForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    chestSimulate();
  });

  // Модалка
  $('#chestSettingsBtn')?.addEventListener('click', chestOpenModal);
  $('#chestModalClose')?.addEventListener('click', chestCloseModal);
  $('#chestModalDone')?.addEventListener('click', chestCloseModal);
  $('#chestModal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'chestModal') chestCloseModal();
  });
  document.addEventListener('keydown', (e) => {
    const modal = $('#chestModal') as HTMLElement | null;
    if (e.key === 'Escape' && modal && !modal.hidden) chestCloseModal();
  });

  $('#chestAddItem')?.addEventListener('click', () => {
    chestState.items.push({ uid: ++chestUid, name: 'Новий предмет', chance: 1, qty: 1 });
    chestRenderCfg();
  });
  $('#chestResetCfg')?.addEventListener('click', () => {
    chestState.items = chestClone(CHEST_DEFAULT);
    chestRenderCfg();
  });

  // Делеговане редагування рядків конфіга.
  const cfgList = $('#chestCfgList');
  if (cfgList) {
    cfgList.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const row = target.closest<HTMLElement>('.chest-cfg-row');
      if (!row) return;
      const it = chestState.items.find((x) => x.uid === Number(row.dataset.uid));
      if (!it) return;
      if (target.classList.contains('chest-cfg-name')) {
        it.name = target.value;
      } else if (target.classList.contains('chest-cfg-chance')) {
        const v = parseFloat(target.value);
        it.chance = Number.isFinite(v) && v >= 0 ? v : 0;
      } else if (target.classList.contains('chest-cfg-qty')) {
        const v = parseInt(target.value, 10);
        it.qty = Number.isFinite(v) && v >= 1 ? v : 1;
      }
      chestRenderCfgSummary();
    });
    cfgList.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('chest-cfg-del')) return;
      const row = target.closest<HTMLElement>('.chest-cfg-row');
      if (!row) return;
      const uid = Number(row.dataset.uid);
      chestState.items = chestState.items.filter((x) => x.uid !== uid);
      chestRenderCfg();
    });
  }

  chestRenderAll();
}
