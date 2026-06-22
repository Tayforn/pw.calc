// Підказка під полем бюджету: курс голди (з налаштувань) + скільки голди
// становить уведена сума. Спільна для Monte Carlo та зворотного калькулятора.

import { fmt, fmtGold } from './format';
import { mcNum } from './mask';
import { getSettings } from '../settings';

export function updateBudgetHint(inpId: string, hintId: string): void {
  const hint = document.getElementById(hintId);
  if (!hint) return;
  const gp = getSettings().goldPrice;
  let txt = 'Юані = монети · 1 голда = ' + fmt(gp) + ' юані';
  const bud = mcNum(document.getElementById(inpId) as HTMLInputElement | null);
  if (Number.isFinite(bud) && bud > 0 && gp > 0) {
    txt += ' · уведено ≈ ' + fmtGold(bud, gp);
  }
  hint.textContent = txt;
}

export function updateAllBudgetHints(): void {
  updateBudgetHint('mcBudget', 'mcBudgetHint');
  updateBudgetHint('revBudget', 'revBudgetHint');
}
