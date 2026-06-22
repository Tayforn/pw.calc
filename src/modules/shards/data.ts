// =========================================================
// ЯЙЦЯ ТА КРАФТ — ДАНІ
// =========================================================

// Рецепти крафту: ★N збирається з перелічених нижчих шарів (count × level).
export const RECIPES: Record<number, Record<number, number>> = {
  2: { 1: 4 },
  3: { 1: 2, 2: 2 },
  4: { 1: 1, 2: 1, 3: 2 },
  5: { 3: 1, 4: 2 },
  6: { 3: 1, 5: 2 },
  7: { 4: 1, 5: 1, 6: 1 },
  8: { 5: 1, 6: 1, 7: 1 },
  9: { 6: 1, 7: 1, 8: 1 },
  10: { 7: 1, 8: 1, 9: 1 },
  11: { 8: 1, 9: 1, 10: 1 },
  12: { 9: 1, 10: 1, 11: 1 },
};

// Ймовірності дропу з яйця (10% — камінь, ігнорується для шарів).
export const EGG_DROP_CRAFT: Record<number, number> = { 1: 0.71, 2: 0.11, 3: 0.08 };

// ★1-еквівалент кожного рівня — обчислюється з RECIPES.
export const ONE_STAR_EQ: Record<number, number> = (() => {
  const eq: Record<number, number> = { 1: 1 };
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
export const EGG_EQ_ONE_STAR =
  EGG_DROP_CRAFT[1] * ONE_STAR_EQ[1] +
  EGG_DROP_CRAFT[2] * ONE_STAR_EQ[2] +
  EGG_DROP_CRAFT[3] * ONE_STAR_EQ[3];

// Очікувана кількість яєць для одного шара ★N — round-up від ★1-екв / 1.95.
export const EGGS_FOR_LEVEL: number[] = [0];
for (let lv = 1; lv <= 12; lv++) {
  EGGS_FOR_LEVEL.push(Math.ceil(ONE_STAR_EQ[lv] / EGG_EQ_ONE_STAR));
}
