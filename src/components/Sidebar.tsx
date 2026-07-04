// =========================================================
// Сайдбар: головні розділи. Кнопка групи веде на першу (або поточну)
// вкладку групи; самостійні кнопки — прямо на вкладку.
// =========================================================

import type { ReactNode } from 'react';
import { PANEL_GROUP, groupTabs } from '../app/routes';

interface NavEntry {
  tab: string; // вкладка при кліку (для груп — перша в групі)
  group?: string; // ключ групи (активність = поточна вкладка в групі)
  label: string;
  ico: ReactNode;
  settings?: boolean;
}

const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const NAV: NavEntry[] = [
  {
    tab: 'refine', group: 'refine', label: 'Заточка',
    ico: <svg {...S}><path d="M13.5 3.5 20.5 10.5 18 13l-7-7z" /><path d="M11.5 5.5 4 13a2.8 2.8 0 0 0 4 4l7.5-7.5" /></svg>,
  },
  {
    tab: 'eggs', group: 'shards', label: 'Шари',
    ico: <svg {...S}><path d="M12 2 3 9l9 13 9-13z" /><path d="M3 9h18" /><path d="m9 9 3 13 3-13" /></svg>,
  },
  {
    tab: 'r8', group: 'gear', label: 'Спорядження',
    ico: <svg {...S}><path d="M12 3 5 6v5c0 4.8 3 7.8 7 9.8 4-2 7-5 7-9.8V6z" /></svg>,
  },
  {
    tab: 'skills', group: 'skillbase', label: 'Уміння',
    ico: <svg {...S}><path d="m12 2.5 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 8.8l6.1-.7z" /></svg>,
  },
  {
    tab: 'chests', label: 'Скрині',
    ico: <svg {...S}><rect x="3.5" y="8.5" width="17" height="11" rx="1.5" /><path d="M3.5 8.5 5.5 5h13l2 3.5" /><path d="M3.5 13h17" /><path d="M11 13v2h2v-2" /></svg>,
  },
  {
    tab: 'defense', label: 'Бій',
    ico: <svg {...S}><path d="M4 4 14 14" /><path d="m14.5 14.5 2.5 2.5 1 3-3-1-2.5-2.5" /><path d="M20 4 10 14" /><path d="m9.5 14.5-2.5 2.5-1 3 3-1 2.5-2.5" /></svg>,
  },
  {
    tab: 'rb', label: 'РБ',
    ico: <svg {...S}><path d="M12 3a8 8 0 0 0-8 8c0 2.4 1 4 2.5 5v2A1.5 1.5 0 0 0 8 19.5h8a1.5 1.5 0 0 0 1.5-1.5v-2c1.5-1 2.5-2.6 2.5-5a8 8 0 0 0-8-8z" /><circle cx="9" cy="11.5" r="1.3" /><circle cx="15" cy="11.5" r="1.3" /></svg>,
  },
  {
    tab: 'guides', label: 'Гайди',
    ico: <svg {...S}><path d="M12 5.5C10 4 6.5 4 4 4.5v14c2.5-.5 6-.5 8 1 2-1.5 5.5-1.5 8-1v-14c-2.5-.5-6-.5-8 1z" /><path d="M12 5.5v15" /></svg>,
  },
  {
    tab: 'settings', label: 'Налаштування', settings: true,
    ico: <svg {...S}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>,
  },
];

interface Props {
  route: string;
  onNavigate: (tab: string) => void;
}

export default function Sidebar({ route, onNavigate }: Props) {
  const activeGroup = PANEL_GROUP[route];
  return (
    <aside className="sidebar" id="appSidebar">
      <nav className="nav-primary" role="tablist" aria-label="Розділи">
        {NAV.map((n) => {
          const active = n.group ? n.group === activeGroup : n.tab === route;
          const go = () => {
            // Клік по групі, коли вже в ній — не скидаємо на першу вкладку.
            if (n.group && n.group === activeGroup) return;
            onNavigate(n.group ? groupTabs(n.group)[0].id : n.tab);
          };
          return (
            <button
              key={n.tab}
              className={'tab' + (n.settings ? ' tab-settings' : '') + (active ? ' active' : '')}
              role="tab"
              aria-selected={active}
              title={n.settings ? n.label : undefined}
              aria-label={n.settings ? n.label : undefined}
              onClick={go}
            >
              <span className="tab-ico">{n.ico}</span>
              <span className={n.settings ? 'tab-settings-label' : undefined}>{n.label}</span>
              {n.settings && (
                <span className="tab-attention" aria-hidden="true">
                  <span className="tab-attention-dot"></span>
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
