// =========================================================
// ТАБИ
// =========================================================

import { $$ } from '../utils/dom';
import { escHtml } from '../utils/format';

interface TabDef {
  id: string;
  label: string;
  ico: string;
}
interface TabGroup {
  tabs: TabDef[];
}

const VALID_TABS = [
  'refine', 'eggs', 'compare', 'craft', 'simulator', 'chests',
  'defense', 'r8', 'r8sim', 'gsn', 'guides', 'rb', 'settings',
];

const TAB_GROUPS: Record<string, TabGroup> = {
  refine: {
    tabs: [
      { id: 'refine', label: 'Калькулятор', ico: '⚒' },
      { id: 'simulator', label: 'Симулятор', ico: '◈' },
    ],
  },
  shards: {
    tabs: [
      { id: 'eggs', label: 'Вартість яєць', ico: '◎' },
      { id: 'compare', label: 'Порівняння', ico: '⇌' },
      { id: 'craft', label: 'Крафт шарів', ico: '✦' },
    ],
  },
  gear: {
    tabs: [
      { id: 'r8', label: 'Р8 бонуси', ico: '🏆' },
      { id: 'r8sim', label: 'Симулятор Р8', ico: '⚙' },
      { id: 'gsn', label: 'ГСН', ico: '📿' },
    ],
  },
};

// panel-id → group-key (undefined for standalone tabs)
const PANEL_GROUP: Record<string, string> = {};
for (const [g, gv] of Object.entries(TAB_GROUPS)) {
  for (const t of gv.tabs) PANEL_GROUP[t.id] = g;
}

let onRbActivateCb: () => void = () => {};

export function setTab(name: string): void {
  if (!VALID_TABS.includes(name)) name = 'refine';
  const activeGroup = PANEL_GROUP[name];

  // Primary nav tabs
  $$<HTMLElement>('.nav-primary .tab').forEach((t) => {
    const tGroup = t.dataset.group;
    const on = tGroup ? tGroup === activeGroup : t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });

  // Secondary subtab bar
  const subtabsBar = document.getElementById('subtabsBar') as HTMLElement | null;
  if (subtabsBar) {
    if (activeGroup && TAB_GROUPS[activeGroup]) {
      subtabsBar.innerHTML = TAB_GROUPS[activeGroup].tabs
        .map(
          (t) =>
            `<button class="subtab${t.id === name ? ' active' : ''}" role="tab" data-tab="${escHtml(
              t.id,
            )}" aria-selected="${t.id === name}">` +
            `<span class="subtab-ico">${t.ico}</span><span>${escHtml(t.label)}</span></button>`,
        )
        .join('');
      subtabsBar.hidden = false;
      $$<HTMLElement>('.subtab', subtabsBar).forEach((b) =>
        b.addEventListener('click', () => setTab(b.dataset.tab as string)),
      );
    } else {
      subtabsBar.hidden = true;
      subtabsBar.innerHTML = '';
    }
  }

  // Panels
  $$<HTMLElement>('.tab-panel').forEach((p) =>
    p.classList.toggle('active', p.dataset.panel === name),
  );

  if (
    location.hash !== '#' + name &&
    !location.hash.startsWith('#' + name + '/')
  ) {
    history.replaceState(null, '', '#' + name);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'rb') onRbActivateCb();
}

export function initNavigation(onRbActivate: () => void): void {
  onRbActivateCb = onRbActivate;

  $$<HTMLElement>('.nav-primary .tab').forEach((t) =>
    t.addEventListener('click', () => {
      const group = t.dataset.group;
      if (group && TAB_GROUPS[group]) {
        // if already in this group, don't reset to first sub-tab
        if (PANEL_GROUP[(location.hash || '').replace('#', '')] === group) return;
        setTab(TAB_GROUPS[group].tabs[0].id);
      } else {
        setTab(t.dataset.tab as string);
      }
    }),
  );

  $$<HTMLElement>('[data-goto]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setTab(a.dataset.goto as string);
    }),
  );

  // Початковий таб із хеша.
  const initial = (location.hash || '').replace('#', '').split('/')[0];
  setTab(VALID_TABS.includes(initial) ? initial : 'refine');
}
