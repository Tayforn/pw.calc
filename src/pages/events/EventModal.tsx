// =========================================================
// Розклад Евентів: попап створення/редагування евента.
// =========================================================

import { useMemo, useState } from 'react';
import type { EvtColor, EvtItem } from './types';
import { EVT_COLORS } from './types';
import { DOW_SHORT, hmToMin, minToHM, ymd } from './dates';
import { LEAD_OPTIONS } from './store';
import { useModalChrome } from './ConfirmModal';

const COLOR_LABELS: Record<EvtColor, string> = {
  gold: 'Золотий',
  sky: 'Блакитний',
  green: 'Зелений',
  red: 'Червоний',
  violet: 'Фіолетовий',
  orange: 'Помаранчевий',
};

const LEAD_LABELS: Record<number, string> = {
  0: 'У момент початку',
  5: 'За 5 хв',
  10: 'За 10 хв',
  15: 'За 15 хв',
  30: 'За 30 хв',
};

interface Props {
  initial: EvtItem;
  isNew: boolean;
  onSave: (evt: EvtItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function EventModal({ initial, isNew, onSave, onDelete, onClose }: Props) {
  useModalChrome(onClose);

  const [title, setTitle] = useState(initial.title);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [color, setColor] = useState<EvtColor>(initial.color);
  const [weekly, setWeekly] = useState(initial.recur.kind === 'weekly');
  const [onceDate, setOnceDate] = useState(initial.recur.kind === 'once' ? initial.recur.date : ymd(new Date()));
  const [days, setDays] = useState(initial.recur.kind === 'weekly' ? initial.recur.days : 0);
  const [startHM, setStartHM] = useState(minToHM(initial.start));
  const [endHM, setEndHM] = useState(initial.start + initial.duration >= 1440 ? '00:00' : minToHM(initial.start + initial.duration));
  const [remind, setRemind] = useState(initial.remind);
  const [leadMin, setLeadMin] = useState(initial.leadMin);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [order, setOrder] = useState(initial.order);

  const err = useMemo(() => {
    if (!title.trim()) return 'Вкажи назву евента.';
    if (weekly && days === 0) return 'Обери хоча б один день тижня.';
    const s = hmToMin(startHM);
    if (s == null) return 'Некоректний час початку.';
    const eRaw = hmToMin(endHM);
    if (eRaw == null) return 'Некоректний час кінця.';
    const e = eRaw === 0 ? 1440 : eRaw; // 00:00 в полі кінця = кінець доби
    if (e <= s) return 'Кінець має бути пізніше початку (в межах доби).';
    return null;
  }, [title, weekly, days, startHM, endHM]);

  const save = () => {
    if (err) return;
    const s = hmToMin(startHM)!;
    const eRaw = hmToMin(endHM)!;
    const e = eRaw === 0 ? 1440 : eRaw;
    onSave({
      ...initial,
      title: title.trim(),
      emoji: emoji.trim(),
      color,
      start: s,
      duration: e - s,
      recur: weekly ? { kind: 'weekly', days } : { kind: 'once', date: onceDate },
      notes: notes.trim() || undefined,
      remind,
      leadMin,
      order,
    });
  };

  return (
    <div className="modal-overlay evt-overlay" id="evtEditOverlay" onClick={(e) => { if ((e.target as HTMLElement).id === 'evtEditOverlay') onClose(); }}>
      <div className="modal evt-modal" role="dialog" aria-modal="true" aria-labelledby="evtEditTitle">
        <div className="modal-head">
          <h3 id="evtEditTitle">{isNew ? 'Новий евент' : 'Редагувати евент'}</h3>
          <button type="button" className="modal-close" aria-label="Закрити" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body evt-form">
          <div className="evt-form-row evt-form-name">
            <label className="evt-field evt-field-emoji">
              <span>Емодзі</span>
              <input type="text" value={emoji} maxLength={8} placeholder="🐍" onChange={(e) => setEmoji(e.target.value)} />
            </label>
            <label className="evt-field">
              <span>Назва</span>
              <input type="text" value={title} maxLength={120} placeholder="Назва евента" autoFocus={isNew} onChange={(e) => setTitle(e.target.value)} />
            </label>
          </div>

          <div className="evt-field">
            <span>Колір</span>
            <div className="evt-swatches" role="radiogroup" aria-label="Колір">
              {EVT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  title={COLOR_LABELS[c]}
                  className={`evt-swatch evt-c-${c}` + (color === c ? ' active' : '')}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="evt-field">
            <span>Повторення</span>
            <div className="evt-recur">
              <label className="evt-radio">
                <input type="radio" name="evtRecur" checked={!weekly} onChange={() => setWeekly(false)} />
                Одноразово
              </label>
              <label className="evt-radio">
                <input type="radio" name="evtRecur" checked={weekly} onChange={() => setWeekly(true)} />
                Щотижня
              </label>
            </div>
            {weekly ? (
              <div className="evt-daychips">
                {DOW_SHORT.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    className={'evt-daychip' + ((days >> i) & 1 ? ' active' : '')}
                    aria-pressed={((days >> i) & 1) === 1}
                    onClick={() => setDays(days ^ (1 << i))}
                  >
                    {d}
                  </button>
                ))}
              </div>
            ) : (
              <input className="evt-date-input" type="date" value={onceDate} onChange={(e) => e.target.value && setOnceDate(e.target.value)} />
            )}
          </div>

          <div className="evt-form-row">
            <label className="evt-field">
              <span>Початок</span>
              <input type="time" step={300} value={startHM} onChange={(e) => setStartHM(e.target.value)} />
            </label>
            <label className="evt-field">
              <span>Кінець</span>
              <input type="time" step={300} value={endHM} onChange={(e) => setEndHM(e.target.value)} />
            </label>
          </div>

          <div className="evt-form-row evt-form-remind">
            <label className="evt-radio">
              <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
              Нагадування
            </label>
            <select value={leadMin} disabled={!remind} onChange={(e) => setLeadMin(Number(e.target.value))}>
              {LEAD_OPTIONS.map((v) => (
                <option key={v} value={v}>{LEAD_LABELS[v]}</option>
              ))}
            </select>
          </div>

          <label className="evt-field">
            <span>Нотатки</span>
            <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <details className="evt-adv">
            <summary>Додатково</summary>
            <label className="evt-field evt-field-order">
              <span>Порядок у стосі (менший — вище)</span>
              <input
                type="number"
                value={order}
                step={1}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setOrder(Number.isFinite(v) ? v : 0);
                }}
              />
            </label>
          </details>

          {err && <p className="evt-form-err">{err}</p>}
        </div>
        <div className="modal-foot">
          {!isNew && onDelete ? (
            <button type="button" className="btn btn-ghost evt-btn-danger" onClick={onDelete}>Видалити</button>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Скасувати</button>
          <button type="button" className="btn btn-primary" disabled={!!err} onClick={save}>Зберегти</button>
        </div>
      </div>
    </div>
  );
}
