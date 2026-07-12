// =========================================================
// Гайди — ідіоматичний React (фаза 3 міграції; legacy guidesInit видалено).
// Дані — window.PW_GUIDES (guides-data.js). Дıп-лінк: /guides/<id>.
// =========================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_BASE } from '../app/useRoute';

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
  /** Кількість зображень у гайді (0 = немає). */
  images?: number;
}

function guidesData(): { guides: Guide[]; categories: GuideCat[] } {
  return (window.PW_GUIDES as { guides: Guide[]; categories: GuideCat[] } | undefined) || { guides: [], categories: [] };
}

/** id гайда з URL: /guides/<id> або legacy-хеш #guides/<id>. */
function guideIdFromUrl(): string | null {
  const legacy = (location.hash || '').replace('#', '');
  if (legacy.startsWith('guides/')) return legacy.slice(7);
  const parts = location.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('guides');
  return i >= 0 && parts[i + 1] ? decodeURIComponent(parts[i + 1]) : null;
}

export default function GuidesPage() {
  const { guides, categories } = useMemo(guidesData, []);
  const byCat = useMemo(() => {
    const m: Record<string, Guide[]> = {};
    for (const g of guides) (m[g.cat] = m[g.cat] || []).push(g);
    return m;
  }, [guides]);

  const initialId = useMemo(() => {
    const fromUrl = guideIdFromUrl();
    return guides.some((g) => g.id === fromUrl) ? (fromUrl as string) : guides[0]?.id ?? null;
  }, [guides]);

  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [query, setQuery] = useState('');
  const [openCat, setOpenCat] = useState<string | null>(
    () => guides.find((g) => g.id === initialId)?.cat ?? null,
  );
  const contentRef = useRef<HTMLElement>(null);

  const active = guides.find((g) => g.id === activeId) || null;
  const activeCat = active ? categories.find((c) => c.id === active.cat) : null;
  const q = query.trim().toLowerCase();
  const matches = (g: Guide) => !q || g.title.toLowerCase().includes(q) || g.html.toLowerCase().includes(q);

  const select = useCallback(
    (id: string) => {
      const g = guidesData().guides.find((x) => x.id === id);
      if (!g) return;
      setActiveId(id);
      setOpenCat(g.cat);
      history.replaceState(null, '', APP_BASE + 'guides/' + encodeURIComponent(id));
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [],
  );

  // Крослінки всередині тексту гайда (<a class="guide-link" data-guide="…">).
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLElement>('.guide-link[data-guide]');
      if (link?.dataset.guide) {
        e.preventDefault();
        select(link.dataset.guide);
      }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [select]);

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Бібліотека гайдів</span>
        <h2>Гайди спільноти PW Helper <span className="byline">(by Pharmacist)</span></h2>
        <p>
          Куб Долі по кімнатах, ланцюжки титулів, корисні ресурси та база
          гільдії. Матеріали зібрані з діскорд-серверу{' '}
          <b>PW&nbsp;Helper</b>. Обери розділ і гайд зліва.
        </p>
        <a className="discord-btn" href="https://discord.gg/GgpbKamWhm" target="_blank" rel="noopener">
          <svg className="discord-ico" viewBox="0 0 24 18" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M20.32 1.49A19.7 19.7 0 0 0 15.45 0c-.21.38-.45.89-.62 1.29a18.3 18.3 0 0 0-5.46 0C9.2.89 8.95.38 8.74 0a19.6 19.6 0 0 0-4.87 1.49C.77 6.09-.07 10.57.35 14.99a19.8 19.8 0 0 0 6 3.01c.48-.66.91-1.36 1.28-2.1-.7-.26-1.37-.59-2-.97.17-.12.33-.25.49-.38a14.1 14.1 0 0 0 12.06 0c.16.14.32.26.49.38-.63.38-1.31.71-2.01.97.37.74.8 1.44 1.28 2.1a19.7 19.7 0 0 0 6-3.01c.5-5.12-.84-9.56-3.62-13.5ZM8.02 12.27c-1.18 0-2.15-1.08-2.15-2.4 0-1.32.95-2.41 2.15-2.41 1.2 0 2.17 1.09 2.15 2.41 0 1.32-.95 2.4-2.15 2.4Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.4 0-1.32.95-2.41 2.15-2.41 1.2 0 2.17 1.09 2.15 2.41 0 1.32-.94 2.4-2.15 2.4Z"/>
          </svg>
          <span>Discord-сервер PW Helper</span>
        </a>
      </header>

      <div className="guides-layout">
        <aside className="guides-sidebar" id="guidesSidebar">
          <div className="guides-search">
            <input
              type="search"
              id="guideSearch"
              placeholder="Пошук гайда…"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <nav className="guides-nav" id="guidesNav" aria-label="Список гайдів">
            {categories.map((c) => {
              const list = (byCat[c.id] || []).filter(matches);
              if (!list.length) return null;
              const open = q ? true : c.id === openCat;
              return (
                <div key={c.id} className={'guides-cat' + (open ? ' open' : '')}>
                  <button
                    type="button"
                    className="guides-cat-title"
                    aria-expanded={open}
                    onClick={() => setOpenCat(openCat === c.id ? null : c.id)}
                  >
                    <span className="guides-cat-ico">{c.emoji}</span>
                    <span className="guides-cat-name">{c.name}</span>
                    <span className="guides-cat-count">{list.length}</span>
                    <span className="guides-cat-chevron" aria-hidden="true">▸</span>
                  </button>
                  <ul>
                    {list.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          className={g.id === activeId ? 'active' : undefined}
                          onClick={() => select(g.id)}
                        >
                          {g.title}
                          {!!g.images && <span className="guide-cam"> 📷</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {!categories.some((c) => (byCat[c.id] || []).some(matches)) && (
              <div className="guide-empty small">Нічого не знайдено</div>
            )}
          </nav>
        </aside>
        <article className="guides-content card" id="guidesContent" ref={contentRef}>
          {active ? (
            <>
              <div className="guide-head">
                {activeCat && <span className="guide-crumb">{activeCat.emoji} {activeCat.name}</span>}
                <h3>{active.title}</h3>
                {active.updated && <span className="guide-date">оновлено {active.updated}</span>}
              </div>
              {/* HTML гайдів — наш довірений контент із guides-data.js */}
              <div className="guide-body" dangerouslySetInnerHTML={{ __html: active.html }} />
            </>
          ) : (
            <div className="guide-empty">Обери гайд зі списку зліва.</div>
          )}
        </article>
      </div>
    </>
  );
}
