// =========================================================
// Крафт-рецепти, що використовують лут ХХ як матеріал.
// Джерело: pwdatabase.net (розділи "Необходим для создания ..." на
// сторінці предмета + повний список матеріалів на сторінці рецепта).
// Назви — мовою джерела (рос.), оскільки це довідникові дані ззовні
// гри, а не рядки з клієнта. Іконки — хотлінк на pwdatabase.net
// (той самий домен, що й посилання "У базі").
//
// Дані важкі (~700 КБ), тож не вшиті в бандл — вантажаться ліниво з
// public/assets/loot/craft-data.json (той самий підхід, що й
// modules/doll/data.ts::loadCat для перів персонажа).
// =========================================================

export interface CraftMaterial {
  itemId: number;
  itemName: string;
  qty: number;
  icon: string;
  /** true, якщо цей матеріал — один із наших 85 предметів лута ХХ (можна підсвітити на сторінці). */
  isLootItem: boolean;
}

export interface CraftRecipe {
  recipeId: number;
  recipeName: string;
  resultItemId: number;
  resultItemName: string;
  resultLevel: number | null;
  resultIcon: string;
  materials: CraftMaterial[];
}

export interface CraftData {
  recipesById: Record<number, CraftRecipe>;
  craftsBySourceItem: Record<number, number[]>;
}

const URL = (import.meta.env.BASE_URL || '/') + 'assets/loot/craft-data.json';

let cache: CraftData | null = null;
let pending: Promise<CraftData> | null = null;

/** Лінива загрузка (один раз, кешується в пам'яті на весь сеанс). */
export function loadCraftData(): Promise<CraftData> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch(URL)
      .then((res) => res.json())
      .then((data: CraftData) => {
        cache = data;
        return data;
      });
  }
  return pending;
}

export function recipesForItem(data: CraftData, itemId: number): CraftRecipe[] {
  const ids = data.craftsBySourceItem[itemId];
  if (!ids) return [];
  return ids.map((id) => data.recipesById[id]).filter((r): r is CraftRecipe => !!r);
}

export const pwdbItemUrl = (id: number) => `https://www.pwdatabase.net/ru/items/${id}`;
