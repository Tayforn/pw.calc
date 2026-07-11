// =========================================================
// Розклад Евентів: повноцінний календар івентів сервера.
// Вигляди місяць/тиждень/день, CRUD через попапи, drag&drop,
// звукові нагадування, імпорт/експорт JSON. Персист — localStorage.
// =========================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EvtItem, EvtSettings } from './events/types';
import { DOW_FULL, MONTH_GEN, MONTH_NOM, addDays, isoDow, minToHM, parseYmd, startOfWeek, ymd } from './events/dates';
import { DEFAULT_SETTINGS, loadStore, newId, saveStore } from './events/store';
import { buildDefaultEvents } from './events/defaults';
import MonthView from './events/MonthView';
import WeekView, { PX_PER_MIN } from './events/WeekView';
import EventModal from './events/EventModal';
import SettingsModal from './events/SettingsModal';
import ConfirmModal, { type ConfirmState } from './events/ConfirmModal';
import { useDrag, type DragPayload, type DropTarget } from './events/useDrag';
import { useReminders } from './events/useReminders';
import { warmupAudio } from './events/sound';
import { exportEvents, parseImport, readFileText } from './events/io';

type ViewKind = 'month' | 'week' | 'day';

const VIEW_LABELS: Record<ViewKind, string> = { month: 'Місяць', week: 'Тиждень', day: 'День' };

interface Editing {
  evt: EvtItem;
  isNew: boolean;
  occDate?: string;
}

export default function EventsPage() {
  const init = useMemo(loadStore, []);
  const [events, setEvents] = useState<EvtItem[]>(init.events);
  const [settings, setSettings] = useState<EvtSettings>(init.settings);
  const [view, setView] = useState<ViewKind>(() => (window.matchMedia('(max-width: 880px)').matches ? 'day' : 'week'));
  const [anchor, setAnchor] = useState(() => new Date());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Персист (патерн GeniePage).
  useEffect(() => {
    saveStore(events, settings);
  }, [events, settings]);

  useReminders(events, settings);

  // Прогрів AudioContext на першому жесті (autoplay policy).
  useEffect(() => {
    document.addEventListener('pointerdown', warmupAudio, { once: true });
    return () => document.removeEventListener('pointerdown', warmupAudio);
  }, []);

  const weekDays = useMemo(() => {
    if (view === 'day') return [anchor];
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [view, anchor]);

  const title = useMemo(() => {
    const y = anchor.getFullYear();
    if (view === 'month') return `${MONTH_NOM[anchor.getMonth()]} ${y}`;
    if (view === 'day') return `${DOW_FULL[isoDow(anchor)]}, ${anchor.getDate()} ${MONTH_GEN[anchor.getMonth()]} ${y}`;
    const a = weekDays[0];
    const b = weekDays[6];
    if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTH_GEN[a.getMonth()]} ${b.getFullYear()}`;
    return `${a.getDate()} ${MONTH_GEN[a.getMonth()]} – ${b.getDate()} ${MONTH_GEN[b.getMonth()]} ${b.getFullYear()}`;
  }, [view, anchor, weekDays]);

  const nav = (dir: -1 | 1) => {
    if (view === 'month') setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
    else setAnchor((d) => addDays(d, view === 'week' ? dir * 7 : dir));
  };

  // ---- CRUD ----

  const makeDraft = useCallback(
    (date: string, startMin: number): EvtItem => ({
      id: newId(),
      title: '',
      emoji: '',
      color: 'gold',
      start: startMin,
      duration: 30,
      recur: { kind: 'once', date },
      remind: true,
      leadMin: settings.defaultLead,
      order: events.reduce((m, e) => Math.max(m, e.order), 0) + 1,
    }),
    [settings.defaultLead, events],
  );

  const openCreate = useCallback(
    (date?: string, startMin?: number) => {
      setEditing({ evt: makeDraft(date ?? ymd(new Date()), startMin ?? 12 * 60), isNew: true });
    },
    [makeDraft],
  );

  const saveEvent = (evt: EvtItem) => {
    setEvents((prev) => (editing?.isNew ? [...prev, evt] : prev.map((e) => (e.id === evt.id ? evt : e))));
    setEditing(null);
  };

  const requestDelete = () => {
    if (!editing) return;
    const { evt, occDate } = editing;
    setEditing(null);
    const removeAll = () => {
      setEvents((prev) => prev.filter((e) => e.id !== evt.id));
      setConfirm(null);
    };
    if (evt.recur.kind === 'weekly' && occDate) {
      setConfirm({
        title: 'Видалити евент',
        body: (
          <p>
            «{evt.emoji} {evt.title}» повторюється щотижня. Видалити лише {occDate.split('-').reverse().join('.')} чи всю серію?
          </p>
        ),
        buttons: [
          {
            label: 'Лише цей день',
            kind: 'ghost',
            onClick: () => {
              setEvents((prev) =>
                prev.map((e) => (e.id === evt.id ? { ...e, skipDates: [...(e.skipDates ?? []), occDate] } : e)),
              );
              setConfirm(null);
            },
          },
          { label: 'Усю серію', kind: 'danger', onClick: removeAll },
          { label: 'Скасувати', kind: 'ghost', onClick: () => setConfirm(null) },
        ],
      });
    } else {
      setConfirm({
        title: 'Видалити евент',
        body: <p>Видалити «{evt.emoji} {evt.title}»?</p>,
        buttons: [
          { label: 'Видалити', kind: 'danger', onClick: removeAll },
          { label: 'Скасувати', kind: 'ghost', onClick: () => setConfirm(null) },
        ],
      });
    }
  };

  // ---- Drag & drop ----

  const onDrop = useCallback((payload: DragPayload, target: DropTarget) => {
    if (payload.kind === 'create') {
      openCreate(target.date, target.startMin ?? 12 * 60);
      return;
    }
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== payload.evtId) return e;
        const start = target.startMin ?? e.start;
        const duration = Math.min(e.duration, 1440 - start);
        if (e.recur.kind === 'once') return { ...e, start, duration, recur: { kind: 'once', date: target.date } };
        const fromDow = isoDow(parseYmd(payload.fromDate));
        const toDow = isoDow(parseYmd(target.date));
        const days = fromDow === toDow ? e.recur.days : (e.recur.days & ~(1 << fromDow)) | (1 << toDow);
        // Перенесений день серії більше не «пропущений», якщо колись був.
        const skipDates = e.skipDates?.filter((s) => s !== target.date);
        return { ...e, start, duration, recur: { kind: 'weekly', days }, skipDates };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreate]);

  const drag = useDrag({ pxPerMin: PX_PER_MIN, onDrop });

  // При переході на тиждень/день докручуємо сторінку до денних годин.
  useEffect(() => {
    if (view === 'month' || !gridRef.current) return;
    const top = gridRef.current.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top + 9.5 * 60 * PX_PER_MIN - 160), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ---- Імпорт/експорт ----

  const onImportFile = async (file: File) => {
    try {
      const { events: imported, skipped } = parseImport(await readFileText(file));
      setConfirm({
        title: 'Імпорт евентів',
        body: (
          <p>
            Знайдено евентів: <b>{imported.length}</b>
            {skipped > 0 && <>, пропущено невалідних: <b>{skipped}</b></>}. Замінити наявний розклад чи додати до нього?
          </p>
        ),
        buttons: [
          {
            label: 'Замінити',
            kind: 'danger',
            onClick: () => {
              setEvents(imported);
              setConfirm(null);
            },
          },
          {
            label: 'Додати',
            kind: 'primary',
            onClick: () => {
              setEvents((prev) => {
                const byId = new Map(prev.map((e) => [e.id, e]));
                for (const e of imported) byId.set(e.id, e);
                return [...byId.values()];
              });
              setConfirm(null);
            },
          },
          { label: 'Скасувати', kind: 'ghost', onClick: () => setConfirm(null) },
        ],
      });
    } catch (err) {
      setConfirm({
        title: 'Імпорт не вдався',
        body: <p>{err instanceof Error ? err.message : 'Невідома помилка.'}</p>,
        buttons: [{ label: 'Ок', kind: 'primary', onClick: () => setConfirm(null) }],
      });
    }
  };

  const requestReset = () => {
    setSettingsOpen(false);
    setConfirm({
      title: 'Скинути розклад',
      body: <p>Повернути стандартний розклад сервера? Усі зміни та власні евенти буде видалено.</p>,
      buttons: [
        {
          label: 'Скинути',
          kind: 'danger',
          onClick: () => {
            setEvents(buildDefaultEvents());
            setConfirm(null);
          },
        },
        { label: 'Скасувати', kind: 'ghost', onClick: () => setConfirm(null) },
      ],
    });
  };

  // ---- Render ----

  const ghost = drag.ui && (
    <div ref={drag.ghostRef} className="evt-drag-ghost" style={{ transform: `translate3d(${drag.ui.x + 14}px, ${drag.ui.y + 18}px, 0)` }}>
      {drag.ui.payload.kind === 'move' ? (
        <>
          {drag.ui.payload.emoji} {drag.ui.payload.title}
        </>
      ) : (
        <>➕ Новий евент</>
      )}
      <b>
        {drag.ui.target
          ? drag.ui.target.startMin !== null
            ? ` ${minToHM(drag.ui.target.startMin)}`
            : ` ${drag.ui.target.date.split('-').reverse().slice(0, 2).join('.')}`
          : ' —'}
      </b>
    </div>
  );

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Розклад</span>
        <h2>Розклад Евентів</h2>
        <p className="muted">
          Календар івентів сервера: редагуй, додавай власні, тягай мишею по днях і годинах, вмикай звукові нагадування.
        </p>
      </header>

      <div className="evt-toolbar">
        <div className="evt-seg" role="tablist" aria-label="Вигляд">
          {(Object.keys(VIEW_LABELS) as ViewKind[]).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={'evt-seg-btn' + (view === v ? ' active' : '')} onClick={() => setView(v)}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <div className="evt-nav">
          <button type="button" className="btn btn-ghost evt-nav-btn" aria-label="Назад" onClick={() => nav(-1)}>‹</button>
          <button type="button" className="btn btn-ghost evt-nav-btn evt-today-btn" onClick={() => setAnchor(new Date())}>Сьогодні</button>
          <button type="button" className="btn btn-ghost evt-nav-btn" aria-label="Вперед" onClick={() => nav(1)}>›</button>
        </div>
        <span className="evt-title">{title}</span>
        <span className="evt-spacer" />
        <button
          type="button"
          className="btn btn-primary evt-add-btn"
          title="Клік — створити; або перетягни на календар"
          onPointerDown={(e) => drag.start(e, { kind: 'create' })}
          onClick={() => openCreate()}
        >
          + Евент
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => exportEvents(events)}>Експорт</button>
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Імпорт</button>
        <button type="button" className="btn btn-ghost evt-gear" aria-label="Налаштування нагадувань" onClick={() => setSettingsOpen(true)}>⚙</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onImportFile(f);
          }}
        />
      </div>

      <div className="card evt-card" ref={gridRef}>
        {view === 'month' ? (
          <MonthView
            anchor={anchor}
            events={events}
            dragUi={drag.ui}
            onDragStart={drag.start}
            onOpenEvent={(evt, occDate) => setEditing({ evt, isNew: false, occDate })}
            onOpenDay={(d) => {
              setAnchor(d);
              setView('day');
            }}
            onCreateAt={(date) => openCreate(date)}
          />
        ) : (
          <WeekView
            days={weekDays}
            events={events}
            dragUi={drag.ui}
            onDragStart={drag.start}
            onOpenEvent={(evt, occDate) => setEditing({ evt, isNew: false, occDate })}
            onCreateAt={openCreate}
          />
        )}
      </div>

      {editing && (
        <EventModal
          key={editing.evt.id}
          initial={editing.evt}
          isNew={editing.isNew}
          onSave={saveEvent}
          onDelete={editing.isNew ? undefined : requestDelete}
          onClose={() => setEditing(null)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onReset={requestReset}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {confirm && <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />}
      {ghost && createPortal(ghost, document.body)}
    </>
  );
}
