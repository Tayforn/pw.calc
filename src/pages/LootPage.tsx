// =========================================================
// Таблиця луту "ХХ" — ідіоматичний React, стилі — спільні з рештою сайту.
// Дані — src/modules/loot/data.ts (звірено за id з базою елементів гри) та
// src/modules/loot/craft.ts (рецепти крафту з pwdatabase.net, що
// використовують наші предмети лута як матеріал).
// =========================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LOOT_CHAPTERS, type LootCell, type LootItem } from '../modules/loot/data';
import { loadCraftData, pwdbItemUrl, recipesForItem, type CraftData, type CraftRecipe } from '../modules/loot/craft';

const RARITY_LABEL: Record<string, string> = {
  common: 'звичайний',
  rare: 'зі скринь/босів',
  special: 'особливий',
  legendary: 'унікальний',
};

/** Картки на pwdatabase.net — те саме джерело, з якого зроблено сторінку. */
const mobUrl = (id: number) => `https://www.pwdatabase.net/ru/mob/${id}`;
const itemUrl = pwdbItemUrl;
const questUrl = (id: number) => `https://www.pwdatabase.net/ru/quest/${id}`;

/** Спрайт-лист іконок предметів (32×32 клітинки), той самий, що на сторінці-джерелі. */
const ICON_SHEET_URL = (import.meta.env.BASE_URL || '/') + 'assets/loot/iconsit6.png';

function ItemIcons({ item }: { item: LootItem }) {
  return (
    <span className="loot-icons">
      {item.icons.map(([x, y], i) => (
        <span
          key={i}
          className="loot-icon"
          style={{ backgroundImage: `url('${ICON_SHEET_URL}')`, backgroundPosition: `${x}px ${y}px` }}
        />
      ))}
    </span>
  );
}

function norm(s: string): string {
  return s.toLowerCase();
}

/** Чи є в комірці бодай щось, що відповідає пошуковому запиту. */
function cellMatches(cell: LootCell, q: string): boolean {
  if (!q) return true;
  if (cell.mobs.some((m) => m && norm(m.name).includes(q))) return true;
  if (cell.items.some((it) => norm(it.name).includes(q))) return true;
  if (cell.quest && norm(cell.quest.name).includes(q)) return true;
  return false;
}

// ---------------------------------------------------------------
// Крафт: попап "що крафтиться з предмета" + попап "усе, що крафтиться"
// ---------------------------------------------------------------

interface RecipeRowProps {
  recipe: CraftRecipe;
  /** Якщо попап відкрито для конкретного предмета лута — покажемо, скільки його треба саме на цей рецепт. */
  sourceQty?: number;
  onShowResources: (recipe: CraftRecipe) => void;
}

function RecipeRow({ recipe, sourceQty, onShowResources }: RecipeRowProps) {
  const lootMatCount = recipe.materials.filter((m) => m.isLootItem).length;
  return (
    <div className="craft-row">
      <img className="craft-row-icon" src={recipe.resultIcon} alt="" width={32} height={32} loading="lazy" />
      <div className="craft-row-info">
        <div className="craft-row-name">{recipe.resultItemName}</div>
        <div className="craft-row-sub">
          {recipe.resultLevel != null && <span>рівень {recipe.resultLevel}</span>}
          {sourceQty != null && <span> · потрібно ×{sourceQty}</span>}
        </div>
      </div>
      <div className="craft-row-actions">
        <a
          className="btn btn-ghost btn-sm"
          href={itemUrl(recipe.resultItemId)}
          target="_blank"
          rel="noopener noreferrer"
        >
          У базі ↗
        </a>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={lootMatCount === 0}
          title={lootMatCount === 0 ? 'Жоден з матеріалів не входить у наш лут ХХ' : undefined}
          onClick={() => onShowResources(recipe)}
        >
          Показати ресурси
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' craft-modal-wide' : '')} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" aria-label="Закрити" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function ItemCraftPopup({
  itemId,
  itemName,
  craftData,
  onClose,
  onShowResources,
}: {
  itemId: number;
  itemName: string;
  craftData: CraftData | null;
  onClose: () => void;
  onShowResources: (recipe: CraftRecipe) => void;
}) {
  const recipes = useMemo(() => (craftData ? recipesForItem(craftData, itemId) : []), [craftData, itemId]);
  return (
    <Modal title={'Крафтиться з «' + itemName + '»'} onClose={onClose}>
      {!craftData ? (
        <p className="muted center">Завантаження даних крафту…</p>
      ) : recipes.length === 0 ? (
        <p className="muted center">Цей предмет не входить як матеріал у жоден відомий рецепт.</p>
      ) : (
        <div className="craft-list">
          {recipes.map((r) => (
            <RecipeRow
              key={r.recipeId}
              recipe={r}
              sourceQty={r.materials.find((m) => m.itemId === itemId)?.qty}
              onShowResources={onShowResources}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

const LEVEL_GROUP_ORDER = [60, 70, 80, 90, 99, 100];

function BrowseAllCraftsModal({
  craftData,
  onClose,
  onShowResources,
}: {
  craftData: CraftData | null;
  onClose: () => void;
  onShowResources: (recipe: CraftRecipe) => void;
}) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => (craftData ? Object.values(craftData.recipesById) : []), [craftData]);
  const q = norm(query.trim());

  const groups = useMemo(() => {
    const filtered = q ? all.filter((r) => norm(r.resultItemName).includes(q)) : all;
    const byLevel = new Map<number | null, CraftRecipe[]>();
    for (const r of filtered) {
      const key = r.resultLevel;
      const arr = byLevel.get(key) ?? [];
      arr.push(r);
      byLevel.set(key, arr);
    }
    for (const arr of byLevel.values()) arr.sort((a, b) => a.resultItemName.localeCompare(b.resultItemName, 'uk'));
    const known = LEVEL_GROUP_ORDER.filter((lvl) => byLevel.has(lvl)).map((lvl) => [lvl, byLevel.get(lvl)!] as const);
    const otherLevels = [...byLevel.keys()]
      .filter((k) => k !== null && !LEVEL_GROUP_ORDER.includes(k))
      .sort((a, b) => (a as number) - (b as number))
      .map((lvl) => [lvl, byLevel.get(lvl)!] as const);
    const none = byLevel.has(null) ? [[null, byLevel.get(null)!] as const] : [];
    return [...known, ...otherLevels, ...none];
  }, [all, q]);

  return (
    <Modal title="Усе, що крафтиться з лута ХХ" onClose={onClose} wide>
      <div className="field craft-search">
        <input
          type="search"
          placeholder="Назва предмета…"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!craftData ? (
        <p className="muted center">Завантаження даних крафту…</p>
      ) : groups.length === 0 ? (
        <p className="muted center">Нічого не знайдено.</p>
      ) : (
        groups.map(([lvl, list]) => (
          <div className="craft-level-group" key={lvl ?? 'none'}>
            <div className="craft-level-head">{lvl != null ? `Рівень ${lvl}` : 'Рівень невідомий'}</div>
            <div className="craft-list">
              {list.map((r) => (
                <RecipeRow key={r.recipeId} recipe={r} onShowResources={onShowResources} />
              ))}
            </div>
          </div>
        ))
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------

function CellView({
  cell,
  tier,
  highlightIds,
  onItemClick,
}: {
  cell: LootCell;
  tier: string;
  highlightIds: Set<number>;
  onItemClick: (item: LootItem) => void;
}) {
  const visibleMobs = cell.mobs.filter((m): m is NonNullable<typeof m> => m !== null);
  const hasMobLine = visibleMobs.length > 0;
  const empty = !hasMobLine && !cell.chestLabel && !cell.items.length && !cell.quest;

  return (
    <div className="loot-cell" data-tier={tier}>
      {cell.chestLabel && <div className="loot-cell-label">{cell.chestLabel}</div>}

      {hasMobLine && (
        <div className="loot-mobs">
          {visibleMobs.map((m, i) => (
            <span key={m.id}>
              {i > 0 && <span className="loot-mob-sep"> / </span>}
              <a className="loot-mob-name loot-link" href={mobUrl(m.id)} target="_blank" rel="noopener noreferrer">
                {m.name}
              </a>
            </span>
          ))}
        </div>
      )}

      {empty && <div className="muted loot-unavailable">Недоступно</div>}

      {cell.items.length > 0 && (
        <div className="loot-items">
          {cell.items.map((it, i) => (
            <div
              key={it.id + '-' + i}
              className={'loot-item rarity-' + it.rarity + (highlightIds.has(it.id) ? ' loot-item-flash' : '')}
              title={RARITY_LABEL[it.rarity] ?? ''}
              data-item-id={it.id}
            >
              <ItemIcons item={it} />
              <button type="button" className="loot-item-name loot-item-btn" onClick={() => onItemClick(it)}>
                {it.name}
              </button>
              <span className="loot-item-lvl">{it.level}</span>
              <a
                className="loot-item-ext"
                href={itemUrl(it.id)}
                target="_blank"
                rel="noopener noreferrer"
                title="Відкрити в базі pwdatabase.net"
                onClick={(e) => e.stopPropagation()}
              >
                ↗
              </a>
            </div>
          ))}
        </div>
      )}

      {cell.quest && (
        <a className="loot-quest loot-link" href={questUrl(cell.quest.id)} target="_blank" rel="noopener noreferrer">
          📜 {cell.quest.name}
        </a>
      )}
    </div>
  );
}

/** Короткий підпис вкладки: "Розділ 1: «Золота маска»" → "Розділ 1". */
function shortTitle(title: string): string {
  return title.split(':')[0];
}

export default function LootPage() {
  const [query, setQuery] = useState('');
  const [chapterIdx, setChapterIdx] = useState(0);
  const [itemPopup, setItemPopup] = useState<{ id: number; name: string } | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());
  const [highlightNote, setHighlightNote] = useState<string | null>(null);
  const [craftData, setCraftData] = useState<CraftData | null>(null);
  const scrollTargetRef = useRef<number | null>(null);

  // Дані крафту важкі (~700 КБ) — вантажимо їх окремим файлом, а не в бандлі.
  useEffect(() => {
    let alive = true;
    loadCraftData().then((d) => {
      if (alive) setCraftData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  const q = norm(query.trim());
  const chapter = LOOT_CHAPTERS[chapterIdx];

  const rows = useMemo(
    () => chapter.rows.filter((row) => row.cells.some((c) => cellMatches(c, q))),
    [chapter, q],
  );

  // id предмета лута → у яких розділах (індексах) він трапляється.
  const itemChapters = useMemo(() => {
    const map = new Map<number, number[]>();
    LOOT_CHAPTERS.forEach((ch, ci) => {
      for (const row of ch.rows) {
        for (const cell of row.cells) {
          for (const it of cell.items) {
            const arr = map.get(it.id);
            if (arr) {
              if (!arr.includes(ci)) arr.push(ci);
            } else {
              map.set(it.id, [ci]);
            }
          }
        }
      }
    });
    return map;
  }, []);

  const itemNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const ch of LOOT_CHAPTERS) {
      for (const row of ch.rows) {
        for (const cell of row.cells) {
          for (const it of cell.items) map.set(it.id, it.name);
        }
      }
    }
    return map;
  }, []);

  function showResources(recipe: CraftRecipe) {
    const needed = recipe.materials.filter((m) => m.isLootItem).map((m) => m.itemId);
    if (!needed.length) return;

    const byChapter = new Map<number, number[]>();
    for (const id of needed) {
      for (const c of itemChapters.get(id) ?? []) {
        const arr = byChapter.get(c);
        if (arr) arr.push(id);
        else byChapter.set(c, [id]);
      }
    }
    let bestChapter = chapterIdx;
    let bestCoverage = -1;
    for (const [c, ids] of byChapter) {
      const uniq = new Set(ids).size;
      if (uniq > bestCoverage) {
        bestCoverage = uniq;
        bestChapter = c;
      }
    }
    const idsInBest = new Set(byChapter.get(bestChapter) ?? []);
    const idsElsewhere = needed.filter((id) => !idsInBest.has(id));

    setItemPopup(null);
    setBrowseOpen(false);
    setQuery('');
    setChapterIdx(bestChapter);
    setHighlightIds(idsInBest);
    scrollTargetRef.current = [...idsInBest][0] ?? null;
    setHighlightNote(
      idsElsewhere.length
        ? 'Також потрібні (в інших розділах): ' + idsElsewhere.map((id) => itemNames.get(id) ?? id).join(', ')
        : null,
    );
  }

  // Скрол до підсвіченого предмета + автоматичне згасання підсвітки.
  useEffect(() => {
    if (highlightIds.size === 0) return;
    const raf = requestAnimationFrame(() => {
      const id = scrollTargetRef.current;
      if (id != null) {
        document.querySelector(`[data-item-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    const t = setTimeout(() => {
      setHighlightIds(new Set());
      setHighlightNote(null);
    }, 3000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIds]);

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Довідник</span>
        <h2>Таблиця луту «ХХ»</h2>
        <p>
          Дроп босів трьох розділів сюжетної лінії «ХХ» — три рівні складності
          (звичайний / посилений бос) із предметами, що з них випадають. Клікни
          на предмет, щоб побачити, що з нього крафтиться.
        </p>
      </header>

      <div className="card calc-card loot-controls">
        <div className="field">
          <label>Розділ</label>
          <div className="segmented" role="radiogroup" aria-label="Розділ">
            {LOOT_CHAPTERS.map((ch, i) => (
              <span key={ch.title} style={{ display: 'contents' }}>
                <input
                  type="radio"
                  id={'lootChapter' + i}
                  name="lootChapter"
                  checked={chapterIdx === i}
                  onChange={() => setChapterIdx(i)}
                />
                <label htmlFor={'lootChapter' + i}>{shortTitle(ch.title)}</label>
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="lootSearch">Пошук</label>
          <input
            type="search"
            id="lootSearch"
            placeholder="Назва боса або предмета…"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="field loot-browse-field">
          <label>&nbsp;</label>
          <button type="button" className="btn btn-ghost" onClick={() => setBrowseOpen(true)}>
            🛠 Усе, що крафтиться
          </button>
        </div>
      </div>

      {highlightNote && (
        <div className="banner info loot-highlight-note">{highlightNote}</div>
      )}

      <div className="card loot-chapter">
        <h3 className="loot-chapter-title">{chapter.title}</h3>
        <div className="loot-grid loot-grid-head">
          {chapter.tiers.map((t) => (
            <div className="loot-tier" key={t}>{t}</div>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="muted center">Нічого не знайдено.</p>
        ) : (
          rows.map((row, ri) => (
            <div className="loot-grid" key={ri}>
              {row.cells.map((cell, ci) => (
                <CellView
                  cell={cell}
                  tier={chapter.tiers[ci]}
                  key={ci}
                  highlightIds={highlightIds}
                  onItemClick={(it) => setItemPopup({ id: it.id, name: it.name })}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {itemPopup && (
        <ItemCraftPopup
          itemId={itemPopup.id}
          itemName={itemPopup.name}
          craftData={craftData}
          onClose={() => setItemPopup(null)}
          onShowResources={showResources}
        />
      )}
      {browseOpen && (
        <BrowseAllCraftsModal craftData={craftData} onClose={() => setBrowseOpen(false)} onShowResources={showResources} />
      )}
    </>
  );
}
