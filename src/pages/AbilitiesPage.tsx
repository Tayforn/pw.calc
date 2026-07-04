// =========================================================
// Абілки зброї — ідіоматичний React (фаза 3; legacy abilitiesInit видалено).
// Дані — src/modules/abilities/data.ts (статичний каталог).
// =========================================================

import { useMemo, useState } from 'react';
import { ABILITIES, type Ability, type AbilityCat } from '../modules/abilities/data';

const CAT_LABEL: Record<AbilityCat, string> = { buff: 'Баф', debuff: 'Дебаф', attack: 'Атака' };
const CAT_BADGE: Record<AbilityCat, string> = { buff: 'good', debuff: 'bad', attack: 'world' };

// Показуємо лише абілки з прикладом зброї (id для перевірки в базі).
const SHOWN = ABILITIES.filter((a) => a.ids.length > 0);

/** Перша літера великою (частина назв у джерелі — з малої). */
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const Dash = () => <span className="muted">—</span>;

function EnCell({ ab }: { ab: Ability }) {
  if (!ab.en)
    return <span className="abil-en-none" title="EN-назва не підтверджена (новіша абілка)">невідома</span>;
  return (
    <span className="abil-en" title={ab.verified ? 'звірено по pwdatabase' : 'за збігом ефекту з вікі — не звірено'}>
      {ab.verified ? '' : '≈ '}
      {ab.en}
    </span>
  );
}

const CATS: Array<{ id: 'all' | AbilityCat; label: string }> = [
  { id: 'all', label: 'Усі' },
  { id: 'buff', label: 'Бафи' },
  { id: 'debuff', label: 'Дебафи' },
  { id: 'attack', label: 'Атака' },
];

export default function AbilitiesPage() {
  const [cat, setCat] = useState<'all' | AbilityCat>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SHOWN.filter((ab) => {
      if (cat !== 'all' && ab.cat !== cat) return false;
      return !q || ab.search.includes(q); // індекс містить UA + оригінал RU + EN
    });
  }, [cat, query]);

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Спорядження</span>
        <h2>Абілки зброї</h2>
        <p>
          Особливі ефекти зброї («проки»), що з певним шансом спрацьовують під
          час атаки або при отриманні урону. Нижче — назва, тип, опис ефекту та
          шанс спрацювання (де він відомий). Пошук — за назвою чи ефектом.
        </p>
      </header>

      <div className="card calc-card abil-controls">
        <div className="field">
          <label htmlFor="abilSearch">Пошук</label>
          <input
            type="search"
            id="abilSearch"
            placeholder="Назва або ефект абілки…"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Тип</label>
          <div className="segmented" role="radiogroup" aria-label="Тип абілки">
            {CATS.map((c) => (
              <span key={c.id} style={{ display: 'contents' }}>
                <input
                  type="radio"
                  id={'abilCat' + c.id}
                  name="abilCat"
                  checked={cat === c.id}
                  onChange={() => setCat(c.id)}
                />
                <label htmlFor={'abilCat' + c.id}>{c.label}</label>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: 22 }}>
        <table className="data-table" id="abilTable">
          <thead>
            <tr>
              <th>Абілка</th>
              <th>Ефект</th>
              <th>Перезаписує</th>
              <th>Нотатки</th>
              <th className="num">Шанс прока</th>
              <th className="num">приклад id зброї</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((ab) => (
                <tr key={ab.name} className="abil-row">
                  <td>
                    <div className="abil-name">{cap(ab.name)}</div>
                    <div className="abil-meta">
                      <span className={'badge ' + CAT_BADGE[ab.cat]}>{CAT_LABEL[ab.cat]}</span>
                      <EnCell ab={ab} />
                    </div>
                  </td>
                  <td>{cap(ab.desc)}</td>
                  <td>{ab.overwrites || <Dash />}</td>
                  <td>{ab.notes || <Dash />}</td>
                  <td className="num">
                    {ab.proc ? <span className={'badge' + (ab.proc.startsWith('~') ? '' : ' good')}>{ab.proc}</span> : <Dash />}
                  </td>
                  <td className="num">
                    {ab.ids.length ? <span className="abil-ids" title="приклад">{ab.ids.join(', ')}</span> : <Dash />}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Нічого не знайдено.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        Показано: {rows.length} з {SHOWN.length}
      </p>

      <details className="note">
        <summary>Джерела та примітки</summary>
        <p>
          Дані зібрані з відкритих джерел спільноти Perfect World (PWI):
          загальнодоступні описи спорядження та довідники ігрових механік. Шанси
          прока наведено там, де вони задокументовані; позначка <b>~</b> означає
          приблизне або неперевірене значення. Частина новіших абілок не має
          задокументованого шансу — у таких рядках стоїть «—».
        </p>
        <p>
          Назви та описи перекладено українською <b>за допомогою ШІ</b> й вони можуть
          відрізнятися від офіційного формулювання в грі.
        </p>
        <p>
          <b>Перезаписує</b> та <b>Нотатки</b> —
          з PWpedia (англійською, для звірки з джерелом). <b>id зброї</b> — приклади
          предметів, на яких є ця абілка: встав id у базу предметів, щоб перевірити
          самостійно (порожньо — якщо абілки немає на зброї в наших даних).
        </p>
      </details>
    </>
  );
}
