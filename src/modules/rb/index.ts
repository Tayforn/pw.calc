// =========================================================
// РБ — карта рейдових босів (тайли worldmap.pw + власні мітки)
// =========================================================

import { $$ } from '../../utils/dom';
import { escHtml } from '../../utils/format';
import { createPwWorldLayer, worldMaxBounds } from '../pwmap/layers';

// Розширюємо об'єкти босів runtime-полями (мітка, latlng тощо).
interface WorldBoss {
  nick: string;
  name: string;
  x: number;
  y: number;
  _ll?: any;
  _marker?: any;
  _coordStr?: string;
  sub?: string;
  tier?: number;
}
interface ChronoBoss {
  name: string;
  tier: number;
  x: number;
  z: number;
  sub?: string;
  _ll?: any;
  _marker?: any;
  _coordStr?: string;
  nick?: string;
}
type Boss = WorldBoss | ChronoBoss;
type Kind = 'world' | 'chrono';

const WORLD_BOSSES: WorldBoss[] = [
  { nick: 'Сніги', name: 'Дух селища', x: 159, y: 975 },
  { nick: 'Загадка', name: 'Загадка', x: 314, y: 955 },
  { nick: 'Жестянка', name: 'Енгерранд', x: 235, y: 867 },
  { nick: 'Огірок', name: 'Примарний вершник', x: 171, y: 787 },
  { nick: '24', name: 'Шилонос', x: 251, y: 754 },
  { nick: 'ГМ', name: 'Крилатий воїн', x: 439, y: 752 },
  { nick: 'ПУО', name: 'Сталевий меч демона', x: 487, y: 570 },
  { nick: 'Шабля', name: 'Шабля демона', x: 438, y: 471 },
  { nick: 'Обеан', name: 'Обеан', x: 553, y: 437 },
  { nick: 'Порт 1', name: 'Златий король', x: 652, y: 389 },
  { nick: 'Порт 2', name: 'Мисливець за душами', x: 657, y: 434 },
  { nick: 'Шляпа', name: 'Тінь померлого', x: 659, y: 523 },
  { nick: 'Альфа', name: 'Альфа', x: 162, y: 427 },
  { nick: 'НД', name: 'Аптійський щит', x: 151, y: 339 },
  { nick: 'Сколопендра', name: 'Сколопендра вбивця', x: 639, y: 868 },
  { nick: 'Око', name: 'Око', x: 288, y: 963 },
];
const CHRONO_BOSSES: ChronoBoss[] = [
  { name: 'Потрошитель', tier: 1, x: 366.63, z: 472.18 },
  { name: 'Майстер-воїн з сокирою', tier: 1, x: 345.24, z: 457.87 },
  { name: 'Звір грому', tier: 2, x: 333.83, z: 596.81 },
  { name: 'Обпалений король скелетів', tier: 2, x: 364.58, z: 610.76 },
  { name: 'Воїн Гаї', tier: 3, x: 477.29, z: 623.43 },
  { name: 'Отруєний король скелетів', tier: 3, x: 421.51, z: 570.45 },
  { name: 'Пекельний гончак', tier: 4, x: 462.73, z: 519.77 },
  { name: 'Страж морозу', tier: 4, x: 477.17, z: 475.73 },
];
CHRONO_BOSSES.forEach((b) => (b.sub = 'Хроно ' + b.tier));

// Підписи тірів по квадрантах хроно-карти (latlng у CRS.Simple, 0..1024).
// Розташовані в порожніх кутах, щоб не затуляти мітки босів.
const CHRONO_REGIONS: { tier: number; lat: number; lng: number }[] = [
  { tier: 1, lat: 115, lng: 100 }, // низ-ліво
  { tier: 2, lat: 590, lng: 95 },  // верх-ліво
  { tier: 3, lat: 610, lng: 925 }, // верх-право
  { tier: 4, lat: 120, lng: 605 }, // низ-право
];

// Перетворення координат гри PW -> карта worldmap.pw.
function pwToLatLng(x: number, y: number): any {
  return L.CRS.EPSG3857.unproject(L.point(x, y));
}

// --- Чеклист «кого вже вбив» ---
const RB_SPAWNS = [
  { day: 2, hour: 20, min: 0 }, // вівторок 20:00
  { day: 4, hour: 21, min: 0 }, // четвер  21:00
];
const RB_LS_KEY = 'pwcalc.rbKills';

function rbCurrentCycle(): number {
  const now = new Date();
  let best = 0;
  for (let back = 0; back < 8; back++) {
    const d = new Date(now);
    d.setDate(d.getDate() - back);
    for (const s of RB_SPAWNS) {
      if (d.getDay() !== s.day) continue;
      const cand = new Date(d);
      cand.setHours(s.hour, s.min, 0, 0);
      const t = cand.getTime();
      if (t <= now.getTime() && t > best) best = t;
    }
  }
  return best;
}

const rbKills: Record<Kind, Set<string>> = { world: new Set(), chrono: new Set() };
let rbKillCycle = 0;

function rbLoadKills(): void {
  rbKillCycle = rbCurrentCycle();
  let saved: any = null;
  try {
    saved = JSON.parse(localStorage.getItem(RB_LS_KEY) || 'null');
  } catch (_) {
    /* ignore */
  }
  if (saved && saved.cycle === rbKillCycle) {
    rbKills.world = new Set<string>(Array.isArray(saved.world) ? saved.world : []);
    rbKills.chrono = new Set<string>(Array.isArray(saved.chrono) ? saved.chrono : []);
  } else {
    rbKills.world.clear();
    rbKills.chrono.clear();
    rbSaveKills();
  }
}

function rbSaveKills(): void {
  try {
    localStorage.setItem(
      RB_LS_KEY,
      JSON.stringify({
        cycle: rbKillCycle,
        world: [...rbKills.world],
        chrono: [...rbKills.chrono],
      }),
    );
  } catch (_) {
    /* ignore */
  }
}

// --- Кастомні назви босів (перейменування, зберігається вічно в localStorage) ---
const RB_NAMES_LS_KEY = 'pwcalc.rbNames';
const rbNames: Record<Kind, Record<number, string>> = { world: {}, chrono: {} };

function rbLoadNames(): void {
  let saved: any = null;
  try {
    saved = JSON.parse(localStorage.getItem(RB_NAMES_LS_KEY) || 'null');
  } catch (_) {
    /* ignore */
  }
  rbNames.world = saved && saved.world && typeof saved.world === 'object' ? saved.world : {};
  rbNames.chrono = saved && saved.chrono && typeof saved.chrono === 'object' ? saved.chrono : {};
}

function rbSaveNames(): void {
  try {
    localStorage.setItem(RB_NAMES_LS_KEY, JSON.stringify(rbNames));
  } catch (_) {
    /* ignore */
  }
}

const rbDefaultLabel = (b: Boss): string => b.nick || b.name;

function rbDisplayName(kind: Kind, idx: number, b: Boss): string {
  const custom = rbNames[kind][idx];
  return custom && custom.trim() ? custom.trim() : rbDefaultLabel(b);
}

function rbBuildPopup(kind: Kind, idx: number, b: Boss): string {
  const label = rbDisplayName(kind, idx, b);
  const defaultLabel = rbDefaultLabel(b);
  const extra =
    label !== defaultLabel
      ? defaultLabel
      : b.nick && b.nick !== b.name
        ? b.nick
        : '';
  return (
    '<div class="rb-pop">' +
    (b.sub ? '<span class="rb-pop-sub t' + b.tier + '">' + escHtml(b.sub) + '</span>' : '') +
    '<b>' + escHtml(label) + '</b>' +
    (extra ? ' <span class="rb-pop-nick">(' + escHtml(extra) + ')</span>' : '') +
    '<br><span class="coord" data-coord="' + b._coordStr + '" title="Натисни, щоб скопіювати">' + b._coordStr + '</span>' +
    '</div>'
  );
}

// Оновлює назву боса в DOM (чип у списку, мітка й попап на карті) без перебудови карти.
function rbApplyName(kind: Kind, idx: number): void {
  const bosses: Boss[] = kind === 'world' ? WORLD_BOSSES : CHRONO_BOSSES;
  const b = bosses[idx];
  if (!b) return;
  const label = rbDisplayName(kind, idx, b);

  const listEl = document.getElementById(kind === 'world' ? 'rbListWorld' : 'rbListChrono');
  const nameEl = listEl?.querySelector('.rb-chip[data-rb="' + idx + '"] .rb-chip-name');
  if (nameEl) nameEl.textContent = label;

  if (b._marker) {
    const iconEl = (b._marker as any)._icon as HTMLElement | undefined;
    const lblEl = iconEl?.querySelector('.rb-lbl');
    if (lblEl) lblEl.textContent = label;
    b._marker.setPopupContent(rbBuildPopup(kind, idx, b));
  }
}

// --- Модалка перейменування (замінює нативний window.prompt, стилізована під тему сайту) ---
interface RbRenameEls {
  overlay: HTMLElement;
  input: HTMLInputElement;
  title: HTMLElement;
}
let rbRenameEls: RbRenameEls | null = null;
let rbRenameCtx: { kind: Kind; idx: number; b: Boss } | null = null;

function rbCloseRenameModal(): void {
  if (!rbRenameEls || !rbRenameCtx) return;
  rbRenameEls.overlay.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  rbRenameCtx = null;
}

function rbCommitRename(): void {
  if (!rbRenameEls || !rbRenameCtx) return;
  const { kind, idx, b } = rbRenameCtx;
  const trimmed = rbRenameEls.input.value.trim();
  if (trimmed && trimmed !== rbDefaultLabel(b)) rbNames[kind][idx] = trimmed;
  else delete rbNames[kind][idx];
  rbSaveNames();
  rbApplyName(kind, idx);
  rbCloseRenameModal();
}

function rbResetRename(): void {
  if (!rbRenameCtx) return;
  const { kind, idx } = rbRenameCtx;
  delete rbNames[kind][idx];
  rbSaveNames();
  rbApplyName(kind, idx);
  rbCloseRenameModal();
}

function rbEnsureRenameModal(): RbRenameEls {
  if (rbRenameEls) return rbRenameEls;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay rb-rename-overlay';
  overlay.id = 'rbRenameModal';
  overlay.setAttribute('hidden', '');
  overlay.innerHTML =
    '<div class="modal rb-rename-modal" role="dialog" aria-modal="true" aria-labelledby="rbRenameTitle">' +
    '<div class="modal-head">' +
    '<h3 id="rbRenameTitle">Перейменувати боса</h3>' +
    '<button type="button" class="modal-close" data-act="close" aria-label="Закрити">✕</button>' +
    '</div>' +
    '<div class="modal-body">' +
    '<div class="field">' +
    '<label for="rbRenameInput">Назва на мітці й у списку</label>' +
    '<input type="text" id="rbRenameInput" maxlength="40" autocomplete="off" spellcheck="false">' +
    '</div>' +
    '</div>' +
    '<div class="modal-foot">' +
    '<button type="button" class="btn btn-ghost" data-act="reset">↺ Типова назва</button>' +
    '<button type="button" class="btn btn-ghost" data-act="close">Скасувати</button>' +
    '<button type="button" class="btn btn-primary" data-act="save">Зберегти</button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#rbRenameInput') as HTMLInputElement;
  const title = overlay.querySelector('#rbRenameTitle') as HTMLElement;

  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === overlay || t.closest('[data-act="close"]')) rbCloseRenameModal();
    else if (t.closest('[data-act="save"]')) rbCommitRename();
    else if (t.closest('[data-act="reset"]')) rbResetRename();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      rbCommitRename();
    }
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    rbCloseRenameModal();
  });

  rbRenameEls = { overlay, input, title };
  return rbRenameEls;
}

function rbOpenRenameModal(kind: Kind, idx: number, b: Boss): void {
  const els = rbEnsureRenameModal();
  rbRenameCtx = { kind, idx, b };
  const defaultLabel = rbDefaultLabel(b);
  els.title.textContent = 'Перейменувати «' + defaultLabel + '»';
  els.input.value = rbDisplayName(kind, idx, b);
  els.input.placeholder = defaultLabel;
  els.overlay.removeAttribute('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    els.input.focus();
    els.input.select();
  });
}

const rbBossKey = (kind: Kind, b: Boss): string =>
  kind === 'world' ? (b as WorldBoss).nick : b.name;
const rbIsKilled = (kind: Kind, b: Boss): boolean => rbKills[kind].has(rbBossKey(kind, b));
function rbSetKilled(kind: Kind, b: Boss, killed: boolean): void {
  const key = rbBossKey(kind, b);
  if (killed) rbKills[kind].add(key);
  else rbKills[kind].delete(key);
  rbSaveKills();
}

function rbUpdateKillUI(kind: Kind): void {
  const bosses: Boss[] = kind === 'world' ? WORLD_BOSSES : CHRONO_BOSSES;
  const listEl = document.getElementById(kind === 'world' ? 'rbListWorld' : 'rbListChrono');
  let killed = 0;
  bosses.forEach((b, i) => {
    const on = rbIsKilled(kind, b);
    if (on) killed++;
    if (listEl) {
      const chip = listEl.querySelector('.rb-chip[data-rb="' + i + '"]');
      if (chip) {
        chip.classList.toggle('killed', on);
        const kb = chip.querySelector('.rb-chip-kill');
        if (kb) kb.setAttribute('aria-pressed', String(on));
      }
    }
    if (b._marker && b._marker._icon) b._marker._icon.classList.toggle('killed', on);
  });
  const countEl = document.getElementById(kind === 'world' ? 'rbKillCountWorld' : 'rbKillCountChrono');
  if (countEl) countEl.textContent = 'Вбито: ' + killed + ' / ' + bosses.length;
}

const rbMaps: Partial<Record<Kind, any>> = {};
let rbSub: Kind = 'world';
let rbWired = false;
const rbListToggleBtns: HTMLElement[] = [];

function rbSyncListToggleBtn(btn: HTMLElement): void {
  const hidden = document.body.classList.contains('rb-list-hidden');
  btn.classList.toggle('is-off', hidden);
  btn.title = hidden ? 'Показати список босів' : 'Сховати список босів';
  btn.setAttribute('aria-label', btn.title);
}

function toggleRbList(): void {
  document.body.classList.toggle('rb-list-hidden');
  rbListToggleBtns.forEach(rbSyncListToggleBtn);
}

const RB_ZOOM = {
  world: { windowed: { min: 18, max: 21 }, fullscreen: { min: 18, max: 21 } },
  chrono: { windowed: { min: 0, max: 2 }, fullscreen: { min: 0, max: 2 } },
};

const CH_SIZE = 1024;
function chronoToLatLng(x: number, z: number): [number, number] {
  const px = 4.82 * x - 1424.06;
  const py = 3173.18 - 4.82 * z;
  return [CH_SIZE - py, px];
}

// Розширений тип для reset-кнопки (прапорець «вже підписано»).
type ResetBtn = HTMLElement & { _wired?: boolean };

function buildRbMap(kind: Kind): any {
  const el = document.getElementById(kind === 'world' ? 'rbMapWorld' : 'rbMapChrono');
  const listEl = document.getElementById(kind === 'world' ? 'rbListWorld' : 'rbListChrono');
  if (!el) return null;

  const z0 = RB_ZOOM[kind].windowed;
  let map: any;
  let fit: (animate?: boolean) => void;
  let flyZoom: number;
  if (kind === 'world') {
    map = L.map(el, { minZoom: z0.min, maxZoom: z0.max, zoomSnap: 0.5, zoomControl: true });
    // Карта світу з клієнта гри (локальні тайли, спільний шар з АТН).
    createPwWorldLayer().addTo(map);
    flyZoom = 18;
  } else {
    map = L.map(el, {
      crs: L.CRS.Simple,
      minZoom: z0.min,
      maxZoom: z0.max,
      zoomSnap: 0.25,
      zoomControl: true,
      attributionControl: false,
    });
    const bounds = [
      [0, 0],
      [CH_SIZE, CH_SIZE],
    ];
    // base-relative — працює і з кореня (Firebase), і з підпапки (GitHub Pages)
    L.imageOverlay(import.meta.env.BASE_URL + 'assets/maps/chrono.webp', bounds).addTo(map);
    map.setMaxBounds(L.latLngBounds(bounds).pad(0.5));
    flyZoom = 1;
  }

  const bosses: Boss[] = kind === 'world' ? WORLD_BOSSES : CHRONO_BOSSES;
  const lls: any[] = [];
  let listHtml = '';
  bosses.forEach((b, i) => {
    const ll =
      kind === 'world'
        ? pwToLatLng((b as WorldBoss).x, (b as WorldBoss).y)
        : chronoToLatLng((b as ChronoBoss).x, (b as ChronoBoss).z);
    b._ll = ll;
    lls.push(ll);
    b._coordStr =
      kind === 'world'
        ? (b as WorldBoss).x + ' ' + (b as WorldBoss).y
        : Math.round((b as ChronoBoss).x) + ' ' + Math.round((b as ChronoBoss).z);
    const label = rbDisplayName(kind, i, b);
    const icon = L.divIcon({
      className: 'rb-marker' + (b.tier ? ' t' + b.tier : ''),
      html: '<span class="rb-pin"></span><span class="rb-lbl">' + escHtml(label) + '</span>',
      iconSize: null,
      iconAnchor: [8, 8],
    });
    b._marker = L.marker(ll, { icon }).addTo(map).bindPopup(rbBuildPopup(kind, i, b));
    listHtml +=
      '<span class="rb-chip' + (b.tier ? ' t' + b.tier : '') + '" data-rb="' + i + '">' +
      '<button type="button" class="rb-chip-go" title="Показати на карті">' +
      (b.tier ? '<span class="rb-chip-tier">' + b.tier + '</span>' : '') +
      '<span class="rb-chip-name">' + escHtml(label) + '</span>' +
      '</button>' +
      '<button type="button" class="rb-chip-edit" title="Перейменувати боса">✎</button>' +
      '<button type="button" class="rb-chip-kill" title="Позначити вбитим / живим" aria-pressed="false">✓</button>' +
      '</span>';
  });

  if (kind === 'world') {
    map.setMaxBounds(worldMaxBounds());
  }

  if (kind === 'chrono') {
    CHRONO_REGIONS.forEach((r) => {
      const icon = L.divIcon({
        className: 'rb-region t' + r.tier,
        html: String(r.tier),
        iconSize: null,
        iconAnchor: [22, 36],
      });
      L.marker([r.lat, r.lng], {
        icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: -1000,
      }).addTo(map);
    });
  }

  fit = (animate?: boolean): void => {
    if (kind === 'world') {
      if (lls.length) map.fitBounds(L.latLngBounds(lls).pad(0.18), { animate: !!animate });
    } else {
      map.fitBounds(
        [
          [0, 0],
          [CH_SIZE, CH_SIZE],
        ],
        { animate: !!animate },
      );
    }
  };

  const FsCtrl = L.Control.extend({
    options: { position: 'topright' },
    onAdd(): any {
      const wrap = L.DomUtil.create('div', 'leaflet-bar rb-fs');
      const btn = L.DomUtil.create('a', '', wrap);
      btn.href = '#';
      btn.role = 'button';
      btn.title = 'На весь екран (Esc — закрити)';
      btn.setAttribute('aria-label', 'На весь екран');
      btn.innerHTML = '⛶';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(btn, 'click', (e: any) => {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stop(e);
        toggleRbFullscreen(kind);
      });
      return wrap;
    },
  });
  new FsCtrl().addTo(map);

  const ListCtrl = L.Control.extend({
    options: { position: 'topright' },
    onAdd(): any {
      const wrap = L.DomUtil.create('div', 'leaflet-bar rb-list-toggle');
      const btn = L.DomUtil.create('a', '', wrap);
      btn.href = '#';
      btn.role = 'button';
      btn.innerHTML = '📋';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(btn, 'click', (e: any) => {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stop(e);
        toggleRbList();
      });
      rbListToggleBtns.push(btn);
      rbSyncListToggleBtn(btn);
      return wrap;
    },
  });
  new ListCtrl().addTo(map);

  // Наведення на мітку боса на карті — підсвічуємо його чип у списку.
  const rbSetChipHl = (idx: number, on: boolean): void => {
    const chip = listEl?.querySelector<HTMLElement>('.rb-chip[data-rb="' + idx + '"]');
    chip?.classList.toggle('hl', on);
  };
  bosses.forEach((b, i) => {
    b._marker?.on('mouseover', () => rbSetChipHl(i, true));
    b._marker?.on('mouseout', () => rbSetChipHl(i, false));
  });

  if (listEl) {
    listEl.innerHTML = listHtml;
    listEl.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('.rb-chip[data-rb]');
      if (!chip) return;
      const idx = +(chip.dataset.rb as string);
      const b = bosses[idx];
      if ((e.target as HTMLElement).closest('.rb-chip-edit')) {
        rbOpenRenameModal(kind, idx, b);
        return;
      }
      if ((e.target as HTMLElement).closest('.rb-chip-kill')) {
        rbSetKilled(kind, b, !rbIsKilled(kind, b));
        rbUpdateKillUI(kind);
        return;
      }
      map.flyTo(b._ll, flyZoom, { duration: 0.6 });
      b._marker.openPopup();
    });

    // Наведення на чип боса — підсвічуємо його мітку на карті.
    const rbSetHl = (b: Boss, on: boolean): void => {
      const m = b._marker;
      if (!m || !m._icon) return;
      m._icon.classList.toggle('hl', on);
      m.setZIndexOffset(on ? 1000 : 0);
    };
    listEl.addEventListener('mouseover', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('.rb-chip[data-rb]');
      if (!chip) return;
      rbSetHl(bosses[+(chip.dataset.rb as string)], true);
    });
    listEl.addEventListener('mouseout', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('.rb-chip[data-rb]');
      if (!chip) return;
      const to = e.relatedTarget as Node | null;
      if (to && chip.contains(to)) return; // ще всередині того ж чипа
      rbSetHl(bosses[+(chip.dataset.rb as string)], false);
    });
  }

  const resetBtn = document.getElementById(
    kind === 'world' ? 'rbResetWorld' : 'rbResetChrono',
  ) as ResetBtn | null;
  if (resetBtn && !resetBtn._wired) {
    resetBtn._wired = true;
    resetBtn.addEventListener('click', () => {
      rbKills[kind].clear();
      rbSaveKills();
      rbUpdateKillUI(kind);
    });
  }
  rbUpdateKillUI(kind);

  fit(false);

  if (window.ResizeObserver) {
    let first = true;
    const ro = new ResizeObserver(() => {
      map.invalidateSize(false);
      if (first) {
        first = false;
        fit(false);
      }
    });
    ro.observe(el);
  }
  return map;
}

function rbFit(kind: Kind): void {
  const m = rbMaps[kind];
  if (!m) return;
  m.invalidateSize(false);
  if (kind === 'world') {
    const lls = WORLD_BOSSES.map((b) => b._ll).filter(Boolean);
    if (lls.length) m.fitBounds(L.latLngBounds(lls).pad(0.18), { animate: false });
  } else {
    m.fitBounds(
      [
        [0, 0],
        [CH_SIZE, CH_SIZE],
      ],
      { animate: false },
    );
  }
}

function rbRefresh(kind: Kind): void {
  requestAnimationFrame(() => rbFit(kind));
  setTimeout(() => rbFit(kind), 200);
  setTimeout(() => rbFit(kind), 550);
}

function rbApplyZoom(kind: Kind, fullscreen: boolean): void {
  const map = rbMaps[kind];
  if (!map) return;
  const z = RB_ZOOM[kind][fullscreen ? 'fullscreen' : 'windowed'];
  map.setMinZoom(z.min);
  map.setMaxZoom(z.max);
}

function rbShowSub(sub: Kind): void {
  const prev = rbSub;
  const fs = document.body.classList.contains('rb-fs-active');
  rbSub = sub;
  $$<HTMLElement>('.rb-subtab').forEach((b) => {
    const on = b.dataset.sub === sub;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  $$<HTMLElement>('.rb-sub').forEach((p) => p.classList.toggle('active', p.dataset.sub === sub));
  if (!rbMaps[sub]) rbMaps[sub] = buildRbMap(sub);
  // У фуллскріні перенесемо режим «на весь екран» на нову карту.
  if (fs && prev !== sub) {
    const elId = (k: Kind) => (k === 'world' ? 'rbMapWorld' : 'rbMapChrono');
    document.getElementById(elId(prev))?.classList.remove('fullscreen');
    document.getElementById(elId(sub))?.classList.add('fullscreen');
    rbApplyZoom(prev, false);
    rbApplyZoom(sub, true);
    rbRefresh(prev);
  }
  rbRefresh(sub);
}

function toggleRbFullscreen(kind: Kind): void {
  const el = document.getElementById(kind === 'world' ? 'rbMapWorld' : 'rbMapChrono');
  if (!el) return;
  const on = el.classList.toggle('fullscreen');
  document.body.classList.toggle('rb-fs-active', on);
  // Список босів згорнутий за замовчуванням при вході у фуллскрін.
  document.body.classList.toggle('rb-list-hidden', on);
  rbListToggleBtns.forEach(rbSyncListToggleBtn);
  const map = rbMaps[kind];
  if (map) {
    const z = RB_ZOOM[kind][on ? 'fullscreen' : 'windowed'];
    map.setMinZoom(z.min);
    map.setMaxZoom(z.max);
  }
  rbRefresh(kind);
}

let rbNamesLoaded = false;

export function rbActivate(): void {
  if (typeof L === 'undefined') return; // Leaflet не завантажився
  // Гарантія на випадок, коли rbActivate() (ефект дочірнього Layout) спрацює
  // раніше за rbInit() (ефект батьківського App) — типово при прямому заході на /rb.
  if (!rbNamesLoaded) {
    rbNamesLoaded = true;
    rbLoadNames();
  }
  if (rbCurrentCycle() !== rbKillCycle) {
    rbLoadKills();
    (Object.keys(rbMaps) as Kind[]).forEach((k) => rbMaps[k] && rbUpdateKillUI(k));
  }
  if (!rbMaps.world) rbMaps.world = buildRbMap('world');
  if (!rbWired) {
    rbWired = true;
    $$<HTMLElement>('.rb-subtab').forEach((btn) =>
      btn.addEventListener('click', () => rbShowSub(btn.dataset.sub as Kind)),
    );
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const fs = document.querySelector('.rb-map.fullscreen');
      if (!fs) return;
      // Клас .rb-map спільний з картою АТН — реагуємо лише на власні карти.
      if (fs.id !== 'rbMapWorld' && fs.id !== 'rbMapChrono') return;
      toggleRbFullscreen(fs.id === 'rbMapWorld' ? 'world' : 'chrono');
    });
  }
  rbRefresh(rbSub);
}

export function rbInit(): void {
  rbLoadKills();
  rbLoadNames();
}
