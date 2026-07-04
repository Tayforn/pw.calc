// =========================================================
// Плаваючий тултіп — спільний для ляльки та скілбази.
// Один елемент у <body> (координати документа, z-index понад попапами),
// авто-фліп угору, коли знизу не влазить у вʼюпорт.
// =========================================================

let el: HTMLElement | null = null;

function ensure(): HTMLElement {
  if (!el) {
    el = document.createElement('div');
    el.className = 'doll-tip';
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

/** Показати тултіп біля елемента (знизу; якщо не влазить у вʼюпорт — зверху). */
export function showTooltip(target: HTMLElement, html: string, maxWidth = 0): void {
  const tip = ensure();
  tip.innerHTML = html;
  tip.style.maxWidth = maxWidth ? maxWidth + 'px' : '';
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  let left = window.scrollX + r.left;
  left = Math.min(left, window.scrollX + window.innerWidth - tip.offsetWidth - 12);
  const h = tip.offsetHeight;
  const fitsBelow = r.bottom + 8 + h <= window.innerHeight - 4;
  const top = fitsBelow
    ? window.scrollY + r.bottom + 8
    : Math.max(window.scrollY + 4, window.scrollY + r.top - h - 8);
  tip.style.top = top + 'px';
  tip.style.left = Math.max(8, left) + 'px';
}

export function hideTooltip(): void {
  if (el) el.hidden = true;
}
