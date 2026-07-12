// =========================================================
// Розклад Евентів: місячний вигляд. Скільки чіпів влазить у
// клітинку (базово 3) + «+N ще»; чіпи можна тягати між днями
// (час зберігається). Ctrl+колесо масштабує висоту клітинок —
// що вища клітинка, то більше чіпів видно (useWheelZoom).
// =========================================================

import type { EvtItem } from './types';
import { DOW_SHORT, addDays, isoDow, minToHM, occurrencesForDay, startOfWeek, ymd } from './dates';
import type { DragPayload, DragUiState } from './useDrag';
import { useWheelZoom } from './useWheelZoom';

/** Базова висота клітинки; синхронна з fallback --evt-mcell-h у styles.css. */
export const MCELL_PX = 98;
export const MCELL_MIN = 70;
export const MCELL_MAX = 320;

/** Скільки чіпів влазить: висота мінус номер дня (~34px), чіп із гепом ~21px. */
const maxChips = (cellPx: number) => Math.max(1, Math.floor((cellPx - 34) / 21));

interface Props {
  anchor: Date;
  events: EvtItem[];
  dragUi: DragUiState | null;
  /** Висота клітинки в px (масштаб, Ctrl+колесо). */
  cellPx: number;
  onZoom: (cellPx: number) => void;
  onDragStart: (e: React.PointerEvent, payload: DragPayload) => void;
  onOpenEvent: (evt: EvtItem, dateKey: string) => void;
  onOpenDay: (d: Date) => void;
  /** Даблклік по вільному місцю клітинки — створити евент на цій даті. */
  onCreateAt: (dateKey: string) => void;
}

export default function MonthView({ anchor, events, dragUi, cellPx, onZoom, onDragStart, onOpenEvent, onOpenDay, onCreateAt }: Props) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const weeks = Math.ceil((isoDow(first) + daysInMonth) / 7);
  const gridStart = startOfWeek(first);
  const todayKey = ymd(new Date());
  const dropDate = dragUi?.target && dragUi.target.startMin === null ? dragUi.target.date : null;
  const chips = maxChips(cellPx);
  const zoomRef = useWheelZoom<HTMLDivElement>({ value: cellPx, min: MCELL_MIN, max: MCELL_MAX, onChange: onZoom });

  return (
    <div
      className="evt-month"
      role="grid"
      aria-label="Місяць"
      ref={zoomRef}
      style={{ '--evt-mcell-h': `${cellPx}px` } as React.CSSProperties}
    >
      <div className="evt-month-head" role="row">
        {DOW_SHORT.map((d) => (
          <div key={d} className="evt-month-dow" role="columnheader">{d}</div>
        ))}
      </div>
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} className="evt-month-row" role="row">
          {Array.from({ length: 7 }, (_, i) => {
            const day = addDays(gridStart, w * 7 + i);
            const key = ymd(day);
            const occs = occurrencesForDay(events, day);
            const extra = occs.length - chips;
            return (
              <div
                key={key}
                role="gridcell"
                data-evt-day={key}
                className={
                  'evt-mcell' +
                  (day.getMonth() !== m ? ' dim' : '') +
                  (key === todayKey ? ' today' : '') +
                  (dropDate === key ? ' drop-hint' : '')
                }
                onDoubleClick={(ev) => {
                  if ((ev.target as HTMLElement).closest('.evt-chip, .evt-more, .evt-mnum')) return;
                  onCreateAt(key);
                }}
              >
                <button type="button" className="evt-mnum" onClick={() => onOpenDay(day)} aria-label={`Відкрити день ${key}`}>
                  {day.getDate()}
                </button>
                <div className="evt-mchips">
                  {occs.slice(0, chips).map((occ, idx) => (
                    <button
                      key={occ.evt.id + idx}
                      type="button"
                      className={`evt-chip evt-c-${occ.evt.color}`}
                      title={`${occ.evt.emoji} ${occ.evt.title} — ${minToHM(occ.startMin)}`}
                      onPointerDown={(e) =>
                        onDragStart(e, {
                          kind: 'move',
                          evtId: occ.evt.id,
                          fromDate: key,
                          duration: occ.evt.duration,
                          emoji: occ.evt.emoji,
                          title: occ.evt.title,
                          color: occ.evt.color,
                        })
                      }
                      onClick={() => onOpenEvent(occ.evt, key)}
                    >
                      <b>{minToHM(occ.startMin)}</b>
                      <span className="evt-chip-name">{occ.evt.emoji} {occ.evt.title}</span>
                    </button>
                  ))}
                  {extra > 0 && (
                    <button type="button" className="evt-more" onClick={() => onOpenDay(day)}>
                      +{extra} ще
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
