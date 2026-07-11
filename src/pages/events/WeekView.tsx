// =========================================================
// Розклад Евентів: тижневий/денний вигляд (days.length 7 або 1).
// Часова сітка: 48px/год (0.8 px/хв). Висота блока = тривалість.
// Стос однакових стартів: top += k*10px, перший зверху; часткові
// накладання — side-by-side колонки (layoutDay).
// =========================================================

import { useEffect, useState } from 'react';
import type { EvtItem } from './types';
import { DOW_SHORT, minToHM, occurrencesForDay, ymd } from './dates';
import { layoutDay } from './layout';
import type { DragPayload, DragUiState } from './useDrag';

/** Тримати в синхроні з --evt-hour-h у styles.css. */
export const HOUR_PX = 48;
export const PX_PER_MIN = HOUR_PX / 60;

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
  onDragStart: (e: React.PointerEvent, payload: DragPayload) => void;
  onOpenEvent: (evt: EvtItem, dateKey: string) => void;
}

export default function WeekView({ days, events, dragUi, onDragStart, onOpenEvent }: Props) {
  const now = useNow();
  const todayKey = ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cols = { gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` };
  const dragging = dragUi?.payload.kind === 'move' ? dragUi.payload : null;

  return (
    <div className="evt-week-wrap">
      <div className={'evt-week' + (days.length === 1 ? ' evt-week-single' : '')}>
        <div className="evt-week-head" style={cols}>
          <div className="evt-gutter-spacer" aria-hidden="true" />
          {days.map((d) => (
            <div key={ymd(d)} className={'evt-dayhead' + (ymd(d) === todayKey ? ' today' : '')}>
              <span>{DOW_SHORT[(d.getDay() + 6) % 7]}</span> <b>{d.getDate()}</b>
            </div>
          ))}
        </div>
        <div className="evt-week-body" style={cols}>
          <div className="evt-gutter" style={{ height: 24 * HOUR_PX }} aria-hidden="true">
            {Array.from({ length: 23 }, (_, i) => (
              <span key={i} className="evt-hour" style={{ top: (i + 1) * HOUR_PX }}>
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
              <div key={key} className="evt-col" data-evt-day={key} style={{ height: 24 * HOUR_PX }}>
                {placed.map((p) => {
                  const e = p.occ.evt;
                  const top = p.occ.startMin * PX_PER_MIN + p.stackIdx * 10;
                  const height = Math.max(e.duration * PX_PER_MIN - 1, 18);
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
                {key === todayKey && <div className="evt-nowline" style={{ top: nowMin * PX_PER_MIN }} aria-hidden="true" />}
                {drop && (
                  <div
                    className="evt-drop-preview"
                    style={{ top: drop.startMin! * PX_PER_MIN, height: Math.max(dropDur * PX_PER_MIN, 18) }}
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
