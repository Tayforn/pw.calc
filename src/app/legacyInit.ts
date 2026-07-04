// =========================================================
// Ініціалізація legacy-модулів (калькулятори/сторінки, що ще керують
// своїм DOM за id). Викликається ОДИН раз після монтування React-дерева.
// Фаза 3 міграції поступово переносить ці модулі в ідіоматичний React;
// лишились: doll, skills, rb.
// =========================================================

import { initClipboard } from '../utils/clipboard';
import { initNumberSteppers } from '../utils/numberStepper';
import { applyDefaultEggPrice } from '../settings';
import { initEggPriceSync } from '../settings/eggPrice';
import { dollInit } from '../modules/doll';
import { skillsInit } from '../modules/skills';
import { rbInit } from '../modules/rb';

export { rbActivate } from '../modules/rb';

let done = false;

/** Разова ініціалізація legacy-модулів (ідемпотентна). */
export function initLegacyModules(): void {
  if (done) return;
  done = true;

  // Делеговане відкриття/закриття тултіпів (.has-tip) — у порівнянні (React-розмітка).
  document.addEventListener('click', (e) => {
    const tip = (e.target as HTMLElement).closest<HTMLElement>('.has-tip');
    document.querySelectorAll('.has-tip.is-open').forEach((el) => {
      if (el !== tip) el.classList.remove('is-open');
    });
    if (tip) tip.classList.toggle('is-open');
  });

  initClipboard();
  // Синхронізація спільних полів «ціна яйця» між табами (React-сторінки читають
  // значення й реагують через useEggPriceTick — тут лише DOM-синк, без ре-рендера).
  initEggPriceSync(() => {});
  dollInit();
  skillsInit();
  rbInit();
  applyDefaultEggPrice();

  // Кастомні стрілки для всіх числових інпутів (після стартового рендера).
  initNumberSteppers();
}
