// =========================================================
// Шапка сайту: тогл меню, лого, партнер, індикатор голди, тема.
// =========================================================

import { routeUrl } from '../app/useRoute';
import { useGoldTouched, useSettings } from '../app/useSettings';
import { fmt } from '../utils/format';

interface Props {
  navOpen: boolean;
  onNavToggle: () => void;
}

function toggleTheme(): void {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('pw-theme', next);
  } catch {
    /* ignore */
  }
}

export default function Header({ navOpen, onNavToggle }: Props) {
  const settings = useSettings();
  const goldTouched = useGoldTouched();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <button
          type="button"
          id="navToggle"
          className="nav-toggle"
          aria-label="Показати або сховати меню"
          aria-expanded={navOpen}
          aria-controls="appSidebar"
          title="Меню"
          onClick={onNavToggle}
        >
          <span className="nav-toggle-bars"></span>
        </button>
        <a href={routeUrl('refine')} data-goto="refine" className="logo">
          <span className="logo-crest" aria-hidden="true">
            <img src={import.meta.env.BASE_URL + 'assets/favicon-180.png'} alt="" width={180} height={180} />
          </span>
          <span className="logo-text">Хелпер</span>
        </a>
        <a href="https://cyberpw.fun/" target="_blank" rel="noopener" className="partner-logo" title="cyberpw.fun">
          <img src={import.meta.env.BASE_URL + 'assets/logo.webp'} alt="CyberPW" />
        </a>
        <div className="header-meta">
          <a
            href={routeUrl('settings')}
            className={'gold-indicator' + (goldTouched ? '' : ' is-default')}
            id="goldIndicator"
            data-goto="settings"
            title="Натисни, щоб уточнити ціну голди в налаштуваннях"
          >
            <span className="gold-indicator-text">1 <span>голда</span> = {fmt(settings.goldPrice)} <span>монет</span></span>
            <span className="gold-default-badge" aria-hidden="true">дефолт</span>
          </a>
        </div>
        <button
          type="button"
          id="themeToggle"
          className="theme-toggle"
          aria-label="Перемкнути тему"
          title="Світла / темна тема"
          onClick={toggleTheme}
        >
          <span className="theme-ico-sun" aria-hidden="true">☀</span>
          <span className="theme-ico-moon" aria-hidden="true">☾</span>
        </button>
      </div>
    </header>
  );
}
