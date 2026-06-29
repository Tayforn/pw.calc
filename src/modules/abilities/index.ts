// =========================================================
// АБІЛКИ ЗБРОЇ (проки) — довідковий каталог
// =========================================================

import { ABILITIES, type Ability, type AbilityCat } from './data';
import { escHtml } from '../../utils/format';

const CAT_LABEL: Record<AbilityCat, string> = { buff: 'Баф', debuff: 'Дебаф', attack: 'Атака' };
const CAT_BADGE: Record<AbilityCat, string> = { buff: 'good', debuff: 'bad', attack: 'world' };

// Показуємо лише абілки з прикладом зброї (id для перевірки в базі).
const SHOWN = ABILITIES.filter((a) => a.ids.length > 0);

let curCat: 'all' | AbilityCat = 'all';
let curQ = '';

/** Перша літера великою (частина назв у джерелі — з малої). */
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const dash = '<span class="muted">—</span>';

function enCell(ab: Ability): string {
  if (!ab.en) return '<span class="abil-en-none" title="EN-назва не підтверджена (новіша абілка)">невідома</span>';
  const title = ab.verified ? 'звірено по pwdatabase' : 'за збігом ефекту з вікі — не звірено';
  const mark = ab.verified ? '' : '≈ ';
  return '<span class="abil-en" title="' + title + '">' + mark + escHtml(ab.en) + '</span>';
}

function rowHtml(ab: Ability): string {
  const proc = ab.proc
    ? `<span class="badge${ab.proc.startsWith('~') ? '' : ' good'}">${escHtml(ab.proc)}</span>`
    : dash;
  const ov = ab.overwrites ? escHtml(ab.overwrites) : dash;
  const notes = ab.notes ? escHtml(ab.notes) : dash;
  const ids = ab.ids.length
    ? '<span class="abil-ids" title="приклад">' + ab.ids.join(', ') + '</span>'
    : dash;
  return (
    '<tr class="abil-row">' +
    '<td><div class="abil-name">' + escHtml(cap(ab.name)) + '</div>' +
    '<div class="abil-meta"><span class="badge ' + CAT_BADGE[ab.cat] + '">' + CAT_LABEL[ab.cat] + '</span>' + enCell(ab) + '</div></td>' +
    '<td>' + escHtml(cap(ab.desc)) + '</td>' +
    '<td>' + ov + '</td>' +
    '<td>' + notes + '</td>' +
    '<td class="num">' + proc + '</td>' +
    '<td class="num">' + ids + '</td>' +
    '</tr>'
  );
}

function apply(): void {
  const body = document.getElementById('abilTableBody');
  if (!body) return;
  const q = curQ.trim().toLowerCase();
  const rows = SHOWN.filter((ab) => {
    if (curCat !== 'all' && ab.cat !== curCat) return false;
    if (!q) return true;
    return ab.search.includes(q); // індекс містить UA + оригінал RU + EN
  });
  body.innerHTML =
    rows.map(rowHtml).join('') ||
    '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Нічого не знайдено.</td></tr>';
  const cnt = document.getElementById('abilCount');
  if (cnt) cnt.textContent = 'Показано: ' + rows.length + ' з ' + SHOWN.length;
}

export function abilitiesInit(): void {
  const tbl = document.getElementById('abilTable');
  if (!tbl) return;

  const search = document.getElementById('abilSearch') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    curQ = search.value;
    apply();
  });

  document.querySelectorAll<HTMLInputElement>('input[name="abilCat"]').forEach((r) =>
    r.addEventListener('change', () => {
      if (r.checked) {
        curCat = r.value as 'all' | AbilityCat;
        apply();
      }
    }),
  );

  apply();
}
