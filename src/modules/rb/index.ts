// =========================================================
// РБ — карта рейдових босів (тайли worldmap.pw + власні мітки)
// =========================================================

import { $$ } from '../../utils/dom';
import { escHtml } from '../../utils/format';

// Розширюємо об'єкти босів runtime-полями (мітка, latlng тощо).
interface WorldBoss {
  nick: string;
  name: string;
  x: number;
  y: number;
  _ll?: any;
  _marker?: any;
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
    const attr = 'Карта © <a href="https://worldmap.pw/" target="_blank" rel="noopener">worldmap.pw</a>';
    L.tileLayer('https://worldmap.pw/tiles/satmap/{z}/{x}/{y}.webp', {
      minZoom: 0,
      maxZoom: 18,
      tileSize: 256,
      attribution: attr,
    }).addTo(map);
    L.tileLayer('https://worldmap.pw/tiles/map/{z}/{x}/{y}.webp', {
      minZoom: 18,
      maxZoom: 21,
      tileSize: 256,
    }).addTo(map);
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
    const label = b.nick || b.name;
    const coordStr =
      kind === 'world'
        ? (b as WorldBoss).x + ' ' + (b as WorldBoss).y
        : Math.round((b as ChronoBoss).x) + ' ' + Math.round((b as ChronoBoss).z);
    const icon = L.divIcon({
      className: 'rb-marker' + (b.tier ? ' t' + b.tier : ''),
      html: '<span class="rb-pin"></span><span class="rb-lbl">' + escHtml(label) + '</span>',
      iconSize: null,
      iconAnchor: [8, 8],
    });
    const popup =
      '<div class="rb-pop">' +
      (b.sub ? '<span class="rb-pop-sub t' + b.tier + '">' + escHtml(b.sub) + '</span>' : '') +
      '<b>' + escHtml(b.name) + '</b>' +
      (b.nick && b.nick !== b.name ? ' <span class="rb-pop-nick">(' + escHtml(b.nick) + ')</span>' : '') +
      '<br><span class="coord" data-coord="' + coordStr + '" title="Натисни, щоб скопіювати">' + coordStr + '</span>' +
      '</div>';
    b._marker = L.marker(ll, { icon }).addTo(map).bindPopup(popup);
    listHtml +=
      '<span class="rb-chip' + (b.tier ? ' t' + b.tier : '') + '" data-rb="' + i + '">' +
      '<button type="button" class="rb-chip-go" title="Показати на карті">' +
      (b.tier ? '<span class="rb-chip-tier">' + b.tier + '</span>' : '') +
      escHtml(label) +
      '</button>' +
      '<button type="button" class="rb-chip-kill" title="Позначити вбитим / живим" aria-pressed="false">✓</button>' +
      '</span>';
  });

  if (kind === 'world' && lls.length) {
    map.setMaxBounds(L.latLngBounds(lls).pad(0.5));
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

  if (listEl) {
    listEl.innerHTML = listHtml;
    listEl.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('.rb-chip[data-rb]');
      if (!chip) return;
      const b = bosses[+(chip.dataset.rb as string)];
      if ((e.target as HTMLElement).closest('.rb-chip-kill')) {
        rbSetKilled(kind, b, !rbIsKilled(kind, b));
        rbUpdateKillUI(kind);
        return;
      }
      map.flyTo(b._ll, flyZoom, { duration: 0.6 });
      b._marker.openPopup();
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
  const map = rbMaps[kind];
  if (map) {
    const z = RB_ZOOM[kind][on ? 'fullscreen' : 'windowed'];
    map.setMinZoom(z.min);
    map.setMaxZoom(z.max);
  }
  rbRefresh(kind);
}

export function rbActivate(): void {
  if (typeof L === 'undefined') return; // Leaflet не завантажився
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
      toggleRbFullscreen(fs.id === 'rbMapWorld' ? 'world' : 'chrono');
    });
  }
  rbRefresh(rbSub);
}

export function rbInit(): void {
  rbLoadKills();
}
