// =========================================================
// Розклад Евентів: планувальник нагадувань.
// Тик кожні 20с + перевірка на visibilitychange/focus (фонові вкладки
// тротляться браузером). Grace-вікно 5 хв — спізнілий тик ще спрацює.
// Працює лише поки вкладка відкрита (статичний сайт, без пушів).
// =========================================================

import { useEffect, useRef } from 'react';
import type { EvtItem, EvtSettings } from './types';
import { addDays, minToHM, occurrencesForDay, occurrenceDate } from './dates';
import { playPreset } from './sound';

const GRACE_MS = 5 * 60_000;

export function useReminders(events: EvtItem[], settings: EvtSettings): void {
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const today = new Date();
      // Завтра — щоб нагадування з випередженням спрацювало й перед північчю.
      for (const day of [today, addDays(today, 1)]) {
        for (const occ of occurrencesForDay(events, day)) {
          if (!occ.evt.remind) continue;
          const at = occurrenceDate(occ).getTime() - occ.evt.leadMin * 60_000;
          if (now < at || now - at >= GRACE_MS) continue;
          const key = occ.evt.id + '|' + occ.dateKey;
          if (fired.current.has(key)) continue;
          fired.current.add(key);
          if (settings.soundOn) playPreset(settings.preset, settings.volume);
          if (settings.useNotifApi && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              const when = occ.evt.leadMin > 0 ? `Починається о ${minToHM(occ.startMin)}` : 'Вже починається!';
              new Notification(`${occ.evt.emoji} ${occ.evt.title}`.trim(), { body: when });
            } catch {
              /* ignore */
            }
          }
        }
      }
    };
    tick();
    const iv = setInterval(tick, 20_000);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [events, settings]);
}
