// =========================================================
// СКІЛБАЗА — калькулятор умінь (класи / джинн / питомець)
// Відтворення skill-pw.ucoz.ru у стилі застосунку.
// =========================================================

import { escHtml } from '../../utils/format';
import { showTooltip, hideTooltip } from '../../utils/tooltip';
import { gcInit, gcIsDisabled, gcIsPicked, gcSetSkills, gcSkillAffHtml, gcToggle } from './genieCalc';
import {
  loadClasses,
  loadGenie,
  loadPets,
  renderTpl,
  classIconStyle,
  genieIconStyle,
  petIconUrl,
  type ClassDef,
  type ClassSkill,
  type GenieSkill,
  type PetSkill,
} from './data';

// ---------- спільне ----------
const L = (n: number) => 'Рівень ' + n;

// Тач-екрани: перший тап по вмінню джина показує тултіп, другий — дію (вибір у білд).
const COARSE_PTR = window.matchMedia('(pointer: coarse)').matches;
let touchTipFor: HTMLElement | null = null;
function touchTipGate(el: HTMLElement, show: () => void): boolean {
  if (!COARSE_PTR) return false;
  if (touchTipFor === el) {
    touchTipFor = null;
    return false;
  }
  touchTipFor = el;
  show();
  return true;
}

function infoRow(label: string, val: string): string {
  if (val == null || val === '' || val === '-') return '';
  return `<div class="skl-info"><span class="skl-info-l">${escHtml(label)}</span><span class="skl-info-v">${escHtml(val)}</span></div>`;
}

// =========================================================
// 1. КЛАСОВІ ВМІННЯ
// =========================================================
let CLASSES: ClassDef[] = [];
let curClass = 0;
let curKey = ''; // "x,y" вибраного вміння
let curLvl = 0; // 0..9 рівні, 10 = Рай, 11 = Ад

function skillByKey(cls: ClassDef, key: string): ClassSkill | undefined {
  return cls.skills.find((s) => s.x + ',' + s.y === key);
}

function renderClassBar(): void {
  const bar = document.getElementById('sklClassBar');
  if (!bar) return;
  bar.innerHTML = CLASSES.map(
    (c, i) =>
      `<button type="button" class="skl-class${i === curClass ? ' active' : ''}" data-ci="${i}">${escHtml(c.ru)}</button>`,
  ).join('');
  bar.querySelectorAll<HTMLButtonElement>('.skl-class').forEach((b) =>
    b.addEventListener('click', () => {
      curClass = +b.dataset.ci!;
      const first = CLASSES[curClass].skills[0];
      curKey = first ? first.x + ',' + first.y : '';
      curLvl = 0;
      renderClassBar();
      renderTree();
      renderClassDetail();
    }),
  );
}

function renderTree(): void {
  const tree = document.getElementById('sklTree');
  if (!tree) return;
  const cls = CLASSES[curClass];
  const cols = Math.max(...cls.skills.map((s) => s.x));
  tree.style.setProperty('--skl-cols', String(cols));
  tree.innerHTML = cls.skills
    .map((s) => {
      const key = s.x + ',' + s.y;
      return (
        `<button type="button" class="skl-tile${key === curKey ? ' active' : ''}" ` +
        `style="grid-column:${s.x};grid-row:${s.y};${classIconStyle(s.icon, cls.page)}" ` +
        `data-key="${key}" title="${escHtml(s.name)}" aria-label="${escHtml(s.name)}"></button>`
      );
    })
    .join('');
  tree.querySelectorAll<HTMLButtonElement>('.skl-tile').forEach((b) =>
    b.addEventListener('click', () => {
      curKey = b.dataset.key!;
      curLvl = 0;
      renderTree();
      renderClassDetail();
    }),
  );
}

function renderClassDetail(): void {
  const box = document.getElementById('sklDetail');
  if (!box) return;
  const cls = CLASSES[curClass];
  const s = skillByKey(cls, curKey);
  if (!s) {
    box.innerHTML = '<p class="muted skl-empty">Оберіть вміння у дереві.</p>';
    return;
  }

  const hasSage = !!s.sage;
  const hasDemon = !!s.demon;
  // реальна кількість звичайних рівнів (дані можуть мати 1..10)
  const normLevels = Math.min(s.stats['0']?.length ?? 1, 10);
  // clamp curLvl у дійсний діапазон
  if (curLvl < 10 && curLvl >= normLevels) curLvl = normLevels - 1;
  if (curLvl === 10 && !hasSage) curLvl = normLevels - 1;
  if (curLvl === 11 && !hasDemon) curLvl = normLevels - 1;

  let name = s.name;
  let tpl = s.tpl;
  if (curLvl === 10 && s.sage) { name = s.sage.name; tpl = s.sage.tpl; }
  if (curLvl === 11 && s.demon) { name = s.demon.name; tpl = s.demon.tpl; }

  // керування рівнем
  const lvlBtns: string[] = [];
  for (let i = 0; i < normLevels; i++)
    lvlBtns.push(
      `<button type="button" class="skl-lvl${curLvl === i ? ' active' : ''}" data-lvl="${i}">${i + 1}</button>`,
    );
  if (hasSage)
    lvlBtns.push(
      `<button type="button" class="skl-lvl skl-sage${curLvl === 10 ? ' active' : ''}" data-lvl="10">Рай</button>`,
    );
  if (hasDemon)
    lvlBtns.push(
      `<button type="button" class="skl-lvl skl-demon${curLvl === 11 ? ' active' : ''}" data-lvl="11">Ад</button>`,
    );

  const lvlText =
    curLvl === 10 ? 'Світла культивація' : curLvl === 11 ? 'Темна культивація' : L(curLvl + 1);

  box.innerHTML =
    `<div class="skl-detail-head"><h3 class="skl-name">${name}</h3><span class="skl-lvltag">${escHtml(lvlText)}</span></div>` +
    `<div class="skl-levels">${lvlBtns.join('')}</div>` +
    `<div class="skl-stats">` +
    infoRow('Потрібний рівень', s.stats['0']?.[curLvl] ?? '') +
    infoRow('Дух', s.stats['1']?.[curLvl] ?? '') +
    infoRow('Монети', s.stats['2']?.[curLvl] ?? '') +
    `</div>` +
    `<div class="skl-text">${renderTpl(tpl, s.stats, curLvl)}</div>`;

  box.querySelectorAll<HTMLButtonElement>('.skl-lvl').forEach((b) =>
    b.addEventListener('click', () => {
      curLvl = +b.dataset.lvl!;
      renderClassDetail();
    }),
  );
}

// =========================================================
// 2. ДЖИНН
// =========================================================
let GENIE: GenieSkill[] = [];
let curGenie = 0;
let curGenieLvl = 0;
let genieQ = '';

function renderGenieGrid(): void {
  const grid = document.getElementById('sklGenieGrid');
  if (!grid) return;
  const q = genieQ.trim().toLowerCase();
  const list = GENIE.map((s, i) => ({ s, i })).filter(
    ({ s }) => !q || s.name.toLowerCase().includes(q),
  );
  grid.innerHTML =
    list
      .map(({ s, i }) => {
        const state =
          (i === curGenie ? ' active' : '') +
          (gcIsPicked(s.ref) ? ' picked' : '') +
          (gcIsDisabled(s.ref) ? ' dis' : '');
        return (
          `<button type="button" class="skl-tile skl-tile-g${state}" ` +
          `style="${genieIconStyle(s.page, s.posx, s.posy)}" data-gi="${i}" aria-label="${escHtml(s.name)}"></button>`
        );
      })
      .join('') || '<p class="muted skl-empty">Нічого не знайдено.</p>';
  grid.querySelectorAll<HTMLButtonElement>('.skl-tile-g').forEach((b) =>
    b.addEventListener('click', () => {
      const s = GENIE[+b.dataset.gi!];
      // Тач: перший тап — тултіп, другий — вибір у білд.
      if (s && touchTipGate(b, () => showGenieTip(b, s))) return;
      hideGenieTip();
      curGenie = +b.dataset.gi!;
      curGenieLvl = 0;
      gcToggle(GENIE[curGenie].ref); // вибір у білд калькулятора (якщо доступне)
      renderGenieGrid();
      renderGenieDetail();
    }),
  );
}

// ---------- Тултіп вміння джина (hover по іконці в сітці) ----------

/** Інфа про вміння джина (початковий рівень) — той самий контент, що правий блок. */
function genieTipHtml(s: GenieSkill): string {
  const lvlText = s.levels > 1 ? L(1) : s.lvlLabel || 'Початковий навик';
  return (
    `<div class="doll-tip-name">${escHtml(s.name)} <span class="muted">· ${escHtml(lvlText)}</span></div>` +
    infoRow('Потрібний рівень джина', s.stats['0']?.[0] ?? '') +
    infoRow('Дух для вивчення', s.stats['1']?.[0] ?? '') +
    gcSkillAffHtml(s.ref) +
    `<div class="doll-tip-sep"></div><div class="skl-tip-text">${renderTpl(s.tpl, s.stats, 0)}</div>`
  );
}

function showGenieTip(target: HTMLElement, s: GenieSkill): void {
  showTooltip(target, genieTipHtml(s), 320);
}
function hideGenieTip(): void {
  hideTooltip();
}

function renderGenieDetail(): void {
  const box = document.getElementById('sklGenieDetail');
  if (!box) return;
  const s = GENIE[curGenie];
  if (!s) {
    box.innerHTML = '<p class="muted skl-empty">Оберіть вміння джина.</p>';
    return;
  }
  if (curGenieLvl >= s.levels) curGenieLvl = 0;

  const lvlBtns =
    s.levels > 1
      ? `<div class="skl-levels">` +
        Array.from(
          { length: s.levels },
          (_, i) =>
            `<button type="button" class="skl-lvl${curGenieLvl === i ? ' active' : ''}" data-lvl="${i}">${i + 1}</button>`,
        ).join('') +
        `</div>`
      : '';
  const lvlText = s.levels > 1 ? L(curGenieLvl + 1) : s.lvlLabel || 'Початковий навик';

  box.innerHTML =
    `<div class="skl-detail-head"><h3 class="skl-name">${escHtml(s.name)}</h3><span class="skl-lvltag">${escHtml(lvlText)}</span></div>` +
    lvlBtns +
    `<div class="skl-stats">` +
    infoRow('Потрібний рівень джина', s.stats['0']?.[curGenieLvl] ?? '') +
    infoRow('Дух для вивчення', s.stats['1']?.[curGenieLvl] ?? '') +
    gcSkillAffHtml(s.ref) +
    `</div>` +
    `<div class="skl-text">${renderTpl(s.tpl, s.stats, curGenieLvl)}</div>`;

  box.querySelectorAll<HTMLButtonElement>('.skl-lvl').forEach((b) =>
    b.addEventListener('click', () => {
      curGenieLvl = +b.dataset.lvl!;
      renderGenieDetail();
    }),
  );
}

// =========================================================
// 3. ПИТОМЕЦЬ
// =========================================================
let PETS: PetSkill[] = [];
let curPet = 0;
let curPetLvl = 0;

function renderPetGrid(): void {
  const grid = document.getElementById('sklPetGrid');
  if (!grid) return;
  grid.innerHTML = PETS.map(
    (s, i) =>
      `<button type="button" class="skl-petrow${i === curPet ? ' active' : ''}" data-pi="${i}">` +
      `<img class="skl-petico" src="${petIconUrl(s.id)}" alt="" loading="lazy" />` +
      `<span>${escHtml(s.name)}</span></button>`,
  ).join('');
  grid.querySelectorAll<HTMLButtonElement>('.skl-petrow').forEach((b) =>
    b.addEventListener('click', () => {
      curPet = +b.dataset.pi!;
      curPetLvl = 0;
      renderPetGrid();
      renderPetDetail();
    }),
  );
}

function renderPetDetail(): void {
  const box = document.getElementById('sklPetDetail');
  if (!box) return;
  const s = PETS[curPet];
  if (!s) return;
  if (curPetLvl >= s.levels) curPetLvl = 0;

  // кнопки = рівень вміння (1..N); stats[0] = потрібний рівень пета для цього рівня вміння
  const lvlBtns =
    s.levels > 1
      ? `<div class="skl-levels">` +
        Array.from(
          { length: s.levels },
          (_, i) =>
            `<button type="button" class="skl-lvl${curPetLvl === i ? ' active' : ''}" data-lvl="${i}">${i + 1}</button>`,
        ).join('') +
        `</div>`
      : '';

  box.innerHTML =
    `<div class="skl-detail-head"><h3 class="skl-name">${escHtml(s.name)}</h3>` +
    `<span class="skl-lvltag">${escHtml('Рівень ' + (curPetLvl + 1))}</span></div>` +
    lvlBtns +
    `<div class="skl-stats">` +
    infoRow('Потрібний рівень пета', s.stats['0']?.[curPetLvl] ?? '') +
    infoRow('Дух', s.stats['1']?.[curPetLvl] ?? '') +
    `</div>` +
    `<div class="skl-text">${renderTpl(s.tpl, s.stats, curPetLvl)}</div>`;

  box.querySelectorAll<HTMLButtonElement>('.skl-lvl').forEach((b) =>
    b.addEventListener('click', () => {
      curPetLvl = +b.dataset.lvl!;
      renderPetDetail();
    }),
  );
}

// =========================================================
// Ініціалізація + лінива загрузка по активації табів
// =========================================================
let classesReady = false;
let genieReady = false;
let petsReady = false;

async function ensureClasses(): Promise<void> {
  if (classesReady) return;
  CLASSES = await loadClasses();
  classesReady = true;
  const first = CLASSES[0].skills[0];
  curKey = first ? first.x + ',' + first.y : '';
  renderClassBar();
  renderTree();
  renderClassDetail();
}
async function ensureGenie(): Promise<void> {
  if (genieReady) return;
  GENIE = await loadGenie();
  GENIE.sort((a, b) => a.page - b.page || a.posy - b.posy || a.posx - b.posx);
  genieReady = true;
  gcSetSkills(GENIE);
  renderGenieGrid();
  renderGenieDetail();
}
async function ensurePets(): Promise<void> {
  if (petsReady) return;
  PETS = await loadPets();
  petsReady = true;
  renderPetGrid();
  renderPetDetail();
}

export function skillsInit(): void {
  if (!document.getElementById('sklTree')) return;

  const gs = document.getElementById('sklGenieSearch') as HTMLInputElement | null;
  gs?.addEventListener('input', () => {
    genieQ = gs.value;
    renderGenieGrid();
  });

  // Тултіп вміння джина при наведенні (делегування — сітка перемальовується).
  const gGrid = document.getElementById('sklGenieGrid');
  gGrid?.addEventListener('mouseover', (e) => {
    const tile = (e.target as HTMLElement).closest<HTMLElement>('.skl-tile-g');
    if (tile?.dataset.gi != null) {
      const s = GENIE[Number(tile.dataset.gi)];
      if (s) showGenieTip(tile, s);
    }
  });
  gGrid?.addEventListener('mouseout', (e) => {
    if ((e.target as HTMLElement).closest('.skl-tile-g')) hideGenieTip();
  });

  // калькулятор джина: зміна рівня/удачі/фільтрів перемальовує сітку
  gcInit(() => {
    renderGenieGrid();
  });

  // активатори по табах (реєструємо у навігації)
  (window as unknown as { __sklActivate?: (n: string) => void }).__sklActivate = (name: string) => {
    if (name === 'skills') void ensureClasses();
    else if (name === 'genie') void ensureGenie();
    else if (name === 'pets') void ensurePets();
  };

  // якщо відкрито одразу з хеша
  const initial = (location.hash || '').replace('#', '').split('/')[0];
  if (initial === 'skills') void ensureClasses();
  else if (initial === 'genie') void ensureGenie();
  else if (initial === 'pets') void ensurePets();
}
