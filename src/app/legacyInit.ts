// =========================================================
// Ініціалізація legacy-модулів (калькулятори/сторінки, що керують
// своїм DOM за id). Викликається ОДИН раз після монтування React-дерева —
// всі сторінки вже в DOM (панелі змонтовані постійно, як і раніше).
// Фаза 3 міграції поступово переносить ці модулі в ідіоматичний React.
// =========================================================

import { updateAllBudgetHints } from '../utils/budgetHint';
import { initClipboard } from '../utils/clipboard';
import { initNumberSteppers } from '../utils/numberStepper';
import { applyDefaultEggPrice, getSettings, initSettings } from '../settings';
import { initEggPriceSync } from '../settings/eggPrice';
import { initRefine, renderRefine } from '../modules/refine/ui';
import { initMonteCarlo } from '../modules/refine/montecarlo';
import { initReverse } from '../modules/refine/budget';
import { simInit, simRender } from '../modules/simulator';
import { r8sInit } from '../modules/r8sim';
import { gsnInit } from '../modules/gsn';
import { dollInit } from '../modules/doll';
import { skillsInit } from '../modules/skills';
import { rbInit } from '../modules/rb';

export { rbActivate } from '../modules/rb';

// renderAll — викликається при зміні налаштувань, ціни яйця та форм заточки/порівняння.
function renderAll(): void {
  renderRefine();
  simRender();
  updateAllBudgetHints();
}

let done = false;

/** Разова ініціалізація всіх legacy-модулів (ідемпотентна). */
export function initLegacyModules(): void {
  if (done) return;
  done = true;

  // Делеговане відкриття/закриття тултіпів (.has-tip) — у порівнянні.
  document.addEventListener('click', (e) => {
    const tip = (e.target as HTMLElement).closest<HTMLElement>('.has-tip');
    document.querySelectorAll('.has-tip.is-open').forEach((el) => {
      if (el !== tip) el.classList.remove('is-open');
    });
    if (tip) tip.classList.toggle('is-open');
  });

  initClipboard();
  initSettings(renderAll);
  initEggPriceSync(renderAll);
  initRefine(renderRefine);
  initMonteCarlo(getSettings);
  initReverse(getSettings);
  simInit();
  r8sInit();
  gsnInit();  dollInit();
  skillsInit();
  rbInit();
  applyDefaultEggPrice();
  renderAll();

  // Кастомні стрілки для всіх числових інпутів (після стартового рендера).
  initNumberSteppers();
}
