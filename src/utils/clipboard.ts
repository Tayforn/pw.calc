// Копіювання тексту в буфер (з фолбеком для http / старих браузерів) та
// делеговане копіювання для будь-якого .coord[data-coord] (гайди + попапи карти).

// Розширений тип для зберігання таймера скидання класу .copied на елементі.
type CoordEl = HTMLElement & { _t?: ReturnType<typeof setTimeout> };

export function copyText(t: string): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
  } else {
    fallbackCopy(t);
  }
}

export function fallbackCopy(t: string): void {
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch (_) {
    /* ignore */
  }
  document.body.removeChild(ta);
}

export function initClipboard(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    const coord = target?.closest<CoordEl>('.coord[data-coord]');
    if (!coord) return;
    copyText(coord.dataset.coord || '');
    coord.classList.add('copied');
    clearTimeout(coord._t);
    coord._t = setTimeout(() => coord.classList.remove('copied'), 1100);
  });
}
