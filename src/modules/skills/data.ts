// =========================================================
// СКІЛБАЗА — шар даних (класові вміння, джинн, питомець)
// Джерело: skill-pw.ucoz.ru (рушій «by GeG»), дамп → JSON.
// =========================================================

const BASE = (import.meta.env.BASE_URL || './') + 'assets/';
export const SKILLS_ASSET = BASE + 'skills/';

// ---- класові вміння --------------------------------------
export interface SkillTier {
  name: string;
  tpl: string;
}
export interface ClassSkill {
  x: number; // колонка в дереві (posx)
  y: number; // рядок у дереві (posy)
  icon: number; // індекс у спрайті icone.jpg
  name: string;
  tpl: string; // шаблон опису з плейсхолдерами {{f}}
  sage: SkillTier | null; // Рай (рівень 11)
  demon: SkillTier | null; // Ад (рівень 12)
  stats: Record<string, string[]>; // f → значення по рівнях (0..11)
}
export interface ClassDef {
  id: string;
  ru: string;
  en: string;
  page: number;
  skills: ClassSkill[];
}

// ---- джинн -----------------------------------------------
export interface GenieSkill {
  ref: number;
  name: string;
  tpl: string;
  lvlLabel: string;
  levels: number;
  page: number; // 1 або 2 (дерево джина)
  posx: number;
  posy: number;
  stats: Record<string, string[]>;
}

// ---- питомець --------------------------------------------
export interface PetSkill {
  id: number;
  name: string;
  tpl: string;
  levels: number;
  stats: Record<string, string[]>; // 0=рівень, 1=дух, 2=значення
}

let classes: ClassDef[] | null = null;
let genie: GenieSkill[] | null = null;
let pets: PetSkill[] | null = null;

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(BASE + 'data/skills/' + file);
  return (await res.json()) as T;
}

/** Назви у дампі інколи загорнуті в розмітку кольорів рушія
 *  (<span class="descent…">, <span class="holydark">) і містять
 *  сутності на кшталт &#9679; (●) — лишаємо чистий текст. */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

export async function loadClasses(): Promise<ClassDef[]> {
  if (!classes) {
    classes = (await getJson<{ classes: ClassDef[] }>('skills.json')).classes;
    for (const c of classes)
      for (const s of c.skills) {
        s.name = stripTags(s.name);
        if (s.sage) s.sage.name = stripTags(s.sage.name);
        if (s.demon) s.demon.name = stripTags(s.demon.name);
      }
  }
  return classes;
}
export async function loadGenie(): Promise<GenieSkill[]> {
  if (!genie) {
    genie = (await getJson<{ skills: GenieSkill[] }>('genie.json')).skills;
    for (const s of genie) s.name = stripTags(s.name);
  }
  return genie;
}
export async function loadPets(): Promise<PetSkill[]> {
  if (!pets) {
    pets = (await getJson<{ skills: PetSkill[] }>('pets.json')).skills;
    for (const s of pets) s.name = stripTags(s.name);
  }
  return pets;
}

/** Підставляє значення рівня замість {{f}} у шаблоні опису. */
export function renderTpl(tpl: string, stats: Record<string, string[]>, level: number): string {
  return tpl.replace(/\{\{(\d+)\}\}/g, (_, f: string) => {
    const arr = stats[f];
    if (!arr || !arr.length) return '?';
    return arr[Math.min(level, arr.length - 1)];
  });
}

/** Стиль фону для іконки класового вміння зі спрайта icone.jpg.
 *  Спрайт — іконки 32px (53 колонки × 10 рядків). Показуємо без
 *  масштабування (плитка .skl-tile теж 32px), інакше мило. */
export function classIconStyle(icon: number, page: number): string {
  return (
    `background-image:url(${SKILLS_ASSET}icone.jpg);` +
    `background-position:-${icon * 32}px -${(page - 1) * 32}px;`
  );
}

/** Стиль фону для іконки джина (кроп genie2.png за формулою afficheicone).
 *  Іконка у спрайті — вікно 32px (крок сітки 40px містить 8px відступу).
 *  Показуємо без масштабування (плитка .skl-tile-g теж 32px), інакше мило. */
export function genieIconStyle(page: number, posx: number, posy: number): string {
  const x = page === 2 ? 581 + 40 * posx : 40 + 40 * posx;
  const y = page === 2 ? 72 + 40 * posy : 55 + 40 * posy;
  return (
    `background-image:url(${SKILLS_ASSET}genie2.png);` +
    `background-position:-${x}px -${y}px;`
  );
}

export function petIconUrl(id: number): string {
  return `${SKILLS_ASSET}pet/${id}.png`;
}
