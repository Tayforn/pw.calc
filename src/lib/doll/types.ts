// =========================================================
// ЛЯЛЬКА — типи стану/моделей (спільні для lib і DollPage).
// Винесено з legacy src/modules/doll/index.ts без зміни семантики.
// =========================================================

import type { Item } from '../../modules/doll/data';

/** Річ, відкладена в рюкзак: сама річ + її per-instance стан (камені/заточка/…). */
export interface BackpackEntry {
  item: Item;
  slot: string; // оригінальний слот
  cat: string; // категорія (для іконки)
  gems: Array<Item | null>;
  refine: number;
  addons: Array<{ type: string; val: number }>;
  engrave?: Array<{ type: string; val: number }>; // гравіювання (ручні стати, mypers item_engrave)
  wdf?: Item | null; // руна шліфовки (зброя)
  crystal?: Item | null; // кристал (зброя)
}

/** Повний білд ляльки (persist у localStorage 'pwDollBuild'). */
export interface DollState {
  cls: string;
  gender: 'm' | 'f';
  level: number;
  str: number;
  dex: number;
  vit: number;
  mag: number;
  server: string;
  equipped: Record<string, Item>;
  gems: Record<string, Array<Item | null>>; // slot → камені в гніздах
  refine: Record<string, number>; // slot → рівень заточки (0..12)
  addons: Record<string, Array<{ type: string; val: number }>>; // slot → кастомні допи
  engrave: Record<string, Array<{ type: string; val: number }>>; // slot → гравіювання
  wdf: Record<string, Item | null>; // slot → руна шліфовки (зброя)
  crystal: Record<string, Item | null>; // slot → кристал (зброя)
  buffCfg: Record<string, { on: boolean; lvl: number; side: string }>; // id бафа → налаштування
  extraBuffs: number[]; // додані вручну (через пошук) бафи інших класів
  backpack: Array<BackpackEntry | null>; // інвентар (позиційний, не враховується)
  titles: Record<string, number>; // «Титули» — сумарні доповнення (mypers ik), кап 3000 на поле
}

/** Дефолтний (порожній) білд. */
export function defaultState(): DollState {
  return {
    cls: 'by',
    gender: 'm',
    level: 105,
    str: 5,
    dex: 5,
    vit: 5,
    mag: 5,
    server: 'noServer',
    equipped: {},
    gems: {},
    refine: {},
    addons: {},
    engrave: {},
    wdf: {},
    crystal: {},
    buffCfg: {},
    extraBuffs: [],
    backpack: [],
    titles: {},
  };
}

/** Результат перевірки вимог речі. */
export interface ReqCheck {
  ok: boolean;
  lvl: boolean;
  str: boolean;
  dex: boolean;
  mag: boolean;
  cls: boolean;
}

/** Збережений білд в історії (localStorage 'pwDollHistory'). */
export interface SavedBuild {
  name: string;
  ts: number;
  state: DollState;
}

/** Модель моба-мішені (як `yos` у mypers) — поля з екрана «налаштувати суперника». */
export interface OppMob {
  name: string;
  hp: number;
  level: number;
  physAtkMin: number;
  physAtkMax: number;
  magAtkMin: number;
  magAtkMax: number;
  acc: number; // міткість
  eva: number; // ухилення
  physDef: number; // фіз. захист (сире значення)
  lw: number; // метал
  mo: number; // дерево
  dn: number; // вода
  vt: number; // вогонь
  sp: number; // земля
}

export interface SkillDmg {
  min: number;
  max: number;
  critMin: number;
  critMax: number;
}

/** Контекст надітої/складованої речі для тултіпа: камені, заточка, гравіювання, шліфовка. */
export interface TipCtx {
  gems?: Array<Item | null>;
  refine?: number;
  isBook?: boolean;
  isWeapon?: boolean;
  engrave?: Array<{ type: string; val: number }>;
  addons?: Array<{ type: string; val: number }>; // відредаговані «Характеристики» (додані понад базу — показуються)
  wdf?: Item | null;
  crystal?: Item | null;
}

/** Ціль редактора речі: слот персонажа або комірка рюкзака. */
export type EditorTarget = { kind: 'slot'; slot: string } | { kind: 'bp'; idx: number };
