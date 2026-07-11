// =========================================================
// Розклад Евентів: універсальний конфірм (видалення / reset / імпорт).
// Патерн модалки — як ChestConfigModal (ChestsPage).
// =========================================================

import { useEffect, type ReactNode } from 'react';

export interface ConfirmButton {
  label: string;
  kind?: 'primary' | 'ghost' | 'danger';
  onClick: () => void;
}

export interface ConfirmState {
  title: string;
  body: ReactNode;
  buttons: ConfirmButton[];
}

/** Спільний «хром» модалки: лок скролу body + Escape. Лічильник — на випадок стеку модалок. */
let modalDepth = 0;
export function useModalChrome(onClose: () => void): void {
  useEffect(() => {
    modalDepth += 1;
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      modalDepth -= 1;
      if (modalDepth === 0) document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
}

export default function ConfirmModal({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  useModalChrome(onClose);
  return (
    <div className="modal-overlay evt-overlay" id="evtConfirmOverlay" onClick={(e) => { if ((e.target as HTMLElement).id === 'evtConfirmOverlay') onClose(); }}>
      <div className="modal evt-confirm" role="dialog" aria-modal="true" aria-labelledby="evtConfirmTitle">
        <div className="modal-head">
          <h3 id="evtConfirmTitle">{state.title}</h3>
          <button type="button" className="modal-close" aria-label="Закрити" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{state.body}</div>
        <div className="modal-foot evt-confirm-foot">
          {state.buttons.map((b) => (
            <button
              key={b.label}
              type="button"
              className={'btn ' + (b.kind === 'primary' ? 'btn-primary' : b.kind === 'danger' ? 'btn-ghost evt-btn-danger' : 'btn-ghost')}
              onClick={b.onClick}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
