// =========================================================
// Другорядний бар вкладок групи (сегмент-контрол під шапкою).
// =========================================================

import { PANEL_GROUP, groupTabs } from '../app/routes';

interface Props {
  route: string;
  onNavigate: (tab: string) => void;
}

export default function SubtabsBar({ route, onNavigate }: Props) {
  const group = PANEL_GROUP[route];
  const tabs = group ? groupTabs(group) : [];
  return (
    <nav className="nav-secondary" id="subtabsBar" role="tablist" aria-label="Підрозділи" hidden={!tabs.length}>
      {tabs.map((t) => (
        <button
          key={t.id}
          className={'subtab' + (t.id === route ? ' active' : '')}
          role="tab"
          aria-selected={t.id === route}
          onClick={() => onNavigate(t.id)}
        >
          <span className="subtab-ico">{t.ico}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
