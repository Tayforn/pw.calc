// =========================================================
// Каркас застосунку: шапка, сайдбар-drawer, subtabs, 18 панелей.
// Панелі змонтовані ПОСТІЙНО (активна — класом), як у legacy-версії:
// модулі калькуляторів тримають слухачі на елементах усередині.
// =========================================================

import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { ROUTES } from '../app/routes';
import { useRoute } from '../app/useRoute';
import PageMeta from '../app/PageMeta';
import { rbActivate, atnActivate } from '../app/legacyInit';
import Header from './Header';
import Sidebar from './Sidebar';
import SubtabsBar from './SubtabsBar';
import Footer from './Footer';
import GlobalModals from './GlobalModals';

import RefinePage from '../pages/RefinePage';
import SimulatorPage from '../pages/SimulatorPage';
import EggsPage from '../pages/EggsPage';
import ComparePage from '../pages/ComparePage';
import CraftPage from '../pages/CraftPage';
import ChestsPage from '../pages/ChestsPage';
import DefensePage from '../pages/DefensePage';
import R8Page from '../pages/R8Page';
import R8simPage from '../pages/R8simPage';
import GsnPage from '../pages/GsnPage';
import AbilitiesPage from '../pages/AbilitiesPage';
import DollPage from '../pages/DollPage';
import SkillsPage from '../pages/SkillsPage';
import GeniePage from '../pages/GeniePage';
import PetsPage from '../pages/PetsPage';
import RbPage from '../pages/RbPage';
import AtnPage from '../pages/AtnPage';
import GuidesPage from '../pages/GuidesPage';
import SettingsPage from '../pages/SettingsPage';

const PAGES: Record<string, ReactNode> = {
  refine: <RefinePage />,
  simulator: <SimulatorPage />,
  eggs: <EggsPage />,
  compare: <ComparePage />,
  craft: <CraftPage />,
  chests: <ChestsPage />,
  defense: <DefensePage />,
  r8: <R8Page />,
  r8sim: <R8simPage />,
  gsn: <GsnPage />,
  abilities: <AbilitiesPage />,
  doll: <DollPage />,
  skills: <SkillsPage />,
  genie: <GeniePage />,
  pets: <PetsPage />,
  rb: <RbPage />,
  atn: <AtnPage />,
  guides: <GuidesPage />,
  settings: <SettingsPage />,
};

/** Панель вкладки: статичний вміст, що ніколи не ре-рендериться (DOM мутують legacy-модулі). */
const Panel = memo(function Panel({ id, active }: { id: string; active: boolean }) {
  return (
    <section className={'tab-panel' + (active ? ' active' : '')} data-panel={id} role="tabpanel">
      {PAGES[id]}
    </section>
  );
});

const isMobile = () => window.matchMedia('(max-width: 880px)').matches;

export default function Layout() {
  const [route, setRoute] = useRoute();
  // Джерело правди для стану меню — клас на <html> (його виставляє FOUC-скрипт у <head>).
  const [navOpen, setNavOpen] = useState(() => document.documentElement.classList.contains('nav-open'));

  const setOpen = useCallback((on: boolean) => {
    document.documentElement.classList.toggle('nav-open', on);
    setNavOpen(on);
  }, []);

  const navigate = useCallback(
    (tab: string) => {
      setRoute(tab);
      if (isMobile()) setOpen(false); // вибір розділу закриває drawer
    },
    [setRoute, setOpen],
  );

  // Активація вкладок з побічними ефектами + скрол нагору (як у legacy setTab).
  // rb/atn — легасі-панелі на Leaflet, їх треба «розбудити» при показі.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (route === 'rb') rbActivate();
    if (route === 'atn') atnActivate();
  }, [route]);

  // Esc закриває drawer на мобільному; глобальні [data-goto]-посилання ведуть на вкладку.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobile() && document.documentElement.classList.contains('nav-open')) setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-goto]');
      if (a?.dataset.goto) {
        e.preventDefault();
        navigate(a.dataset.goto);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [setOpen, navigate]);

  return (
    <>
      <div className="bg-glow" aria-hidden="true">
        <span className="blob blob-a"></span>
        <span className="blob blob-b"></span>
        <span className="blob blob-c"></span>
      </div>
      <PageMeta route={route} />
      <Header navOpen={navOpen} onNavToggle={() => setOpen(!document.documentElement.classList.contains('nav-open'))} />
      <div
        className="nav-backdrop"
        id="navBackdrop"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      ></div>
      <div className="app-shell container">
        <Sidebar route={route} onNavigate={navigate} />
        <div className="content">
          {/* окремий контейнер лише навколо шапки — щоб container-query не
              робив .content containing-block для fixed-модалок ляльки */}
          <div className="content-hd">
            <div className="content-header">
              <SubtabsBar route={route} onNavigate={navigate} />
            </div>
          </div>
          <main>
            {ROUTES.map((r) => (
              <Panel key={r.id} id={r.id} active={r.id === route} />
            ))}
          </main>
        </div>
      </div>
      <Footer />
      <GlobalModals />
    </>
  );
}
