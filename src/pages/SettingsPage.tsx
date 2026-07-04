// =========================================================
// Налаштування — ідіоматичний React (фаза 3).
// Store — src/settings (setSetting/resetSettings нотифікують підписників,
// зокрема renderAll legacy-калькуляторів). Монетні поля з маскою розрядки.
// =========================================================

import type { ReactNode } from 'react';
import { groupDigits } from '../utils/format';
import { MASKED_PRICE_FIELDS, resetSettings, setSetting } from '../settings';
import { useGoldTouched, useSettings } from '../app/useSettings';
import type { Settings } from '../types';

const isMasked = (key: keyof Settings) => MASKED_PRICE_FIELDS.includes(key);
const display = (key: keyof Settings, v: number) => (isMasked(key) ? groupDigits(String(v)) : String(v));

export default function SettingsPage() {
  const settings = useSettings();
  const goldTouched = useGoldTouched();

  const onChange = (key: keyof Settings, raw: string) => {
    const v = parseFloat(raw.replace(/\s/g, ''));
    if (Number.isFinite(v) && v >= 0) setSetting(key, v);
  };

  // Монетне поле з маскою (text + inputmode numeric): значення контрольоване стором.
  const coinField = (key: keyof Settings, label: ReactNode, hint: ReactNode, badge?: boolean) => (
    <div className="field">
      <label htmlFor={key}>
        {label}
        {badge && <span className={'field-default-badge' + (goldTouched ? '' : ' is-shown')} id="goldPriceBadge">дефолт</span>}
      </label>
      <input
        type="text"
        inputMode="numeric"
        id={key}
        autoComplete="off"
        value={display(key, settings[key])}
        onChange={(e) => onChange(key, e.target.value)}
      />
      <small className="hint">{hint}</small>
    </div>
  );

  const stoneField = (key: keyof Settings, label: ReactNode, hint: ReactNode) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input
        type="number"
        id={key}
        min={0}
        step={0.01}
        value={settings[key]}
        onChange={(e) => onChange(key, e.target.value)}
      />
      <small className="hint">{hint}</small>
    </div>
  );

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Налаштування</span>
        <h2>Ціни на сервері</h2>
        <p>
          Всі калькулятори використовують ці значення. Зміни тимчасові —
          скидаються до дефолтів при кожному оновленні сторінки. Ціна
          1 ★1 шара зафіксована (2 голди) і не редагується.
        </p>
      </header>

      <div className="card calc-card">
        <form id="settingsForm" className="grid-form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div className="field-group">
            <h3>Основне (монет)</h3>
            <div className="grid-form inner">
              {coinField(
                'goldPrice',
                'Ціна голди',
                <>Скільки монет за 1 голду. <b>Уточни актуальну ціну на твоєму сервері</b> — від неї залежать усі розрахунки.</>,
                true,
              )}
              {coinField('miragePrice', 'Ціна міража', 'Скільки монет за 1 міраж.')}
            </div>
          </div>

          <div className="field-group">
            <h3>Камені заточки (голд / шт)</h3>
            <div className="grid-form inner">
              {stoneField('underPrice', <>Підземний <span className="badge under">+3.5%</span></>, '1 шт = 1 г; 10 шт = 9 г (0.9 / шт).')}
              {stoneField('skyPrice', <>Небесний <span className="badge sky">+15%</span></>, '1 шт = 1 г; 10 шт = 9 г (0.9 / шт).')}
              {stoneField('worldPrice', <>Світобудови <span className="badge world">без падіння</span></>, '10 шт = 4.5 г (0.45); 100 шт = 44 г (0.44).')}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" id="resetSettings" onClick={resetSettings}>Скинути до дефолтів</button>
          </div>
        </form>
      </div>
    </>
  );
}
