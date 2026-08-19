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
  epic: 'особливий',
  legendary: 'унікальний',
};

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
  const hasMobLine = cell.mobs.length > 0;
  const empty = !hasMobLine && !cell.chestLabel && !cell.items.length && !cell.quest;

  return (
    <div className="loot-cell" data-tier={tier}>
      {cell.chestLabel && <div className="loot-cell-label">{cell.chestLabel}</div>}

      {hasMobLine && (
        <div className="loot-mobs">
          {cell.mobs.map((m, i) => (
            <span key={i}>
              {i > 0 && <span className="loot-mob-sep"> / </span>}
              {m ? <span className="loot-mob-name">{m.name}</span> : <span className="muted">Недоступно</span>}
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
              <span className="loot-item-name">{it.name}</span>
              <span className="loot-item-lvl">{it.level}</span>
            </div>
          ))}
        </div>
      )}

      {cell.quest && <div className="loot-quest">📜 {cell.quest.name}</div>}
    </div>
  );
}

export default function LootPage() {
  const [query, setQuery] = useState('');

  const q = norm(query.trim());

  const chapters = useMemo(() => {
    if (!q) return LOOT_CHAPTERS;
    return LOOT_CHAPTERS.map((ch) => ({
      ...ch,
      rows: ch.rows.filter((row) => row.cells.some((c) => cellMatches(c, q))),
    })).filter((ch) => ch.rows.length > 0);
  }, [q]);

  const totalItems = useMemo(
    () =>
      LOOT_CHAPTERS.reduce(
        (sum, ch) => sum + ch.rows.reduce((s, r) => s + r.cells.reduce((s2, c) => s2 + c.items.length, 0), 0),
        0,
      ),
    [],
  );

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Довідник</span>
        <h2>Таблиця луту «ХХ»</h2>
        <p>
          Дроп босів трьох розділів сюжетної лінії «ХХ» — три рівні складності
          (звичайний / посилений бос) із предметами, що з них випадають. Пошук
          шукає і серед босів, і серед предметів.
        </p>
      </header>

      <div className="card calc-card loot-controls">
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

      {chapters.length === 0 ? (
        <p className="muted center">Нічого не знайдено.</p>
      ) : (
        chapters.map((ch) => (
          <div className="card loot-chapter" key={ch.title}>
            <h3 className="loot-chapter-title">{ch.title}</h3>
            <div className="loot-grid loot-grid-head">
              {ch.tiers.map((t) => (
                <div className="loot-tier" key={t}>{t}</div>
              ))}
            </div>
            {ch.rows.map((row, ri) => (
              <div className="loot-grid" key={ri}>
                {row.cells.map((cell, ci) => (
                  <CellView cell={cell} tier={ch.tiers[ci]} key={ci} />
                ))}
              </div>
            ))}
          </div>
        ))
      )}

      <details className="note">
        <summary>Джерела та примітки</summary>
        <p>
          Структуру таблиці (розділи, рівні складності, зв'язок «бос → предмет»)
          узято з довідника спільноти Perfect World: форум <b>pwonline.ru</b> та{' '}
          <b>pwdatabase.net</b>.
        </p>
        <p>
          Назви <b>предметів і босів</b> — офіційний український переклад
          клієнта гри, звірений напряму за id з бінарної бази гри (той самий
          id, що й у довіднику спільноти) — це не машинний переклад.
        </p>
        <p>
          Іконки предметів — той самий спрайт-лист, що й на сторінці-джерелі
          (pwdatabase.net-стилю), не з клієнта гри.
        </p>
        <p>
          Кольором ліворуч від предмета позначено тип дропу: сірий — звичайний
          дроп боса, фіолетовий — додатковий («особливий») дроп того самого
          боса, синій — спільна нагорода зі скринь/убитих босів розділу,
          золотий — унікальний предмет верхнього рівня. Усього в таблиці{' '}
          {totalItems} предметів.
        </p>
      </details>
    </>
  );
}
