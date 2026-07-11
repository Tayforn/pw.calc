// =========================================================
// Розклад Евентів: налаштування звуку/сповіщень + reset розкладу.
// =========================================================

import { useState } from 'react';
import type { EvtSettings } from './types';
import { LEAD_OPTIONS } from './store';
import { playPreset } from './sound';
import { useModalChrome } from './ConfirmModal';

const PRESET_LABELS: Record<EvtSettings['preset'], string> = {
  bell: 'Дзвіночок',
  gong: 'Гонг',
  beep: 'Сигнал',
};

interface Props {
  settings: EvtSettings;
  onChange: (patch: Partial<EvtSettings>) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onChange, onReset, onClose }: Props) {
  useModalChrome(onClose);
  // Форс-ререндер після зміни Notification.permission (вона не реактивна).
  const [, bump] = useState(0);

  const notifSupported = typeof Notification !== 'undefined';
  const perm = notifSupported ? Notification.permission : 'denied';

  const askNotif = async () => {
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') onChange({ useNotifApi: true });
    } finally {
      bump((v) => v + 1);
    }
  };

  return (
    <div className="modal-overlay evt-overlay" id="evtSettingsOverlay" onClick={(e) => { if ((e.target as HTMLElement).id === 'evtSettingsOverlay') onClose(); }}>
      <div className="modal evt-settings" role="dialog" aria-modal="true" aria-labelledby="evtSettingsTitle">
        <div className="modal-head">
          <h3 id="evtSettingsTitle">Налаштування нагадувань</h3>
          <button type="button" className="modal-close" aria-label="Закрити" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body evt-form">
          <p className="muted evt-settings-note">
            Нагадування працюють, поки вкладка з Хелпером відкрита в браузері.
          </p>

          <label className="evt-radio">
            <input type="checkbox" checked={settings.soundOn} onChange={(e) => onChange({ soundOn: e.target.checked })} />
            Звукове нагадування
          </label>

          <div className="evt-form-row evt-sound-row">
            <label className="evt-field">
              <span>Звук</span>
              <select value={settings.preset} disabled={!settings.soundOn} onChange={(e) => onChange({ preset: e.target.value as EvtSettings['preset'] })}>
                {(Object.keys(PRESET_LABELS) as EvtSettings['preset'][]).map((p) => (
                  <option key={p} value={p}>{PRESET_LABELS[p]}</option>
                ))}
              </select>
            </label>
            <label className="evt-field">
              <span>Гучність: {settings.volume}%</span>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.volume}
                disabled={!settings.soundOn}
                onChange={(e) => onChange({ volume: Number(e.target.value) })}
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost evt-test-btn"
              disabled={!settings.soundOn}
              onClick={() => playPreset(settings.preset, settings.volume)}
            >
              ▶ Тест
            </button>
          </div>

          <label className="evt-field evt-field-lead">
            <span>Випередження за замовчуванням (для нових евентів)</span>
            <select value={settings.defaultLead} onChange={(e) => onChange({ defaultLead: Number(e.target.value) })}>
              {LEAD_OPTIONS.map((v) => (
                <option key={v} value={v}>{v === 0 ? 'У момент початку' : `За ${v} хв`}</option>
              ))}
            </select>
          </label>

          <div className="evt-field">
            <span>Сповіщення браузера (працюють і у згорнутій вкладці)</span>
            {!notifSupported ? (
              <p className="muted">Цей браузер не підтримує сповіщення.</p>
            ) : perm === 'granted' ? (
              <label className="evt-radio">
                <input type="checkbox" checked={settings.useNotifApi} onChange={(e) => onChange({ useNotifApi: e.target.checked })} />
                Показувати сповіщення
              </label>
            ) : perm === 'denied' ? (
              <p className="muted">Заблоковано в налаштуваннях браузера для цього сайту.</p>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={askNotif}>Дозволити сповіщення</button>
            )}
          </div>

          <hr className="evt-hr" />
          <button type="button" className="btn btn-ghost evt-btn-danger" onClick={onReset}>
            ↺ Скинути до стандартного розкладу
          </button>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  );
}
