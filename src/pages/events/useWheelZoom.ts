// =========================================================
// Розклад Евентів: зум календаря Ctrl+колесом (⌘ на маку).
// Звичайний скрол не перехоплюється; preventDefault на ctrl+wheel
// заодно блокує браузерний zoom сторінки. Точка під курсором
// лишається на місці: цільовий scrollY рахується в обробнику,
// застосовується після ререндеру (useLayoutEffect на value).
// =========================================================

import { useEffect, useLayoutEffect, useRef } from 'react';

interface Options {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

export function useWheelZoom<T extends HTMLElement>({ value, min, max, onChange }: Options) {
  const ref = useRef<T | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** Цільовий window.scrollY, щоб точка під курсором лишилась під ним. */
  const pendingScroll = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      const cur = valueRef.current;
      // deltaMode 1 — «рядки» (Firefox), інакше пікселі.
      const factor = Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.06 : 0.002));
      const next = Math.min(max, Math.max(min, cur * factor));
      if (next === cur) return;
      // Вміст масштабується від верху елемента рівномірно в next/cur разів.
      const rect = el.getBoundingClientRect();
      pendingScroll.current = rect.top + window.scrollY + ((ev.clientY - rect.top) * next) / cur - ev.clientY;
      onChangeRef.current(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [min, max]);

  useLayoutEffect(() => {
    if (pendingScroll.current === null) return;
    window.scrollTo({ top: Math.max(0, pendingScroll.current) });
    pendingScroll.current = null;
  }, [value]);

  return ref;
}
