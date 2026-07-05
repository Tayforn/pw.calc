// =========================================================
// Джинн: уміння + калькулятор білда — ідіоматичний React (фаза 3).
// Математика спорідненості — src/lib/genieCalc.ts; дані — genie.json.
// =========================================================

import { useEffect, useMemo, useState } from 'react';
import { genieIconStyle, loadGenie, renderTpl, type GenieSkill } from '../modules/skills/data';
import {
  CALC,
  CLASS_OPTS,
  ELEMENTS,
  TERRAIN_OPTS,
  affPointsAtLevel,
  affRequirements,
  affSum,
  isDisabled,
  minGenieLevel,
  neededLucky,
} from '../lib/genieCalc';
import { showTooltip, hideTooltip } from '../utils/tooltip';
import { styleFromCss } from './SkillsPage';

const L = (n: number) => 'Рівень ' + n;
const LS_KEY = 'pwc-genie-calc';

interface Persisted {
  sel?: number[];
  lvl?: string;
  lp?: string;
  cls?: number;
  ter?: number;
}
function loadState(): Persisted {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

function InfoRow({ label, val }: { label: string; val: string }) {
  if (val == null || val === '' || val === '-') return null;
  return (
    <div className="skl-info"><span className="skl-info-l">{label}</span><span className="skl-info-v">{val}</span></div>
  );
}

/** Рядок вимог спорідненості вміння (для деталки/тултіпа). */
function affRowHtml(ref: number): string {
  const c = CALC.get(ref);
  if (!c) return '';
  const chips = ELEMENTS.map((el, i) => (c.aff[i] > 0 ? `<span class="gc-aff ${el.cls}">${el.name} ${c.aff[i]}</span>` : '')).join('');
  const val = chips || '<span class="gc-aff gc-aff-none">без вимог</span>';
  return `<div class="skl-info"><span class="skl-info-l">Спорідненість</span><span class="skl-info-v gc-affline">${val}</span></div>`;
}

const COARSE = window.matchMedia('(pointer: coarse)').matches;

export default function GeniePage() {
  const [list, setList] = useState<GenieSkill[] | null>(null);
  const [cur, setCur] = useState(0);
  const [curLvl, setCurLvl] = useState(0);
  const [query, setQuery] = useState('');

  // Стан білда (persist).
  const init = useMemo(loadState, []);
  const [level, setLevel] = useState(init.lvl ?? '');
  const [lucky, setLucky] = useState(init.lp ?? '');
  const [classFilter, setClassFilter] = useState(init.cls ?? 0);
  const [terrain, setTerrain] = useState(init.ter ?? 0);
  const [picked, setPicked] = useState<number[]>(() => (init.sel ?? []).filter((r) => CALC.has(r)).slice(0, 8));
  const touchTip = useMemo(() => ({ el: null as HTMLElement | null }), []);

  useEffect(() => {
    let alive = true;
    loadGenie().then((g) => {
      if (!alive) return;
      g.sort((a, b) => a.page - b.page || a.posy - b.posy || a.posx - b.posx);
      setList(g);
    });
    return () => { alive = false; };
  }, []);

  // Персист білда.
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ sel: picked, lvl: level, lp: lucky, cls: classFilter, ter: terrain }));
    } catch {
      /* ignore */
    }
  }, [picked, level, lucky, classFilter, terrain]);

  // Ефективні рівень/удача (як у legacy userLevel/userLucky).
  const luckyN = useMemo(() => {
    const v = parseInt(lucky, 10);
    return Number.isNaN(v) ? 91 : Math.max(0, Math.min(100, v));
  }, [lucky]);
  const levelN = useMemo(() => {
    const v = parseInt(level, 10);
    return Number.isNaN(v) ? Math.min(105, luckyN * 10) : Math.max(1, Math.min(105, v));
  }, [level, luckyN]);

  const toggle = (ref: number) => {
    setPicked((prev) => {
      if (prev.includes(ref)) return prev.filter((r) => r !== ref);
      if (isDisabled(ref, prev, levelN, luckyN, classFilter, terrain) || !CALC.has(ref)) return prev;
      return [...prev, ref];
    });
  };

  const byId = useMemo(() => new Map((list ?? []).map((s) => [s.ref, s])), [list]);

  const head = (
    <header className="section-head">
      <span className="eyebrow">Скілбаза</span>
      <h2>Джинн: уміння та калькулятор білда</h2>
      <p>
        Клікай уміння в сітці — вони додаються в білд (до 8, лише один
        початковий навик). Калькулятор рахує мінімальний рівень джина,
        потрібну удачу та вимоги спорідненості стихій. Недоступні за
        рівнем, удачею чи фільтрами вміння пригасають.
      </p>
    </header>
  );

  // Підсумок білда.
  const sel = useMemo(() => picked.map((r) => CALC.get(r)!).filter(Boolean), [picked]);
  const minLvl = minGenieLevel(sel);
  const needLp = neededLucky(minLvl, sel.length);
  const maxLpAtMin = 10 * Math.floor(minLvl / 10);
  const req = affRequirements(sel);
  const reqPts = affSum(req);
  const havePts = affPointsAtLevel(levelN);
  const free = havePts - reqPts;
  const lvlErr = minLvl > levelN;
  const lpErr = needLp > luckyN;

  const q = query.trim().toLowerCase();
  const shownList = (list ?? []).map((s, i) => ({ s, i })).filter(({ s }) => !q || s.name.toLowerCase().includes(q));

  const showTip = (el: HTMLElement, s: GenieSkill) => {
    const lvlText = s.levels > 1 ? L(1) : s.lvlLabel || 'Початковий навик';
    showTooltip(
      el,
      `<div class="doll-tip-name">${escapeHtml(s.name)} <span class="muted">· ${escapeHtml(lvlText)}</span></div>` +
        infoHtml('Потрібний рівень джина', s.stats['0']?.[0] ?? '') +
        infoHtml('Дух для вивчення', s.stats['1']?.[0] ?? '') +
        affRowHtml(s.ref) +
        `<div class="doll-tip-sep"></div><div class="skl-tip-text">${renderTpl(s.tpl, s.stats, 0)}</div>`,
      320,
    );
  };

  const onTileClick = (el: HTMLElement, gi: number) => {
    const s = (list ?? [])[gi];
    if (!s) return;
    // Тач: перший тап — тултіп, другий — вибір.
    if (COARSE && touchTip.el !== el) { touchTip.el = el; showTip(el, s); return; }
    touchTip.el = null;
    hideTooltip();
    setCur(gi);
    setCurLvl(0);
    toggle(s.ref);
  };

  const detail = list?.[cur] ?? null;
  const detailLvl = detail ? (curLvl >= detail.levels ? 0 : curLvl) : 0;

  return (
    <>
      {head}

      <div className="card calc-card gc-card">
        <form className="grid-form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="gcLevel">Рівень джина</label>
            <input type="number" id="gcLevel" min={1} max={105} step={1} placeholder="105" value={level} onChange={(e) => setLevel(e.target.value)} />
            <small className="hint">Порожньо — без обмеження</small>
          </div>
          <div className="field">
            <label htmlFor="gcLucky">Удача (Lucky)</label>
            <input type="number" id="gcLucky" min={0} max={100} step={1} placeholder="91" value={lucky} onChange={(e) => setLucky(e.target.value)} />
            <small className="hint">Порожньо — 91 (на 8 умінь)</small>
          </div>
          <div className="field">
            <label htmlFor="gcClass">Клас персонажа</label>
            <select id="gcClass" value={classFilter} onChange={(e) => setClassFilter(parseInt(e.target.value, 10) || 0)}>
              <option value={0}>Будь-який</option>
              {CLASS_OPTS.map(([bit, name]) => <option key={bit} value={bit}>{name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gcTerrain">Місцевість</label>
            <select id="gcTerrain" value={terrain} onChange={(e) => setTerrain(parseInt(e.target.value, 10) || 0)}>
              <option value={0}>Будь-яка</option>
              {TERRAIN_OPTS.map(([bit, name]) => <option key={bit} value={bit}>{name}</option>)}
            </select>
          </div>
        </form>
        <div id="gcResult" className="result" aria-live="polite">
          <div className="gc-stats">
            <div className="gc-stat"><span className="gc-stat-l">Умінь</span><span className="gc-stat-v">{sel.length}/8</span></div>
            <div className="gc-stat"><span className="gc-stat-l">Мін. рівень джина</span><span className={'gc-stat-v' + (lvlErr ? ' gc-err' : '')}>{minLvl}</span></div>
            <div className="gc-stat"><span className="gc-stat-l">Потрібно удачі</span><span className={'gc-stat-v' + (lpErr ? ' gc-err' : '')}>{needLp}<small className="gc-stat-sub"> / макс. {maxLpAtMin}</small></span></div>
            <div className="gc-stat"><span className="gc-stat-l">Очок спорідненості</span><span className={'gc-stat-v' + (free < 0 ? ' gc-err' : '')}>{reqPts} з {havePts}<small className="gc-stat-sub"> (вільно {free})</small></span></div>
          </div>
          <div className="gc-affrow">
            {ELEMENTS.map((el, i) => (
              <span key={el.cls} className={'gc-aff ' + el.cls + (req[i] ? '' : ' gc-aff-zero')}>{el.name} <b>{req[i]}</b></span>
            ))}
          </div>
          {sel.length ? (
            <div className="gc-chips">
              {sel.map((c) => (
                <button key={c.ref} type="button" className="gc-chip" title="Прибрати" onClick={() => toggle(c.ref)}>
                  {byId.get(c.ref)?.name ?? String(c.ref)}<span className="gc-chip-x">✕</span>
                </button>
              ))}
              <button type="button" className="gc-clear" onClick={() => setPicked([])}>Скинути все</button>
            </div>
          ) : (
            <p className="muted gc-hint-empty">Клікай уміння в сітці нижче, щоб зібрати білд джина (до 8 умінь, лише один початковий навик).</p>
          )}
        </div>
      </div>

      <div className="card skl-toolbar">
        <input type="search" id="sklGenieSearch" className="skl-search" placeholder="Пошук вміння джина…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="skl-layout">
        <div className="card skl-treewrap">
          <div className="skl-grid" id="sklGenieGrid">
            {shownList.length === 0 ? (
              <p className="muted skl-empty">Нічого не знайдено.</p>
            ) : (
              shownList.map(({ s, i }) => {
                const state =
                  (i === cur ? ' active' : '') +
                  (picked.includes(s.ref) ? ' picked' : '') +
                  (isDisabled(s.ref, picked, levelN, luckyN, classFilter, terrain) ? ' dis' : '');
                return (
                  <button
                    key={s.ref}
                    type="button"
                    className={'skl-tile skl-tile-g' + state}
                    style={styleFromCss(genieIconStyle(s.page, s.posx, s.posy))}
                    data-gi={i}
                    aria-label={s.name}
                    onClick={(e) => onTileClick(e.currentTarget, i)}
                    onMouseOver={(e) => showTip(e.currentTarget, s)}
                    onMouseOut={() => hideTooltip()}
                  />
                );
              })
            )}
          </div>
        </div>
        <div className="card skl-detail" id="sklGenieDetail">
          {!detail ? (
            <p className="muted skl-empty">Оберіть вміння джина.</p>
          ) : (
            <>
              <div className="skl-detail-head">
                <h3 className="skl-name">{detail.name}</h3>
                <span className="skl-lvltag">{detail.levels > 1 ? L(detailLvl + 1) : detail.lvlLabel || 'Початковий навик'}</span>
              </div>
              {detail.levels > 1 && (
                <div className="skl-levels">
                  {Array.from({ length: detail.levels }, (_, i) => (
                    <button key={i} type="button" className={'skl-lvl' + (detailLvl === i ? ' active' : '')} onClick={() => setCurLvl(i)}>{i + 1}</button>
                  ))}
                </div>
              )}
              <div className="skl-stats">
                <InfoRow label="Потрібний рівень джина" val={detail.stats['0']?.[detailLvl] ?? ''} />
                <InfoRow label="Дух для вивчення" val={detail.stats['1']?.[detailLvl] ?? ''} />
                <span dangerouslySetInnerHTML={{ __html: affRowHtml(detail.ref) }} />
              </div>
              <div className="skl-text" dangerouslySetInnerHTML={{ __html: renderTpl(detail.tpl, detail.stats, detailLvl) }} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function infoHtml(label: string, val: string): string {
  if (val == null || val === '' || val === '-') return '';
  return `<div class="skl-info"><span class="skl-info-l">${escapeHtml(label)}</span><span class="skl-info-v">${escapeHtml(val)}</span></div>`;
}
