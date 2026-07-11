// =========================================================
// Розклад Евентів: стандартний тижневий розклад сервера (сід).
// Стабільні id 'seed-*' — щоб імпорт поверх сіда заміняв, а не дублював.
// =========================================================

import type { EvtColor, EvtItem, WeekdayMask } from './types';
import { ALL_DAYS } from './types';

// Дні: біт 0 = Пн … біт 6 = Нд.
const ПН = 1 << 0, ВТ = 1 << 1, СР = 1 << 2, ЧТ = 1 << 3, ПТ = 1 << 4, СБ = 1 << 5, НД = 1 << 6;

let n = 0;
function seed(
  emoji: string,
  title: string,
  color: EvtColor,
  days: WeekdayMask,
  start: number,
  duration: number,
  notes?: string,
): EvtItem {
  n += 1;
  return {
    id: `seed-${n}`,
    title,
    emoji,
    color,
    start,
    duration,
    recur: { kind: 'weekly', days },
    notes,
    remind: false,
    leadMin: 5,
    order: n,
  };
}

const hm = (h: number, m: number) => h * 60 + m;

export function buildDefaultEvents(): EvtItem[] {
  n = 0;
  return [
    seed('🐍', 'Скачки на острові змій', 'green', ALL_DAYS, hm(12, 20), 10),
    seed('🐍', 'Скачки на острові змій', 'green', ALL_DAYS, hm(21, 20), 10),
    seed('🌋', 'Плато Асурів', 'orange', ALL_DAYS, hm(19, 0), 30),
    seed('🐯', 'Атака тигрів небожителів', 'orange', ПН, hm(21, 0), 30),
    seed('⚔️', 'Світовий бос Інгримунд', 'red', ПН, hm(21, 10), 20, '(346 522) — 10 хв після АТН'),
    seed('🌍', 'Світові боси', 'red', ВТ | ЧТ, hm(20, 0), 60),
    seed('⏳', 'Хроно боси', 'violet', ВТ | ЧТ, hm(20, 0), 60),
    seed('🪶', 'Руїни в джунглях', 'sky', ВТ, hm(20, 0), 60),
    seed('🎲', 'Початок ставок', 'gold', СР, hm(19, 0), 15),
    seed('🌑', 'Місто Темних звірів', 'violet', СР, hm(21, 0), 60),
    seed('🕓', 'Закінчення ставок', 'gold', ЧТ, hm(19, 0), 15),
    seed('🔨', 'Конкурс ремісників', 'gold', ЧТ, hm(20, 0), 60),
    seed('⚔️', 'Світовий бос Ейнгард', 'red', ЧТ, hm(21, 40), 20, '(107 470)'),
    seed('⚔️', 'Битва Династій', 'red', ПТ | НД, hm(20, 20), 60),
    seed('🗺️', 'Територіальні війни', 'sky', СБ, hm(19, 0), 18),
    seed('🗺️', 'Територіальні війни', 'sky', СБ, hm(21, 0), 18),
    seed('🗺️', 'Територіальні війни', 'sky', НД, hm(18, 0), 18),
    seed('🗺️', 'Територіальні війни', 'sky', НД, hm(19, 0), 18),
    seed('⚔️', 'Битва Орденів (Морай)', 'red', СБ, hm(19, 0), 180),
    seed('🐉', 'Замок Царя Драконів', 'violet', НД, hm(21, 30), 30),
  ];
}
