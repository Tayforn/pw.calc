// =========================================================
// Роути застосунку. Джерело правди — routes.meta.json (його ж читає
// scripts/prerender.mjs, генеруючи per-route HTML з OG-метою).
// =========================================================

import META from './routes.meta.json';

export interface RouteDef {
  id: string;
  label: string; // підпис у subtabs-барі
  ico: string; // емодзі-іконка subtabs-бара
  group?: string; // група в сайдбарі (ключ NAV_GROUPS); без групи — самостійна вкладка
  title: string; // <title> сторінки
  description: string; // meta description / og:description
  keywords?: string; // meta keywords (рос. терміни — пошук по запитах російською)
}

/** Групи сайдбара (порядок = порядок у меню). */
export const NAV_GROUPS: Record<string, { label: string }> = {
  refine: { label: 'Заточка' },
  shards: { label: 'Шари' },
  gear: { label: 'Спорядження' },
  skillbase: { label: 'Уміння' },
};

export const ROUTES: RouteDef[] = META as RouteDef[];

export const ROUTE_BY_ID: Record<string, RouteDef> = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
export const VALID_TABS = ROUTES.map((r) => r.id);
export const DEFAULT_TAB = 'refine';

/** panel-id → ключ групи (для активної кнопки сайдбара). */
export const PANEL_GROUP: Record<string, string> = Object.fromEntries(
  ROUTES.filter((r) => r.group).map((r) => [r.id, r.group as string]),
);

/** Вкладки групи (для subtabs-бара). */
export function groupTabs(group: string): RouteDef[] {
  return ROUTES.filter((r) => r.group === group);
}
