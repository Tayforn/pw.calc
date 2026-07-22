// =========================================================
// АТН («Файне полювання») — карта міток босів і зон полювання.
// Карта — з клієнта гри (спільний шар з РБ «Світ»): повний світ,
// включно з півднем та островами.
// =========================================================

import { escHtml } from '../../utils/format';
import { pwToLatLng, createPwWorldLayer, worldMaxBounds } from '../pwmap/layers';

interface AtnBoss {
  x: number;
  y: number;
  _ll?: any;
  _marker?: any;
  _coordStr?: string;
}

interface AtnZone {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  _ll?: any;
  _poly?: any;
  _coordStr?: string;
}

type Kind = 'boss' | 'zone';

const ATN_BOSSES: AtnBoss[] = [
  { x: 246, y: 629 },
  { x: 263, y: 690 },
  { x: 282, y: 416 },
  { x: 342, y: 211 },
  { x: 344, y: 256 },
  { x: 369, y: 421 },
  { x: 430, y: 851 },
  { x: 484, y: 951 },
  { x: 639, y: 127 },
  { x: 686, y: 120 },
];

// Зони полювання (еліпси з оригінальної карти-скріншота), перераховані
// в ігрові координати. Порядок = порядок босів; зона 4 накриває босів 4 і 5.
const ATN_ZONES: AtnZone[] = [
  { cx: 222, cy: 623, rx: 19, ry: 50 },
  { cx: 259, cy: 676, rx: 34, ry: 15 },
  { cx: 260, cy: 436, rx: 27, ry: 56 },
  { cx: 351, cy: 237, rx: 21, ry: 50 },
  { cx: 377, cy: 413, rx: 22, ry: 42 },
  { cx: 452, cy: 834, rx: 31, ry: 18 },
  { cx: 475, cy: 944, rx: 37, ry: 28 },
  { cx: 634, cy: 135, rx: 22, ry: 35 },
  { cx: 694, cy: 119, rx: 34, ry: 15 },
];

const ZONE_COLOR = '#e3b95e';

// --- Чеклист «кого вже вбив» (без авто-скиду — лише вручну) ---
const ATN_KILLS_LS_KEY = 'pwcalc.atnKills';
const atnKills = new Set<number>();

function atnLoadKills(): void {
  atnKills.clear();
  try {
    const saved = JSON.parse(localStorage.getItem(ATN_KILLS_LS_KEY) || 'null');
    if (Array.isArray(saved)) saved.forEach((i) => atnKills.add(+i));
  } catch (_) {
    /* ignore */
  }
}

function atnSaveKills(): void {
  try {
    localStorage.setItem(ATN_KILLS_LS_KEY, JSON.stringify([...atnKills]));
  } catch (_) {
    /* ignore */
  }
}

// --- Кастомні назви міток і зон (зберігаються вічно в localStorage) ---
const ATN_NAMES_LS_KEY = 'pwcalc.atnNames';
const atnNames: Record<Kind, Record<number, string>> = { boss: {}, zone: {} };

function atnLoadNames(): void {
  let saved: any = null;
  try {
    saved = JSON.parse(localStorage.getItem(ATN_NAMES_LS_KEY) || 'null');
  } catch (_) {
    /* ignore */
  }
  atnNames.boss = saved && saved.boss && typeof saved.boss === 'object' ? saved.boss : {};
  atnNames.zone = saved && saved.zone && typeof saved.zone === 'object' ? saved.zone : {};
}

function atnSaveNames(): void {
  try {
    localStorage.setItem(ATN_NAMES_LS_KEY, JSON.stringify(atnNames));
  } catch (_) {
    /* ignore */
  }
}

// Типові назви — за містами, біля яких стоять боси (дав юзер).
// ГО = Город Оборотнів, ГП = Город Пір'я, ГМ = Город Мечів.
const BOSS_DEFAULT_NAMES = [
  'ГО Південь',
  'ГО Респ',
  'ГП Річка',
  'Єдності низ',
  'Єдності верх',
  'ГП Респ',
  'ГМ Респ',
  'Лісопилка',
  'Цунамі ліво',
  'Цунамі право',
];
// Зона 4 (індекс 3) спільна для босів «Єдності низ/верх» (ГЄ = Город Єдності).
const ZONE_DEFAULT_NAMES: (string | null)[] = [
  'ГО низ моби',
  'ГО респ моби',
  'ГП річка моби',
  'ГЄ моби',
  'ГП респ моби',
  'ГМ респ моби',
  'Лісопильня моби',
  'Цунамі ліво',
  'Цунамі право',
];

const atnDefaultLabel = (kind: Kind, idx: number): string =>
  kind === 'boss'
    ? BOSS_DEFAULT_NAMES[idx] || 'Бос ' + (idx + 1)
    : ZONE_DEFAULT_NAMES[idx] || 'Зона ' + (idx + 1);

function atnDisplayName(kind: Kind, idx: number): string {
  const custom = atnNames[kind][idx];
  return custom && custom.trim() ? custom.trim() : atnDefaultLabel(kind, idx);
}

function atnBuildPopup(kind: Kind, idx: number, coordStr: string): string {
  const label = atnDisplayName(kind, idx);
  const defaultLabel = atnDefaultLabel(kind, idx);
  const extra = label !== defaultLabel ? defaultLabel : '';
  return (
    '<div class="rb-pop">' +
    '<b>' + escHtml(label) + '</b>' +
    (extra ? ' <span class="rb-pop-nick">(' + escHtml(extra) + ')</span>' : '') +
    '<br><span class="coord" data-coord="' + coordStr + '" title="Натисни, щоб скопіювати">' + coordStr + '</span>' +
    '</div>'
  );
}

// Оновлює назву в DOM (чип у списку, мітка й попап на карті) без перебудови карти.
function atnApplyName(kind: Kind, idx: number): void {
  const label = atnDisplayName(kind, idx);

  const listEl = document.getElementById(kind === 'boss' ? 'atnList' : 'atnZoneList');
  const nameEl = listEl?.querySelector('.rb-chip[data-atn="' + idx + '"] .rb-chip-name');
  if (nameEl) nameEl.textContent = label;

  if (kind === 'boss') {
    const b = ATN_BOSSES[idx];
    if (b?._marker) {
      const iconEl = (b._marker as any)._icon as HTMLElement | undefined;
      const lblEl = iconEl?.querySelector('.rb-lbl');
      if (lblEl) lblEl.textContent = label;
      b._marker.setPopupContent(atnBuildPopup('boss', idx, b._coordStr || ''));
    }
  } else {
    const z = ATN_ZONES[idx];
    if (z?._poly) z._poly.setPopupContent(atnBuildPopup('zone', idx, z._coordStr || ''));
  }
}

// --- Модалка перейменування (та сама поведінка, що в РБ) ---
interface AtnRenameEls {
  overlay: HTMLElement;
  input: HTMLInputElement;
  title: HTMLElement;
}
let atnRenameEls: AtnRenameEls | null = null;
let atnRenameCtx: { kind: Kind; idx: number } | null = null;

function atnCloseRenameModal(): void {
  if (!atnRenameEls || !atnRenameCtx) return;
  atnRenameEls.overlay.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  atnRenameCtx = null;
}

function atnCommitRename(): void {
  if (!atnRenameEls || !atnRenameCtx) return;
  const { kind, idx } = atnRenameCtx;
  const trimmed = atnRenameEls.input.value.trim();
  if (trimmed && trimmed !== atnDefaultLabel(kind, idx)) atnNames[kind][idx] = trimmed;
  else delete atnNames[kind][idx];
  atnSaveNames();
  atnApplyName(kind, idx);
  atnCloseRenameModal();
}

function atnResetRename(): void {
  if (!atnRenameCtx) return;
  const { kind, idx } = atnRenameCtx;
  delete atnNames[kind][idx];
  atnSaveNames();
  atnApplyName(kind, idx);
  atnCloseRenameModal();
}

function atnEnsureRenameModal(): AtnRenameEls {
  if (atnRenameEls) return atnRenameEls;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay rb-rename-overlay';
  overlay.id = 'atnRenameModal';
  overlay.setAttribute('hidden', '');
  overlay.innerHTML =
    '<div class="modal rb-rename-modal" role="dialog" aria-modal="true" aria-labelledby="atnRenameTitle">' +
    '<div class="modal-head">' +
    '<h3 id="atnRenameTitle">Перейменувати</h3>' +
    '<button type="button" class="modal-close" data-act="close" aria-label="Закрити">✕</button>' +
    '</div>' +
    '<div class="modal-body">' +
    '<div class="field">' +
    '<label for="atnRenameInput">Назва на мітці й у списку</label>' +
    '<input type="text" id="atnRenameInput" maxlength="40" autocomplete="off" spellcheck="false">' +
    '</div>' +
    '</div>' +
    '<div class="modal-foot">' +
    '<button type="button" class="btn btn-ghost" data-act="reset">↺ Типова назва</button>' +
    '<button type="button" class="btn btn-ghost" data-act="close">Скасувати</button>' +
    '<button type="button" class="btn btn-primary" data-act="save">Зберегти</button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#atnRenameInput') as HTMLInputElement;
  const title = overlay.querySelector('#atnRenameTitle') as HTMLElement;

  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === overlay || t.closest('[data-act="close"]')) atnCloseRenameModal();
    else if (t.closest('[data-act="save"]')) atnCommitRename();
    else if (t.closest('[data-act="reset"]')) atnResetRename();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      atnCommitRename();
    }
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    atnCloseRenameModal();
  });

  atnRenameEls = { overlay, input, title };
  return atnRenameEls;
}

function atnOpenRenameModal(kind: Kind, idx: number): void {
  const els = atnEnsureRenameModal();
  atnRenameCtx = { kind, idx };
  const defaultLabel = atnDefaultLabel(kind, idx);
  els.title.textContent = 'Перейменувати «' + defaultLabel + '»';
  els.input.value = atnDisplayName(kind, idx);
  els.input.placeholder = defaultLabel;
  els.overlay.removeAttribute('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    els.input.focus();
    els.input.select();
  });
}

function atnUpdateKillUI(): void {
  const listEl = document.getElementById('atnList');
  let killed = 0;
  ATN_BOSSES.forEach((b, i) => {
    const on = atnKills.has(i);
    if (on) killed++;
    if (listEl) {
      const chip = listEl.querySelector('.rb-chip[data-atn="' + i + '"]');
      if (chip) {
        chip.classList.toggle('killed', on);
        const kb = chip.querySelector('.rb-chip-kill');
        if (kb) kb.setAttribute('aria-pressed', String(on));
      }
    }
    if (b._marker && b._marker._icon) b._marker._icon.classList.toggle('killed', on);
  });
  const countEl = document.getElementById('atnKillCount');
  if (countEl) countEl.textContent = 'Вбито: ' + killed + ' / ' + ATN_BOSSES.length;
}

let atnMap: any = null;
let atnWired = false;
const atnListToggleBtns: HTMLElement[] = [];

function atnSyncListToggleBtn(btn: HTMLElement): void {
  const hidden = document.body.classList.contains('rb-list-hidden');
  btn.classList.toggle('is-off', hidden);
  btn.title = hidden ? 'Показати список' : 'Сховати список';
  btn.setAttribute('aria-label', btn.title);
}

function toggleAtnList(): void {
  document.body.classList.toggle('rb-list-hidden');
  atnListToggleBtns.forEach(atnSyncListToggleBtn);
}

// Зум як у РБ («Світ»): 18–21.
const ATN_ZOOM = { min: 18, max: 21 };
const ATN_FLY_ZOOM = 18;

const ZONE_STYLE = { color: ZONE_COLOR, weight: 2, opacity: 0.85, fillColor: ZONE_COLOR, fillOpacity: 0.08 };
const ZONE_STYLE_HL = { weight: 3.5, opacity: 1, fillOpacity: 0.2 };

// Еліпс зони -> полігон в ігрових координатах -> latlng-и карти.
function zoneLatLngs(z: AtnZone): any[] {
  const pts: any[] = [];
  for (let a = 0; a < 360; a += 10) {
    const r = (a * Math.PI) / 180;
    pts.push(pwToLatLng(z.cx + z.rx * Math.cos(r), z.cy + z.ry * Math.sin(r)));
  }
  return pts;
}

// Розширений тип для reset-кнопки (прапорець «вже підписано»).
type ResetBtn = HTMLElement & { _wired?: boolean };

function buildAtnMap(): any {
  const el = document.getElementById('atnMap');
  const listEl = document.getElementById('atnList');
  const zoneListEl = document.getElementById('atnZoneList');
  if (!el) return null;

  const map = L.map(el, {
    minZoom: ATN_ZOOM.min,
    maxZoom: ATN_ZOOM.max,
    zoomSnap: 0.5,
    zoomControl: true,
  });
  createPwWorldLayer().addTo(map);

  // Зони полювання (під мітками).
  ATN_ZONES.forEach((z, i) => {
    z._ll = pwToLatLng(z.cx, z.cy);
    z._coordStr = z.cx + ' ' + z.cy;
    z._poly = L.polygon(zoneLatLngs(z), ZONE_STYLE)
      .addTo(map)
      .bindPopup(atnBuildPopup('zone', i, z._coordStr));
  });

  const lls: any[] = [];
  let listHtml = '';
  ATN_BOSSES.forEach((b, i) => {
    const ll = pwToLatLng(b.x, b.y);
    b._ll = ll;
    lls.push(ll);
    b._coordStr = b.x + ' ' + b.y;
    const label = atnDisplayName('boss', i);
    const icon = L.divIcon({
      className: 'rb-marker',
      html: '<span class="rb-pin"></span><span class="rb-lbl">' + escHtml(label) + '</span>',
      iconSize: null,
      iconAnchor: [8, 8],
    });
    b._marker = L.marker(ll, { icon }).addTo(map).bindPopup(atnBuildPopup('boss', i, b._coordStr));
    listHtml +=
      '<span class="rb-chip" data-atn="' + i + '">' +
      '<button type="button" class="rb-chip-go" title="Показати на карті">' +
      '<span class="rb-chip-name">' + escHtml(label) + '</span>' +
      '</button>' +
      '<button type="button" class="rb-chip-edit" title="Перейменувати мітку">✎</button>' +
      '<button type="button" class="rb-chip-kill" title="Позначити вбитим / живим" aria-pressed="false">✓</button>' +
      '</span>';
  });

  let zoneListHtml = '';
  ATN_ZONES.forEach((_, i) => {
    zoneListHtml +=
      '<span class="rb-chip" data-atn="' + i + '">' +
      '<button type="button" class="rb-chip-go" title="Показати на карті">' +
      '<span class="rb-chip-name">' + escHtml(atnDisplayName('zone', i)) + '</span>' +
      '</button>' +
      '<button type="button" class="rb-chip-edit" title="Перейменувати зону">✎</button>' +
      '</span>';
  });

  map.setMaxBounds(worldMaxBounds());

  const fit = (animate?: boolean): void => {
    if (lls.length) map.fitBounds(L.latLngBounds(lls).pad(0.12), { animate: !!animate });
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
        toggleAtnFullscreen();
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
        toggleAtnList();
      });
      atnListToggleBtns.push(btn);
      atnSyncListToggleBtn(btn);
      return wrap;
    },
  });
  new ListCtrl().addTo(map);

  // Наведення на об'єкт на карті — підсвічуємо його чип у списку (і навпаки).
  const setChipHl = (kind: Kind, idx: number, on: boolean): void => {
    const holder = kind === 'boss' ? listEl : zoneListEl;
    holder?.querySelector<HTMLElement>('.rb-chip[data-atn="' + idx + '"]')?.classList.toggle('hl', on);
  };
  const setBossHl = (b: AtnBoss, on: boolean): void => {
    const m = b._marker;
    if (!m || !m._icon) return;
    m._icon.classList.toggle('hl', on);
    m.setZIndexOffset(on ? 1000 : 0);
  };
  const setZoneHl = (z: AtnZone, on: boolean): void => {
    z._poly?.setStyle(on ? ZONE_STYLE_HL : ZONE_STYLE);
  };

  ATN_BOSSES.forEach((b, i) => {
    b._marker?.on('mouseover', () => setChipHl('boss', i, true));
    b._marker?.on('mouseout', () => setChipHl('boss', i, false));
  });
  ATN_ZONES.forEach((z, i) => {
    z._poly?.on('mouseover', () => {
      setChipHl('zone', i, true);
      setZoneHl(z, true);
    });
    z._poly?.on('mouseout', () => {
      setChipHl('zone', i, false);
      setZoneHl(z, false);
    });
  });

  // Спільна логіка списків: клік (перейти/перейменувати/вбито) + hover-підсвітка.
  const wireList = (holder: HTMLElement | null, kind: Kind): void => {
    if (!holder) return;
    holder.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('.rb-chip[data-atn]');
      if (!chip) return;
      const idx = +(chip.dataset.atn as string);
      if ((e.target as HTMLElement).closest('.rb-chip-edit')) {
        atnOpenRenameModal(kind, idx);
        return;
      }
      if (kind === 'boss' && (e.target as HTMLElement).closest('.rb-chip-kill')) {
        if (atnKills.has(idx)) atnKills.delete(idx);
        else atnKills.add(idx);
        atnSaveKills();
        atnUpdateKillUI();
        return;
      }
      if (kind === 'boss') {
        const b = ATN_BOSSES[idx];
        map.flyTo(b._ll, ATN_FLY_ZOOM, { duration: 0.6 });
        b._marker.openPopup();
      } else {
        const z = ATN_ZONES[idx];
        map.flyTo(z._ll, ATN_FLY_ZOOM, { duration: 0.6 });
        z._poly.openPopup(z._ll);
      }
    });
    holder.addEventListener('mouseover', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('.rb-chip[data-atn]');
      if (!chip) return;
      const idx = +(chip.dataset.atn as string);
      if (kind === 'boss') setBossHl(ATN_BOSSES[idx], true);
      else setZoneHl(ATN_ZONES[idx], true);
    });
    holder.addEventListener('mouseout', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('.rb-chip[data-atn]');
      if (!chip) return;
      const to = e.relatedTarget as Node | null;
      if (to && chip.contains(to)) return; // ще всередині того ж чипа
      const idx = +(chip.dataset.atn as string);
      if (kind === 'boss') setBossHl(ATN_BOSSES[idx], false);
      else setZoneHl(ATN_ZONES[idx], false);
    });
  };

  if (listEl) listEl.innerHTML = listHtml;
  if (zoneListEl) zoneListEl.innerHTML = zoneListHtml;
  wireList(listEl, 'boss');
  wireList(zoneListEl, 'zone');

  const resetBtn = document.getElementById('atnReset') as ResetBtn | null;
  if (resetBtn && !resetBtn._wired) {
    resetBtn._wired = true;
    resetBtn.addEventListener('click', () => {
      atnKills.clear();
      atnSaveKills();
      atnUpdateKillUI();
    });
  }
  atnUpdateKillUI();

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

function atnFit(): void {
  if (!atnMap) return;
  atnMap.invalidateSize(false);
  const lls = ATN_BOSSES.map((b) => b._ll).filter(Boolean);
  if (lls.length) atnMap.fitBounds(L.latLngBounds(lls).pad(0.12), { animate: false });
}

function atnRefresh(): void {
  requestAnimationFrame(() => atnFit());
  setTimeout(() => atnFit(), 200);
  setTimeout(() => atnFit(), 550);
}

function toggleAtnFullscreen(): void {
  const el = document.getElementById('atnMap');
  if (!el) return;
  const on = el.classList.toggle('fullscreen');
  document.body.classList.toggle('rb-fs-active', on);
  // Список згорнутий за замовчуванням при вході у фуллскрін.
  document.body.classList.toggle('rb-list-hidden', on);
  atnListToggleBtns.forEach(atnSyncListToggleBtn);
  atnRefresh();
}

let atnNamesLoaded = false;

export function atnActivate(): void {
  if (typeof L === 'undefined') return; // Leaflet не завантажився
  // Гарантія на випадок, коли atnActivate() (ефект дочірнього Layout) спрацює
  // раніше за atnInit() (ефект батьківського App) — типово при прямому заході на /atn.
  if (!atnNamesLoaded) {
    atnNamesLoaded = true;
    atnLoadNames();
    atnLoadKills();
  }
  if (!atnMap) atnMap = buildAtnMap();
  if (!atnWired) {
    atnWired = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const fs = document.querySelector('.rb-map.fullscreen');
      if (fs && fs.id === 'atnMap') toggleAtnFullscreen();
    });
  }
  atnRefresh();
}

export function atnInit(): void {
  if (atnNamesLoaded) return;
  atnNamesLoaded = true;
  atnLoadKills();
  atnLoadNames();
}
