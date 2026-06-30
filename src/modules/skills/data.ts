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

export async function loadClasses(): Promise<ClassDef[]> {
  if (!classes) classes = (await getJson<{ classes: ClassDef[] }>('skills.json')).classes;
  return classes;
}
export async function loadGenie(): Promise<GenieSkill[]> {
  if (!genie) genie = (await getJson<{ skills: GenieSkill[] }>('genie.json')).skills;
  return genie;
}
export async function loadPets(): Promise<PetSkill[]> {
  if (!pets) pets = (await getJson<{ skills: PetSkill[] }>('pets.json')).skills;
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
 *  Спрайт — іконки 32px (53 колонки × 10 рядків). Масштабуємо до 40px плитки. */
export function classIconStyle(icon: number, page: number): string {
  const s = 40; // розмір плитки
  return (
    `background-image:url(${SKILLS_ASSET}icone.jpg);` +
    `background-size:${(1696 / 32) * s}px ${(320 / 32) * s}px;` +
    `background-position:-${icon * s}px -${(page - 1) * s}px;`
  );
}

/** Стиль фону для іконки джина (кроп genie2.png за формулою afficheicone).
 *  Оригінал показує іконку у вікні 32px (крок сітки 40px містить 8px відступу),
 *  тож беремо 32px і масштабуємо до 40px плитки (×1.25). */
export function genieIconStyle(page: number, posx: number, posy: number): string {
  const k = 40 / 32; // 32px-вікно → 40px-плитка
  const x = page === 2 ? 581 + 40 * posx : 40 + 40 * posx;
  const y = page === 2 ? 72 + 40 * posy : 55 + 40 * posy;
  return (
    `background-image:url(${SKILLS_ASSET}genie2.png);` +
    `background-size:${840 * k}px ${420 * k}px;` +
    `background-position:-${x * k}px -${y * k}px;`
  );
}

export function petIconUrl(id: number): string {
  return `${SKILLS_ASSET}pet/${id}.png`;
}
