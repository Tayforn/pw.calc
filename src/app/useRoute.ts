// =========================================================
// History-роутинг із нормальними шляхами: /refine, /doll, …
// Працює і з підпапки (GitHub Pages /pw.calc/): база визначається
// з import.meta.env.BASE_URL. Старі хеш-посилання (#doll) редиректяться.
// =========================================================

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TAB, VALID_TABS } from './routes';

/** База застосунку зі слешем в кінці: '/', '/pw.calc/'. */
export const APP_BASE: string = (() => {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : b + '/';
})();

/** Шлях вкладки: '/pw.calc/doll' → 'doll'; корінь/невідоме → DEFAULT_TAB. */
function parsePath(): string {
  let p = location.pathname;
  if (p.startsWith(APP_BASE)) p = p.slice(APP_BASE.length);
  const name = p.replace(/^\/+|\/+$/g, '').split('/')[0].replace(/\.html$/, '');
  return VALID_TABS.includes(name) ? name : DEFAULT_TAB;
}

/** URL вкладки для history/посилань. */
export function routeUrl(name: string): string {
  return APP_BASE + name;
}

/** Активна вкладка + перехід (pushState; back/forward через popstate). */
export function useRoute(): [string, (name: string) => void] {
  const [route, setRouteState] = useState<string>(parsePath);

  useEffect(() => {
    // Редирект зі старих хеш-посилань: /#doll → /doll (разово, без запису в історію).
    const legacy = (location.hash || '').replace('#', '').split('/')[0];
    if (VALID_TABS.includes(legacy)) {
      history.replaceState(null, '', routeUrl(legacy));
      setRouteState(legacy);
    } else if (location.pathname === APP_BASE || location.pathname === APP_BASE.slice(0, -1)) {
      // Корінь → канонічний шлях дефолтної вкладки.
      history.replaceState(null, '', routeUrl(DEFAULT_TAB));
    }
    const onPop = () => setRouteState(parsePath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setRoute = useCallback((name: string) => {
    if (!VALID_TABS.includes(name)) name = DEFAULT_TAB;
    if (parsePath() !== name) history.pushState(null, '', routeUrl(name));
    setRouteState(name);
  }, []);

  return [route, setRoute];
}
