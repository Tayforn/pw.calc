// =========================================================
// Таблиця луту "ХХ" — ідіоматичний React, стилі — спільні з рештою сайту.
// Дані — src/modules/loot/data.ts (статичний каталог, звірений за id
// предметів з базою елементів гри; див. коментар там-таки).
// =========================================================

import { useMemo, useState } from 'react';
import { LOOT_CHAPTERS, type LootCell, type LootItem } from '../modules/loot/data';

const RARITY_LABEL: Record<string, string> = {
  common: 'звичайний',
  rare: 'зі скринь/босів',
  special: 'особливий',
  legendary: 'унікальний',
};

/** Картки на pwdatabase.net — те саме джерело, з якого зроблено сторінку. */
const mobUrl = (id: number) => `https://www.pwdatabase.net/ru/mob/${id}`;
const itemUrl = (id: number) => `https://www.pwdatabase.net/ru/items/${id}`;
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

function CellView({ cell, tier }: { cell: LootCell; tier: string }) {
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
              className={'loot-item rarity-' + it.rarity}
              title={RARITY_LABEL[it.rarity] ?? ''}
            >
              <ItemIcons item={it} />
              <a className="loot-item-name loot-link" href={itemUrl(it.id)} target="_blank" rel="noopener noreferrer">
                {it.name}
              </a>
              <span className="loot-item-lvl">{it.level}</span>
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

  const q = norm(query.trim());
  const chapter = LOOT_CHAPTERS[chapterIdx];

  const rows = useMemo(
    () => chapter.rows.filter((row) => row.cells.some((c) => cellMatches(c, q))),
    [chapter, q],
  );

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Довідник</span>
        <h2>Таблиця луту «ХХ»</h2>
        <p>
          Дроп босів трьох розділів сюжетної лінії «ХХ» — три рівні складності
          (звичайний / посилений бос) із предметами, що з них випадають. Пошук
          шукає і серед босів, і серед предметів у поточному розділі.
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
      </div>

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
                <CellView cell={cell} tier={chapter.tiers[ci]} key={ci} />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}
