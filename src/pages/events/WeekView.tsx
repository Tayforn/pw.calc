// =========================================================
// Розклад Евентів: тижневий/денний вигляд (days.length 7 або 1).
// Часова сітка: hourPx px/год (базово 48). Висота блока = тривалість.
// Стос однакових стартів: top += k*10px, перший зверху; часткові
// накладання — side-by-side колонки (layoutDay).
// Ctrl+колесо над сіткою масштабує висоту години (useWheelZoom).
// =========================================================

import { useEffect, useState } from 'react';
import type { EvtItem } from './types';
import { DOW_SHORT, minToHM, occurrencesForDay, ymd } from './dates';
import { layoutDay } from './layout';
import type { DragPayload, DragUiState } from './useDrag';
import { useWheelZoom } from './useWheelZoom';

/** Базова висота години; синхронна з fallback --evt-hour-h у styles.css. */
export const HOUR_PX = 48;
export const ZOOM_MIN = 20;
export const ZOOM_MAX = 240;

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30_000);
    const onVis = () => {
      if (!document.hidden) setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return now;
}

interface Props {
  days: Date[];
  events: EvtItem[];
  dragUi: DragUiState | null;
  /** Висота години в px (масштаб, Ctrl+колесо). */
  hourPx: number;
  onZoom: (hourPx: number) => void;
  onDragStart: (e: React.PointerEvent, payload: DragPayload) => void;
  onOpenEvent: (evt: EvtItem, dateKey: string) => void;
  /** Даблклік по вільному місцю колонки — створити евент на цій даті/годині. */
  onCreateAt: (dateKey: string, startMin: number) => void;
}

export default function WeekView({ days, events, dragUi, hourPx, onZoom, onDragStart, onOpenEvent, onCreateAt }: Props) {
  const now = useNow();
  const todayKey = ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cols = { gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` };
  const dragging = dragUi?.payload.kind === 'move' ? dragUi.payload : null;
  const pxPerMin = hourPx / 60;
  const bodyRef = useWheelZoom<HTMLDivElement>({ value: hourPx, min: ZOOM_MIN, max: ZOOM_MAX, onChange: onZoom });

  return (
    <div className="evt-week-wrap">
      <div
        className={'evt-week' + (days.length === 1 ? ' evt-week-single' : '')}
        style={{ '--evt-hour-h': `${hourPx}px` } as React.CSSProperties}
      >
        <div className="evt-week-head" style={cols}>
          <div className="evt-gutter-spacer" aria-hidden="true" />
          {days.map((d) => (
            <div key={ymd(d)} className={'evt-dayhead' + (ymd(d) === todayKey ? ' today' : '')}>
              <span>{DOW_SHORT[(d.getDay() + 6) % 7]}</span> <b>{d.getDate()}</b>
            </div>
          ))}
        </div>
        <div className="evt-week-body" style={cols} ref={bodyRef}>
          <div className="evt-gutter" style={{ height: 24 * hourPx }} aria-hidden="true">
            {Array.from({ length: 23 }, (_, i) => (
              <span key={i} className="evt-hour" style={{ top: (i + 1) * hourPx }}>
                {String(i + 1).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((day) => {
            const key = ymd(day);
            const placed = layoutDay(occurrencesForDay(events, day));
            const drop = dragUi?.target && dragUi.target.date === key && dragUi.target.startMin !== null ? dragUi.target : null;
            const dropDur = drop ? (dragUi!.payload.kind === 'move' ? dragUi!.payload.duration : 30) : 0;
            return (
              <div
                key={key}
                className="evt-col"
                data-evt-day={key}
                style={{ height: 24 * hourPx }}
                onDoubleClick={(ev) => {
                  if ((ev.target as HTMLElement).closest('.evt-block')) return;
                  const rect = ev.currentTarget.getBoundingClientRect();
                  const min = Math.max(0, Math.min(1410, Math.round((ev.clientY - rect.top) / pxPerMin / 5) * 5));
                  onCreateAt(key, min);
                }}
              >
                {placed.map((p) => {
                  const e = p.occ.evt;
                  const top = p.occ.startMin * pxPerMin + p.stackIdx * 10;
                  const height = Math.max(e.duration * pxPerMin - 1, 18);
                  const colPct = 100 / p.cols;
                  const isDragged = dragging?.evtId === e.id && dragging.fromDate === key;
                  return (
                    <button
                      key={e.id + p.stackIdx}
                      type="button"
                      className={`evt-block evt-c-${e.color}` + (isDragged ? ' evt-dragging' : '') + (height < 34 ? ' evt-block-slim' : '')}
                      style={{
                        top,
                        height,
                        left: `calc(${p.col * colPct}% + ${p.stackIdx * 6 + 1}px)`,
                        width: `calc(${colPct}% - ${p.stackIdx * 6 + 3}px)`,
                        zIndex: 20 - p.stackIdx,
                      }}
                      title={`${e.emoji} ${e.title} — ${minToHM(p.occ.startMin)}–${minToHM(p.occ.endMin)}${e.notes ? '\n' + e.notes : ''}`}
                      onPointerDown={(ev) =>
                        onDragStart(ev, {
                          kind: 'move',
                          evtId: e.id,
                          fromDate: key,
                          duration: e.duration,
                          emoji: e.emoji,
                          title: e.title,
                          color: e.color,
                        })
                      }
                      onClick={() => onOpenEvent(e, key)}
                    >
                      <span className="evt-block-t">
                        {minToHM(p.occ.startMin)}–{minToHM(p.occ.endMin)}
                      </span>
                      <span className="evt-block-n">
                        {e.emoji} {e.title}
                      </span>
                    </button>
                  );
                })}
                {key === todayKey && <div className="evt-nowline" style={{ top: nowMin * pxPerMin }} aria-hidden="true" />}
                {drop && (
                  <div
                    className="evt-drop-preview"
                    style={{ top: drop.startMin! * pxPerMin, height: Math.max(dropDur * pxPerMin, 18) }}
                    aria-hidden="true"
                  >
                    {minToHM(drop.startMin!)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
