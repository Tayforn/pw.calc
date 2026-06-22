// =========================================================
// ГАЙДИ (дані з guides-data.js -> window.PW_GUIDES)
// =========================================================

import { $ } from '../../utils/dom';

interface GuideCat {
  id: string;
  name: string;
  emoji: string;
}
interface Guide {
  id: string;
  cat: string;
  title: string;
  html: string;
  updated?: string;
  images?: boolean;
}

export function guidesInit(): void {
  const data = window.PW_GUIDES as { guides: Guide[]; categories: GuideCat[] } | undefined;
  const nav = $('#guidesNav');
  const content = $('#guidesContent');
  const search = $<HTMLInputElement>('#guideSearch');
  if (!data || !nav || !content) return;

  const esc = (s: unknown): string =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const guides = data.guides;
  const cats = data.categories;
  let activeId: string | null = null;
  let query = '';
  let openCat: string | null = null; // id єдиної відкритої категорії

  const byCat: Record<string, Guide[]> = {};
  for (const g of guides) (byCat[g.cat] = byCat[g.cat] || []).push(g);

  const matches = (g: Guide): boolean =>
    !query ||
    g.title.toLowerCase().includes(query) ||
    g.html.toLowerCase().includes(query);

  const catOf = (id: string): string | null => {
    const g = guides.find((x) => x.id === id);
    return g ? g.cat : null;
  };

  function renderNav(): void {
    let html = '';
    for (const c of cats) {
      const list = (byCat[c.id] || []).filter(matches);
      if (!list.length) continue;
      const open = query ? true : c.id === openCat;
      html +=
        `<div class="guides-cat${open ? ' open' : ''}">` +
        `<button type="button" class="guides-cat-title" data-cat="${c.id}" aria-expanded="${open}">` +
        `<span class="guides-cat-ico">${c.emoji}</span>` +
        `<span class="guides-cat-name">${esc(c.name)}</span>` +
        `<span class="guides-cat-count">${list.length}</span>` +
        `<span class="guides-cat-chevron" aria-hidden="true">▸</span>` +
        `</button><ul>`;
      for (const g of list) {
        const on = g.id === activeId ? ' class="active"' : '';
        html +=
          `<li><button type="button" data-guide="${g.id}"${on}>` +
          `${esc(g.title)}${g.images ? ' <span class="guide-cam">📷</span>' : ''}` +
          `</button></li>`;
      }
      html += '</ul></div>';
    }
    nav!.innerHTML = html || '<div class="guide-empty small">Нічого не знайдено</div>';
  }

  function renderGuide(id: string): void {
    const g = guides.find((x) => x.id === id);
    if (!g) {
      content!.innerHTML = '<div class="guide-empty">Обери гайд зі списку зліва.</div>';
      return;
    }
    activeId = id;
    const cat = cats.find((c) => c.id === g.cat);
    content!.innerHTML =
      `<div class="guide-head">` +
      (cat ? `<span class="guide-crumb">${cat.emoji} ${esc(cat.name)}</span>` : '') +
      `<h3>${esc(g.title)}</h3>` +
      (g.updated ? `<span class="guide-date">оновлено ${esc(g.updated)}</span>` : '') +
      `</div>` +
      `<div class="guide-body">${g.html}</div>`;
    content!.scrollTop = 0;
  }

  function selectGuide(id: string): void {
    const cat = catOf(id);
    if (cat) openCat = cat;
    renderGuide(id);
    renderNav();
    content!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (location.hash !== '#guides/' + id) history.replaceState(null, '', '#guides/' + id);
  }

  nav.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const head = target.closest<HTMLElement>('button[data-cat]');
    if (head) {
      const id = head.dataset.cat as string;
      openCat = openCat === id ? null : id;
      renderNav();
      const el = nav!.querySelector('.guides-cat.open');
      if (el && openCat === id) el.scrollIntoView({ block: 'nearest' });
      return;
    }
    const btn = target.closest<HTMLElement>('button[data-guide]');
    if (btn) selectGuide(btn.dataset.guide as string);
  });
  content.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>('.guide-link[data-guide]');
    if (link) {
      e.preventDefault();
      selectGuide(link.dataset.guide as string);
      return;
    }
  });
  if (search) {
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      renderNav();
    });
  }

  const hash = (location.hash || '').replace('#', '');
  let openId: string | null = hash.startsWith('guides/') ? hash.slice(7) : null;
  if (!guides.find((g) => g.id === openId)) openId = guides[0] && guides[0].id;
  if (openId) {
    openCat = catOf(openId);
    renderGuide(openId);
  }
  renderNav();

  // дозволяє відкрити конкретний гайд із заголовка вкладки
  window.__openGuide = selectGuide;
}
