// =========================================================
// Скрині: дані дефолтної скрині + чисті функції симуляції.
// =========================================================

export interface ChestItem {
  uid: number;
  name: string;
  chance: number;
  qty: number;
}
export interface ChestDrop {
  name: string;
  qty: number;
  chance: number;
}
export interface InvEntry {
  name: string;
  count: number;
  chance: number;
}

interface ChestDefault {
  name: string;
  chance: number;
  qty: number;
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
export const nextChestUid = (): number => ++chestUid;

/** Свіжа копія дефолтної скрині (з унікальними uid). */
export function chestDefaultItems(): ChestItem[] {
  return CHEST_DEFAULT.map((it) => ({ uid: nextChestUid(), name: it.name, chance: it.chance, qty: it.qty }));
}

/** Клас рідкості за шансом — для кольорового маркера. */
export function chestRarity(chance: number): string {
  if (chance >= 100) return 'gtd';
  if (chance < 0.02) return 'legendary';
  if (chance < 0.1) return 'epic';
  if (chance < 1) return 'rare';
  return 'common';
}

export function chestFmtChance(c: number): string {
  if (!Number.isFinite(c)) return '—';
  if (c >= 100) return '100%';
  const s = c.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',') + '%';
}

/** Розбиває скриню на гарантовані предмети й зважений пул. */
export function chestPools(items: ChestItem[]): { guaranteed: ChestItem[]; roll: ChestItem[]; totalWeight: number } {
  const guaranteed: ChestItem[] = [];
  const roll: ChestItem[] = [];
  for (const it of items) {
    if (!it.name || !(it.qty > 0)) continue;
    if (it.chance >= 100) guaranteed.push(it);
    else if (it.chance > 0) roll.push(it);
  }
  const totalWeight = roll.reduce((s, it) => s + it.chance, 0);
  return { guaranteed, roll, totalWeight };
}

/** Одне відкриття скрині. */
export function chestRollOnce(items: ChestItem[]): ChestDrop[] | null {
  const { guaranteed, roll, totalWeight } = chestPools(items);
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

export const CHEST_SIM_CAP = 5000000;
