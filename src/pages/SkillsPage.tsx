// =========================================================
// Уміння класів — ідіоматичний React (фаза 3).
// Дані/хелпери — src/modules/skills/data.ts (лишаються джерелом даних).
// =========================================================

import { useEffect, useState } from 'react';
import { classIconStyle, loadClasses, renderTpl, type ClassDef, type ClassSkill } from '../modules/skills/data';

const L = (n: number) => 'Рівень ' + n;

/** Парс inline-CSS рядка (background-image/position) у обʼєкт стилю React. */
export function styleFromCss(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const k = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (k) out[k] = decl.slice(i + 1).trim();
  }
  return out;
}

function InfoRow({ label, val }: { label: string; val: string }) {
  if (val == null || val === '' || val === '-') return null;
  return (
    <div className="skl-info">
      <span className="skl-info-l">{label}</span>
      <span className="skl-info-v">{val}</span>
    </div>
  );
}

function Head() {
  return (
    <header className="section-head">
      <span className="eyebrow">Скілбаза</span>
      <h2>Уміння класів</h2>
      <p>
        Дерево вмінь усіх 10 класів. Обери клас, далі — вміння у дереві.
        Кнопки рівнів (1–10) показують потрібний рівень, дух і монети та опис
        із числами для цього рівня. <span className="skl-sage-t">Рай</span> /
        <span className="skl-demon-t">Ад</span> — світла й темна культивація.
      </p>
    </header>
  );
}

export default function SkillsPage() {
  const [classes, setClasses] = useState<ClassDef[] | null>(null);
  const [ci, setCi] = useState(0);
  const [key, setKey] = useState(''); // "x,y" вибраного вміння
  const [lvl, setLvl] = useState(0); // 0..9, 10=Рай, 11=Ад

  useEffect(() => {
    let alive = true;
    loadClasses().then((c) => {
      if (!alive) return;
      setClasses(c);
      const first = c[0]?.skills[0];
      setKey(first ? first.x + ',' + first.y : '');
    });
    return () => { alive = false; };
  }, []);

  if (!classes) {
    return (
      <>
        <Head />
        <div className="card skl-classbar" id="sklClassBar"></div>
        <div className="skl-layout">
          <div className="card skl-treewrap"><div className="skl-tree" id="sklTree"></div></div>
          <div className="card skl-detail" id="sklDetail"><p className="muted skl-empty">Завантаження…</p></div>
        </div>
      </>
    );
  }

  const cls = classes[ci];
  const skill = cls.skills.find((s) => s.x + ',' + s.y === key);
  const cols = Math.max(...cls.skills.map((s) => s.x));

  const selectClass = (i: number) => {
    setCi(i);
    const first = classes[i].skills[0];
    setKey(first ? first.x + ',' + first.y : '');
    setLvl(0);
  };

  return (
    <>
      <Head />
      <div className="card skl-classbar" id="sklClassBar">
        {classes.map((c, i) => (
          <button key={c.id} type="button" className={'skl-class' + (i === ci ? ' active' : '')} onClick={() => selectClass(i)}>
            {c.ru}
          </button>
        ))}
      </div>
      <div className="skl-layout">
        <div className="card skl-treewrap">
          <div className="skl-tree" id="sklTree" style={{ ['--skl-cols' as string]: String(cols) }}>
            {cls.skills.map((s) => {
              const k = s.x + ',' + s.y;
              return (
                <button
                  key={k}
                  type="button"
                  className={'skl-tile' + (k === key ? ' active' : '')}
                  style={{ gridColumn: s.x, gridRow: s.y, ...styleFromCss(classIconStyle(s.icon, cls.page)) }}
                  aria-label={s.name}
                  onClick={() => { setKey(k); setLvl(0); }}
                />
              );
            })}
          </div>
        </div>
        <div className="card skl-detail" id="sklDetail">
          {!skill ? <p className="muted skl-empty">Оберіть вміння у дереві.</p> : <ClassDetail skill={skill} lvl={lvl} setLvl={setLvl} />}
        </div>
      </div>
    </>
  );
}

function ClassDetail({ skill, lvl, setLvl }: { skill: ClassSkill; lvl: number; setLvl: (n: number) => void }) {
  const hasSage = !!skill.sage;
  const hasDemon = !!skill.demon;
  const normLevels = Math.min(skill.stats['0']?.length ?? 1, 10);
  let cur = lvl;
  if (cur < 10 && cur >= normLevels) cur = normLevels - 1;
  if (cur === 10 && !hasSage) cur = normLevels - 1;
  if (cur === 11 && !hasDemon) cur = normLevels - 1;

  let name = skill.name;
  let tpl = skill.tpl;
  if (cur === 10 && skill.sage) { name = skill.sage.name; tpl = skill.sage.tpl; }
  if (cur === 11 && skill.demon) { name = skill.demon.name; tpl = skill.demon.tpl; }

  const lvlText = cur === 10 ? 'Світла культивація' : cur === 11 ? 'Темна культивація' : L(cur + 1);

  return (
    <>
      <div className="skl-detail-head"><h3 className="skl-name">{name}</h3><span className="skl-lvltag">{lvlText}</span></div>
      <div className="skl-levels">
        {Array.from({ length: normLevels }, (_, i) => (
          <button key={i} type="button" className={'skl-lvl' + (cur === i ? ' active' : '')} onClick={() => setLvl(i)}>{i + 1}</button>
        ))}
        {hasSage && <button type="button" className={'skl-lvl skl-sage' + (cur === 10 ? ' active' : '')} onClick={() => setLvl(10)}>Рай</button>}
        {hasDemon && <button type="button" className={'skl-lvl skl-demon' + (cur === 11 ? ' active' : '')} onClick={() => setLvl(11)}>Ад</button>}
      </div>
      <div className="skl-stats">
        <InfoRow label="Потрібний рівень" val={skill.stats['0']?.[cur] ?? ''} />
        <InfoRow label="Дух" val={skill.stats['1']?.[cur] ?? ''} />
        <InfoRow label="Монети" val={skill.stats['2']?.[cur] ?? ''} />
      </div>
      <div className="skl-text" dangerouslySetInnerHTML={{ __html: renderTpl(tpl, skill.stats, cur) }} />
    </>
  );
}
