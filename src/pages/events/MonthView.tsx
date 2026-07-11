// =========================================================
// Розклад Евентів: місячний вигляд. До 3 чіпів на день + «+N ще».
// Чіпи можна тягати між днями (час зберігається).
// =========================================================

import type { EvtItem } from './types';
import { DOW_SHORT, addDays, isoDow, minToHM, occurrencesForDay, startOfWeek, ymd } from './dates';
import type { DragPayload, DragUiState } from './useDrag';

const MAX_CHIPS = 3;

interface Props {
  anchor: Date;
  events: EvtItem[];
  dragUi: DragUiState | null;
  onDragStart: (e: React.PointerEvent, payload: DragPayload) => void;
  onOpenEvent: (evt: EvtItem, dateKey: string) => void;
  onOpenDay: (d: Date) => void;
  /** Даблклік по вільному місцю клітинки — створити евент на цій даті. */
  onCreateAt: (dateKey: string) => void;
}

export default function MonthView({ anchor, events, dragUi, onDragStart, onOpenEvent, onOpenDay, onCreateAt }: Props) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const weeks = Math.ceil((isoDow(first) + daysInMonth) / 7);
  const gridStart = startOfWeek(first);
  const todayKey = ymd(new Date());
  const dropDate = dragUi?.target && dragUi.target.startMin === null ? dragUi.target.date : null;

  return (
    <div className="evt-month" role="grid" aria-label="Місяць">
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
            const extra = occs.length - MAX_CHIPS;
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
                  {occs.slice(0, MAX_CHIPS).map((occ, idx) => (
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
