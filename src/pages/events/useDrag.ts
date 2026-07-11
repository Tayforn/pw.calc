// =========================================================
// Розклад Евентів: drag&drop на Pointer Events (HTML5 DnD не працює на тачі).
// Миша/перо — активація після 6px руху; тач — long-press 320мс
// (доти вертикальний скрол лишається нативним через touch-action: pan-y).
// Координати цілей — у page-координатах, тож скрол під час drag не збиває.
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
  x: number; // clientX
  y: number; // clientY
  target: DropTarget | null;
}

interface TargetRect {
  date: string;
  timed: boolean; // .evt-col (тиждень/день) чи .evt-mcell (місяць)
  left: number; // page-координати
  top: number;
  right: number;
  bottom: number;
}

interface Session {
  payload: DragPayload;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  holdTimer: number | null;
  rects: TargetRect[];
  raf: number;
  lastX: number;
  lastY: number;
}

const MOUSE_SLOP = 6;
const TOUCH_SLOP = 8;
const HOLD_MS = 320;
const EDGE_PX = 70;
const EDGE_STEP = 12;

interface Options {
  pxPerMin: number;
  onDrop: (payload: DragPayload, target: DropTarget) => void;
}

export function useDrag({ pxPerMin, onDrop }: Options) {
  const [ui, setUi] = useState<DragUiState | null>(null);
  const sess = useRef<Session | null>(null);
  const activateRef = useRef<() => void>(() => {});
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const snapshotRects = () => {
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
  };

  const computeTarget = useCallback(
    (clientX: number, clientY: number): DropTarget | null => {
      const s = sess.current;
      if (!s) return null;
      const px = clientX + window.scrollX;
      const py = clientY + window.scrollY;
      const hit = s.rects.find((r) => px >= r.left && px < r.right && py >= r.top && py < r.bottom);
      if (!hit) return null;
      if (!hit.timed) return { date: hit.date, startMin: null };
      const dur = s.payload.kind === 'move' ? s.payload.duration : 30;
      const raw = (py - hit.top) / pxPerMin;
      const startMin = Math.max(0, Math.min(1440 - dur, Math.round(raw / 5) * 5));
      return { date: hit.date, startMin };
    },
    [pxPerMin],
  );

  useEffect(() => {
    const preventTouch = (e: TouchEvent) => {
      if (sess.current?.active) e.preventDefault();
    };
    // Один раз кліком по документу після drag — гасимо синтетичний click по джерелу.
    const suppressClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      document.removeEventListener('click', suppressClick, true);
    };

    const cleanup = () => {
      const s = sess.current;
      if (!s) return;
      if (s.holdTimer != null) clearTimeout(s.holdTimer);
      if (s.raf) cancelAnimationFrame(s.raf);
      sess.current = null;
      document.documentElement.classList.remove('evt-drag-on');
      setUi(null);
    };

    const activate = () => {
      const s = sess.current;
      if (!s || s.active) return;
      s.active = true;
      s.rects = snapshotRects();
      document.documentElement.classList.add('evt-drag-on');
      navigator.vibrate?.(10);
      setUi({ payload: s.payload, x: s.lastX, y: s.lastY, target: computeTarget(s.lastX, s.lastY) });
    };
    activateRef.current = activate;

    const onMove = (e: PointerEvent) => {
      const s = sess.current;
      if (!s || e.pointerId !== s.pointerId) return;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
      if (!s.active) {
        if (s.holdTimer != null) {
          // Тач: ранній рух — це скрол, скасовуємо long-press.
          if (dist > TOUCH_SLOP) cleanup();
          return;
        }
        if (dist > MOUSE_SLOP) activate();
        if (!s.active) return;
      }
      if (s.raf) return;
      s.raf = requestAnimationFrame(() => {
        const cur = sess.current;
        if (!cur || !cur.active) return;
        cur.raf = 0;
        // Авто-скрол сторінки біля країв екрана; rect-и в page-координатах, тож валідні.
        if (cur.lastY < EDGE_PX + 60) window.scrollBy(0, -EDGE_STEP);
        else if (cur.lastY > window.innerHeight - EDGE_PX) window.scrollBy(0, EDGE_STEP);
        setUi({ payload: cur.payload, x: cur.lastX, y: cur.lastY, target: computeTarget(cur.lastX, cur.lastY) });
      });
    };

    const onUp = (e: PointerEvent) => {
      const s = sess.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (s.active) {
        const target = computeTarget(e.clientX, e.clientY);
        document.addEventListener('click', suppressClick, true);
        setTimeout(() => document.removeEventListener('click', suppressClick, true), 80);
        cleanup();
        if (target) onDropRef.current(s.payload, target);
      } else {
        cleanup(); // не активувався — нехай спрацює звичайний click
      }
    };

    const onCancel = (e: PointerEvent) => {
      if (sess.current && e.pointerId === sess.current.pointerId) cleanup();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sess.current?.active) cleanup();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
    document.addEventListener('touchmove', preventTouch, { passive: false });
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('touchmove', preventTouch);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeTarget]);

  /** Вішається на pointerDown джерела (блок евента або кнопка «+ Евент»). */
  const start = useCallback((e: React.PointerEvent, payload: DragPayload) => {
    if (sess.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const s: Session = {
      payload,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      active: false,
      holdTimer: null,
      rects: [],
      raf: 0,
    };
    if (e.pointerType === 'touch') {
      s.holdTimer = window.setTimeout(() => {
        if (sess.current === s) {
          s.holdTimer = null;
          activateRef.current();
        }
      }, HOLD_MS);
    }
    sess.current = s;
  }, []);

  return { ui, start };
}
