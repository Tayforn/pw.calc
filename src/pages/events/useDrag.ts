// =========================================================
// Розклад Евентів: drag&drop на Pointer Events (HTML5 DnD не працює на тачі).
// Миша/перо — активація після 6px руху; тач — long-press 320мс
// (доти вертикальний скрол лишається нативним через touch-action: pan-y).
// Продуктивність: слухачі документа живуть лише під час drag-сесії;
// привид рухається напряму через style.transform (без ререндерів React) —
// setUi викликається тільки коли змінюється цільовий слот.
// =========================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EvtColor } from './types';

export type DragPayload =
  | { kind: 'move'; evtId: string; fromDate: string; duration: number; emoji: string; title: string; color: EvtColor }
  | { kind: 'create' };

export interface DropTarget {
  date: string;
  /** Хвилини від опівночі (снап 5 хв) у тижні/дні; null у місяці (час зберігається). */
  startMin: number | null;
}

export interface DragUiState {
  payload: DragPayload;
  /** Координати активації — стартова позиція привида (далі рухається імперативно). */
  x: number;
  y: number;
  target: DropTarget | null;
}

interface TargetRect {
  date: string;
  timed: boolean; // .evt-col (тиждень/день) чи .evt-mcell (місяць)
  left: number; // page-координати — скрол під час drag не збиває
  top: number;
  right: number;
  bottom: number;
}

const MOUSE_SLOP = 6;
const TOUCH_SLOP = 8;
const HOLD_MS = 320;
const EDGE_PX = 70;
const EDGE_STEP = 12;

const targetKey = (t: DropTarget | null) => (t ? `${t.date}|${t.startMin}` : '');

function snapshotRects(): TargetRect[] {
  const rects: TargetRect[] = [];
  document.querySelectorAll<HTMLElement>('[data-evt-day]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    rects.push({
      date: el.dataset.evtDay!,
      timed: el.classList.contains('evt-col'),
      left: r.left + window.scrollX,
      top: r.top + window.scrollY,
      right: r.right + window.scrollX,
      bottom: r.bottom + window.scrollY,
    });
  });
  return rects;
}

interface Options {
  pxPerMin: number;
  onDrop: (payload: DragPayload, target: DropTarget) => void;
}

export function useDrag({ pxPerMin, onDrop }: Options) {
  const [ui, setUi] = useState<DragUiState | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const busy = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const pxRef = useRef(pxPerMin);
  pxRef.current = pxPerMin;

  // Страховка при демонтажі сторінки посеред drag.
  useEffect(() => () => cleanupRef.current?.(), []);

  /** Вішається на pointerDown джерела (блок евента або кнопка «+ Евент»). */
  const start = useCallback((e: React.PointerEvent, payload: DragPayload) => {
    if (busy.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    busy.current = true;

    const pointerId = e.pointerId;
    let startX = e.clientX;
    let startY = e.clientY;
    let lastX = e.clientX;
    let lastY = e.clientY;
    let active = false;
    let holdTimer: number | null = null;
    let raf = 0;
    let rects: TargetRect[] = [];
    let lastKey = '';

    const computeTarget = (clientX: number, clientY: number): DropTarget | null => {
      const px = clientX + window.scrollX;
      const py = clientY + window.scrollY;
      const hit = rects.find((r) => px >= r.left && px < r.right && py >= r.top && py < r.bottom);
      if (!hit) return null;
      if (!hit.timed) return { date: hit.date, startMin: null };
      const dur = payload.kind === 'move' ? payload.duration : 30;
      const raw = (py - hit.top) / pxRef.current;
      const startMin = Math.max(0, Math.min(1440 - dur, Math.round(raw / 5) * 5));
      return { date: hit.date, startMin };
    };

    const preventTouch = (ev: TouchEvent) => ev.preventDefault();

    const suppressClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      document.removeEventListener('click', suppressClick, true);
    };

    const cleanup = () => {
      if (holdTimer != null) clearTimeout(holdTimer);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('touchmove', preventTouch);
      document.documentElement.classList.remove('evt-drag-on');
      busy.current = false;
      cleanupRef.current = null;
      setUi(null);
    };
    cleanupRef.current = cleanup;

    const setGhostPos = (x: number, y: number) => {
      const g = ghostRef.current;
      if (g) g.style.transform = `translate3d(${x + 14}px, ${y + 18}px, 0)`;
    };

    const activate = () => {
      if (active) return;
      active = true;
      rects = snapshotRects();
      // Після активації тач-жест — наш: блокуємо скрол до кінця drag.
      document.addEventListener('touchmove', preventTouch, { passive: false });
      document.documentElement.classList.add('evt-drag-on');
      navigator.vibrate?.(10);
      const target = computeTarget(lastX, lastY);
      lastKey = targetKey(target);
      setUi({ payload, x: lastX, y: lastY, target });
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!active) {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (holdTimer != null) {
          // Тач: ранній рух — це скрол, скасовуємо long-press.
          if (dist > TOUCH_SLOP) cleanup();
          return;
        }
        if (dist <= MOUSE_SLOP) return;
        activate();
      }
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!active || !busy.current) return;
        setGhostPos(lastX, lastY);
        // Авто-скрол сторінки біля країв екрана; rect-и в page-координатах, тож валідні.
        if (lastY < EDGE_PX + 60) window.scrollBy(0, -EDGE_STEP);
        else if (lastY > window.innerHeight - EDGE_PX) window.scrollBy(0, EDGE_STEP);
        const target = computeTarget(lastX, lastY);
        const key = targetKey(target);
        if (key !== lastKey) {
          lastKey = key;
          setUi((prev) => (prev ? { ...prev, target } : prev));
        }
      });
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (active) {
        const target = computeTarget(ev.clientX, ev.clientY);
        document.addEventListener('click', suppressClick, true);
        setTimeout(() => document.removeEventListener('click', suppressClick, true), 80);
        cleanup();
        if (target) onDropRef.current(payload, target);
      } else {
        cleanup(); // не активувався — нехай спрацює звичайний click
      }
    };

    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) cleanup();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cleanup();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);

    if (e.pointerType === 'touch') {
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        // Активуємо з поточної позиції пальця (він стояв на місці).
        startX = lastX;
        startY = lastY;
        activate();
      }, HOLD_MS);
    }
  }, []);

  return { ui, start, ghostRef };
}
