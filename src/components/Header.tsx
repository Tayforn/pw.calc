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
            <svg viewBox="0 0 44 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="lgGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff0b8" />
                  <stop offset="0.45" stopColor="#e3b95e" />
                  <stop offset="1" stopColor="#a9742a" />
                </linearGradient>
                <radialGradient id="lgGlow" cx="0.5" cy="0.52" r="0.5">
                  <stop offset="0" stopColor="#ffd86b" stopOpacity="0.6" />
                  <stop offset="1" stopColor="#ffd86b" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="22" cy="27" r="23" fill="url(#lgGlow)" />
              <path d="M13 16 L13 10 L17 13 L22 7 L27 13 L31 10 L31 16 Z" fill="url(#lgGold)" stroke="#7a5212" strokeWidth="0.7" strokeLinejoin="round" />
              <circle cx="22" cy="6.4" r="1.5" fill="#fff4cf" />
              <circle cx="13" cy="9.4" r="1.05" fill="#fff4cf" />
              <circle cx="31" cy="9.4" r="1.05" fill="#fff4cf" />
              <path d="M11 16 Q11 14.2 12.8 14.2 H31.2 Q33 14.2 33 16 V27 C33 35 22 42 22 42 C22 42 11 35 11 27 Z" fill="url(#lgGold)" stroke="#7a5212" strokeWidth="1" strokeLinejoin="round" />
              <path d="M13 16.4 H31 V26.8 C31 32.6 22 38.8 22 38.8 C22 38.8 13 32.6 13 26.8 Z" fill="none" stroke="#fff3c8" strokeOpacity="0.55" strokeWidth="0.7" />
              <path d="M13 16.4 H31 V20.4 C25 22.2 19 22.2 13 20.4 Z" fill="#ffffff" opacity="0.22" />
              <text x="22" y="30" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11.5" fontWeight="800" fill="#3a2a10" letterSpacing="0.2">PW</text>
            </svg>
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
