// =========================================================
// Хуки-містки до legacy-налаштувань (фаза 3): React-сторінки
// ре-рендеряться на зміну налаштувань і спільної «ціни яйця».
// =========================================================

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSettings, isGoldPriceTouched, settingsVersion, subscribeSettings } from '../settings';
import type { Settings } from '../types';

/** Налаштування з підпискою: компонент ре-рендериться при зміні. */
export function useSettings(): Settings {
  useSyncExternalStore(subscribeSettings, settingsVersion);
  return getSettings();
}

/** Чи змінював користувач ціну голди (для індикатора «дефолт»/крапки-нагадування). */
export function useGoldTouched(): boolean {
  useSyncExternalStore(subscribeSettings, settingsVersion);
  return isGoldPriceTouched();
}

/** Лічильник змін спільних полів «ціна яйця» (.egg-price-input синхронізуються
 *  legacy-модулем settings/eggPrice; тут — лише сигнал для ре-рендера). */
export function useEggPriceTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onInput = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && (t as HTMLInputElement).classList?.contains('egg-price-input')) setTick((v) => v + 1);
    };
    document.addEventListener('input', onInput);
    return () => document.removeEventListener('input', onInput);
  }, []);
  return tick;
}
