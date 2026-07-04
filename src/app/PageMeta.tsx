// =========================================================
// СММ/SEO-мета активної вкладки: title, description, og:*.
// Оновлюємо існуючі теги з index.html (без дублювання у <head>).
// =========================================================

import { useEffect } from 'react';
import { ROUTE_BY_ID } from './routes';

function setMeta(selector: string, content: string): void {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
}

export default function PageMeta({ route }: { route: string }) {
  useEffect(() => {
    const r = ROUTE_BY_ID[route];
    if (!r) return;
    document.title = r.title;
    setMeta('meta[name="description"]', r.description);
    setMeta('meta[property="og:title"]', r.title);
    setMeta('meta[property="og:description"]', r.description);
    setMeta('meta[name="twitter:title"]', r.title);
    setMeta('meta[name="twitter:description"]', r.description);
  }, [route]);
  return null;
}
