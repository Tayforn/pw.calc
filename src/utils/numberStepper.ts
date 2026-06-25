// Кастомні стрілки для числових інпутів (замість нативних, що не стилізуються).
// Один спільний враппер: обгортає кожен <input type="number"> у .num-stepper
// з двома золотими кнопками ▲/▼ та слідкує за динамічно доданими інпутами.

const STEP_DELAY = 300; // мс до старту автоповтору при утриманні
const STEP_RATE = 60; // мс між кроками при утриманні

function step(input: HTMLInputElement, dir: 1 | -1): void {
  if (input.disabled || input.readOnly) return;
  if (dir > 0) input.stepUp();
  else input.stepDown();
  // Сповіщаємо слухачів так само, як зробив би користувач.
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// Клік + утримання для автоповтору.
function bindHold(btn: HTMLButtonElement, fn: () => void): void {
  let delay: number | undefined;
  let repeat: number | undefined;
  const stop = (): void => {
    window.clearTimeout(delay);
    window.clearInterval(repeat);
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fn();
    delay = window.setTimeout(() => {
      repeat = window.setInterval(fn, STEP_RATE);
    }, STEP_DELAY);
  });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
}

function mkBtn(cls: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.tabIndex = -1; // клавіатура працює через сам інпут (стрілки ↑/↓)
  b.setAttribute('aria-hidden', 'true');
  return b;
}

function wrap(input: HTMLInputElement): void {
  if (input.closest('.num-stepper')) return; // вже обгорнутий
  if (input.dataset.noStepper !== undefined) return; // явний opt-out

  const parent = input.parentNode;
  if (!parent) return;

  const wrapper = document.createElement('span');
  wrapper.className = 'num-stepper';
  parent.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const btns = document.createElement('span');
  btns.className = 'num-stepper-btns';
  const up = mkBtn('num-up', '▲');
  const down = mkBtn('num-down', '▼');
  bindHold(up, () => step(input, 1));
  bindHold(down, () => step(input, -1));
  btns.append(up, down);
  wrapper.appendChild(btns);
}

export function initNumberSteppers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(wrap);

  // Динамічні інпути (конфіг скринь, інвентар крафта тощо).
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.matches('input[type="number"]')) wrap(n as HTMLInputElement);
        n.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(wrap);
      });
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}
