// =========================================================
// Лялька — модалки (пікер речі/каменя, редактор речі, налаштування бафа,
// пошук бафа) + панель опонента. Розмітка/класи 1:1 з legacy; формули — lib.
// =========================================================

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  ADDON_OPTIONS,
  CLASS_BY_SM,
  SLOTS,
  maxSockets,
  defaultSockets,
  iconStyle,
  buffIconStyle,
  buffMaxLevel,
  buffHasSides,
  buffVal,
  buffEffects,
  buffDesc,
  buffDisplayName,
  lbl,
  getBuffs,
  getDebuffs,
  type Item,
  type BuffDef,
} from '../../modules/doll/data';
import { meetsReq, classRestriction, flattenItemStats } from '../../lib/doll/stats';
import { itemNameHtml, pickerReqLvl } from '../../lib/doll/tooltip';
import type { DollState, EditorTarget, OppMob, TipCtx } from '../../lib/doll/types';
import { hideTooltip } from '../../utils/tooltip';
import { styleFromCss } from '../../utils/inlineStyle';

const BUFF_PICK_HIDDEN = new Set([11, 12, 13, 14]);
const iconObj = (it: Item, cat: string, gender: 'm' | 'f') => styleFromCss(iconStyle(it, cat, gender));
const buffIconObj = (an: number) => styleFromCss(buffIconStyle(an));
function padGems(arr: Array<Item | null>, cat: string): Array<Item | null> {
  const want = defaultSockets(cat);
  const out = arr.slice();
  while (out.length < want) out.push(null);
  if (out.length > want) out.length = want;
  return out;
}

type ShowTip = (el: HTMLElement, it: Item, cat: string, ctx?: TipCtx) => void;
type TouchGate = (el: HTMLElement, show: () => void) => boolean;

interface PickUi {
  search: string;
  fit: boolean;
  sort: string;
  types: Set<string>;
}
interface PickerState {
  slot: { slot: string; cat: string; label: string } | null;
  gem: number | null;
  special: 'wdf' | 'crystal' | null;
  cat: string;
  title: string;
  hasCurrent: boolean;
  items: Item[];
}

// ============================ Пікер речі/каменя ============================
export function PickerModal({
  picker, ui, setUi, rows, total, typeIrs, build, gearAttr, onClose, onEquip, onUnequip, onBackpack, showItemTip, touchGate,
}: {
  picker: PickerState;
  ui: PickUi;
  setUi: Dispatch<SetStateAction<PickUi>>;
  rows: Item[];
  total: number;
  typeIrs: string[];
  build: DollState;
  gearAttr: Record<string, number>;
  onClose: () => void;
  onEquip: (id: number) => void;
  onUnequip: () => void;
  onBackpack: () => void;
  showItemTip: ShowTip;
  touchGate: TouchGate;
}) {
  const isGemOrSpecial = picker.gem != null || !!picker.special;
  const loading = picker.items.length === 0;
  return (
    <div className="doll-picker" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="doll-picker-box card">
        <header className="doll-picker-head">
          <h3>{picker.title}</h3>
          {picker.slot && !isGemOrSpecial && picker.hasCurrent && (
            <button type="button" className="btn btn-ghost" onClick={onBackpack}>У рюкзак</button>
          )}
          {picker.hasCurrent && (
            <button type="button" className="btn btn-ghost" onClick={onUnequip}>
              {picker.gem != null ? 'Прибрати камінь' : picker.special ? 'Прибрати' : 'Зняти'}
            </button>
          )}
          <button type="button" className="doll-picker-x" onClick={onClose} aria-label="Закрити">✕</button>
        </header>
        <input type="search" placeholder="80 (треб. ур.), назва…" autoComplete="off"
          value={ui.search} onChange={(e) => setUi((u) => ({ ...u, search: e.target.value }))} />
        {!isGemOrSpecial && (
          <div className="doll-pick-ctl">
            <label className="doll-pick-fit">
              <input type="checkbox" checked={ui.fit} onChange={(e) => setUi((u) => ({ ...u, fit: e.target.checked }))} /> лише придатні мені
            </label>
            <select value={ui.sort} onChange={(e) => setUi((u) => ({ ...u, sort: e.target.value }))} aria-label="Сортування">
              <option value="">без сортування</option>
              <option value="lvl-asc">рівень ↑</option>
              <option value="lvl-desc">рівень ↓</option>
            </select>
          </div>
        )}
        {typeIrs.length > 1 && (
          <div className="doll-pick-types">
            {typeIrs.map((ir) => (
              <label key={ir}>
                <input type="checkbox" checked={ui.types.has(ir)} onChange={(e) => setUi((u) => {
                  const s = new Set(u.types);
                  if (e.target.checked) s.add(ir); else s.delete(ir);
                  return { ...u, types: s };
                })} /> {lbl('lbls', ir)}
              </label>
            ))}
          </div>
        )}
        <p className="muted" style={{ margin: '8px 0 0' }}>
          {loading ? '' : 'Знайдено: ' + total + (total > 400 ? ' (показано 400)' : '')}
        </p>
        <div className="doll-picker-list">
          {loading ? (
            <div className="muted" style={{ padding: '18px', textAlign: 'center' }}>Завантаження…</div>
          ) : rows.length === 0 ? (
            <div className="muted" style={{ padding: '18px', textAlign: 'center' }}>Нічого не знайдено.</div>
          ) : (
            rows.map((it) => (
              <PickerRow key={it.id} it={it} picker={picker} build={build} gearAttr={gearAttr}
                onEquip={onEquip} showItemTip={showItemTip} touchGate={touchGate} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PickerRow({ it, picker, build, gearAttr, onEquip, showItemTip, touchGate }: {
  it: Item; picker: PickerState; build: DollState; gearAttr: Record<string, number>;
  onEquip: (id: number) => void; showItemTip: ShowTip; touchGate: TouchGate;
}) {
  const cat = picker.cat;
  let meta = '';
  if (picker.gem == null && !picker.special) {
    const oj = Number(it.oj) || 0;
    const cr = classRestriction(it);
    const crTxt = cr ? cr.map((n) => CLASS_BY_SM[n] || n).join(', ') : '';
    const ok = meetsReq(build, it, gearAttr).ok;
    const parts: string[] = [];
    if (oj) parts.push('Треб. ур.: ' + oj);
    else if (Number(it.hf)) parts.push('Рівень ' + it.hf);
    if (crTxt) parts.push(crTxt);
    if (parts.length) meta = '<span class="doll-pick-req' + (ok ? '' : ' bad') + '">' + parts.join(' · ') + '</span>';
  }
  return (
    <button type="button" className="doll-pick-row"
      onClick={(e) => {
        if (touchGate(e.currentTarget, () => showItemTip(e.currentTarget, it, cat))) return;
        hideTooltip();
        onEquip(Number(it.id));
      }}
      onMouseOver={(e) => showItemTip(e.currentTarget, it, cat)}
      onMouseOut={hideTooltip}>
      <span className="doll-cell sm"><span className="doll-icon" style={iconObj(it, cat, build.gender)}></span></span>
      <span className="doll-pick-name" dangerouslySetInnerHTML={{ __html: itemNameHtml(it, cat) + meta }}></span>
    </button>
  );
}

// ============================ Редактор речі ============================
export function EditorModal({
  target, tab, setTab, build, onClose, onRefine, onAddStat, onSetType, onSetVal, onDelStat,
  onOpenGem, onOpenSpecial, onDelSpecial, showItemTip, actions,
}: {
  target: EditorTarget;
  tab: 'gems' | 'addons' | 'engrave';
  setTab: (t: 'gems' | 'addons' | 'engrave') => void;
  build: DollState;
  gearAttr: Record<string, number>;
  edItemOf: (s: DollState, t: EditorTarget) => Item | null;
  edCatOf: (s: DollState, t: EditorTarget) => string;
  onClose: () => void;
  onRefine: (n: number) => void;
  onAddStat: () => void;
  onSetType: (i: number, type: string) => void;
  onSetVal: (i: number, val: number) => void;
  onDelStat: (i: number) => void;
  onOpenGem: (idx: number) => void;
  onOpenSpecial: (kind: 'wdf' | 'crystal') => void;
  onDelSpecial: (kind: 'wdf' | 'crystal') => void;
  showItemTip: ShowTip;
  actions: { remove: () => void; toBp: () => void; change: () => void; toChar: () => void; del: () => void };
}) {
  const isBp = target.kind === 'bp';
  const entry = isBp ? build.backpack[(target as { idx: number }).idx] : null;
  const it = target.kind === 'slot' ? build.equipped[target.slot] || null : entry?.item || null;
  if (!it) return null;
  const cat = target.kind === 'slot' ? SLOTS.find((d) => d.slot === target.slot)?.cat || '' : entry?.cat || '';
  const max = maxSockets(cat);
  const refine = target.kind === 'slot' ? build.refine[target.slot] || 0 : entry?.refine || 0;
  const gems = padGems(target.kind === 'slot' ? build.gems[target.slot] || [] : entry?.gems || [], cat);
  const addonsRaw = target.kind === 'slot' ? build.addons[target.slot] : entry?.addons;
  const addons = addonsRaw && addonsRaw.length ? addonsRaw : flattenItemStats(it);
  const engrave = (target.kind === 'slot' ? build.engrave[target.slot] : entry?.engrave) || [];
  const isWeapon = cat === 'ta';
  const special = (kind: 'wdf' | 'crystal') => (target.kind === 'slot' ? build[kind][target.slot] : entry?.[kind]) || null;
  const curList = tab === 'engrave' ? engrave : addons;

  const statRows = (list: Array<{ type: string; val: number }>) =>
    list.map((a, i) => (
      <div className="doll-addon-row" key={i}>
        <select className="doll-addon-type" value={a.type} onChange={(e) => onSetType(i, e.target.value)}>
          {ADDON_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select>
        <input type="number" className="doll-addon-val" value={a.val} onChange={(e) => onSetVal(i, Number(e.target.value))} />
        <button type="button" className="doll-addon-del" onClick={() => onDelStat(i)}>✕</button>
      </div>
    ));

  return (
    <div className="doll-picker doll-editor" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="doll-picker-box card">
        <button type="button" className="doll-picker-x doll-ed-close" aria-label="Закрити" onClick={onClose}>✕</button>
        <div id="dollEditorBody">
          <div className="doll-ed-head">
            <span className="doll-ref-ctrl" title="Рівень заточки (0–12)">+
              <input type="number" min={0} max={12} value={refine} onChange={(e) => onRefine(Number(e.target.value))} />
            </span>
            <span className="doll-cell"><span className="doll-icon" style={iconObj(it, cat, build.gender)}></span></span>
            <span className="doll-ed-name">{it.name}</span>
          </div>
          <div className="doll-ed-acts">
            {isBp ? (
              <>
                <button type="button" className="btn btn-primary" onClick={actions.toChar}>На персонажа</button>
                <button type="button" className="btn btn-ghost" onClick={actions.del}>Видалити</button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-ghost" onClick={actions.change}>Змінити річ</button>
                <button type="button" className="btn btn-ghost" onClick={actions.toBp}>У рюкзак</button>
                <button type="button" className="btn btn-ghost" onClick={actions.remove}>Зняти</button>
              </>
            )}
          </div>
          <div className="doll-ed-tabs">
            {max > 0 && (
              <button type="button" className={'doll-ed-tab' + (tab === 'gems' ? ' active' : '')} onClick={() => setTab('gems')}>Камені</button>
            )}
            <button type="button" className={'doll-ed-tab' + (tab === 'addons' ? ' active' : '')} onClick={() => setTab('addons')}>Характеристики</button>
            <button type="button" className={'doll-ed-tab' + (tab === 'engrave' ? ' active' : '')} onClick={() => setTab('engrave')}>Гравіювання</button>
          </div>
          <div className="doll-ed-tabbody">
            {tab === 'gems' ? (
              <>
                {max === 0 ? (
                  <div className="muted" style={{ padding: '8px 0' }}>Ця річ не має гнізд під камені.</div>
                ) : (
                  <div className="doll-sockets">
                    {gems.map((g, i) => (
                      <button type="button" key={i} className={'doll-socket' + (g ? ' is-filled' : '')} aria-label={g ? g.name : 'Порожнє гніздо'}
                        onClick={() => onOpenGem(i)}
                        onMouseOver={(e) => { if (g) showItemTip(e.currentTarget, g, 'ob', { isWeapon: target.kind === 'slot' && target.slot === 'ta' }); }}
                        onMouseOut={hideTooltip}>
                        <span className="doll-cell sm">{g && <span className="doll-icon" style={iconObj(g, 'ob', build.gender)}></span>}</span>
                      </button>
                    ))}
                  </div>
                )}
                {isWeapon && (
                  <div className="doll-specials">
                    {(['wdf', 'crystal'] as const).map((kind) => {
                      const sp = special(kind);
                      return (
                        <div className="doll-special-row" key={kind}>
                          <span className="doll-special-l">{kind === 'wdf' ? 'Шліфовка' : 'Кристал'}</span>
                          <button type="button" className="doll-special-pick" onClick={() => onOpenSpecial(kind)}>{sp ? sp.name : 'обрати…'}</button>
                          {sp && <button type="button" className="doll-addon-del" onClick={() => onDelSpecial(kind)}>✕</button>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : tab === 'addons' ? (
              <>
                <div className="doll-addons">{statRows(curList)}</div>
                <button type="button" className="btn btn-ghost" onClick={onAddStat}>+ Дод. характеристику</button>
              </>
            ) : (
              <>
                <p className="muted" style={{ margin: '0 0 8px', fontSize: '12px' }}>Гравіювання — додаткові стати речі (вибиваються в грі різцями).</p>
                <div className="doll-addons">{statRows(curList)}</div>
                <button type="button" className="btn btn-ghost" onClick={onAddStat}>+ Дод. гравіювання</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================ Налаштування бафа ============================
export function BuffCfgModal({
  buff: b, cfg: c, onClose, onLvl, onSide, onDelete,
}: {
  buff: BuffDef;
  cfg: { on: boolean; lvl: number; side: string };
  onClose: () => void;
  onLvl: (spec: string) => void;
  onSide: (side: string) => void;
  onDelete: () => void;
}) {
  const max = buffMaxLevel(b);
  const hasSides = buffHasSides(b);
  const plainMax = hasSides ? Math.max(1, max - 1) : max;
  let lvl = c.lvl;
  if (hasSides && c.side) lvl = max;
  else if (lvl > plainMax) lvl = plainMax;

  const P = (key: string): number | undefined =>
    b.lm[key] != null || b.qc[key] != null ? buffVal(b, key, lvl, c.side) : undefined;
  const params: Array<[unknown, string]> = [];
  let v: number | undefined;
  if ((v = P('oj_for_fu')) != null) params.push([v, 'требуємий рівень']);
  if ((v = P('ve')) != null) params.push([v + ' м', 'дальність']);
  if ((v = P('mp')) != null) params.push([v, 'маг. енергія']);
  if ((v = P('channel')) != null) params.push([v + ' сек', 'час активації']);
  if ((v = P('vy')) != null) params.push([v + ' сек', 'призивання']);
  if ((v = P('vw')) != null) params.push([v + ' сек', 'перезарядка']);

  const curEffects = buffEffects(b, lvl, c.side).filter((e) => e.val);
  const sideName = c.side === 'je' ? ' · темн.' : c.side === 'rs' ? ' · світл.' : '';
  const dispName = buffDisplayName(b, c.side);
  const hasDesc = curEffects.length > 0 || !!c.side;

  return (
    <div className="doll-picker doll-editor" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="doll-picker-box card doll-bcfg-box">
        <button type="button" className="doll-picker-x doll-bcfg-x" aria-label="Закрити" onClick={onClose}>✕</button>
        <div id="dollBuffCfgBody">
          <div className="doll-bcfg-head">
            <span className="doll-icon doll-bcfg-ic" style={buffIconObj(b.an)}></span>
            <div className="doll-bcfg-name">{dispName}<span className="muted"> · {lvl} ур.{sideName}</span></div>
            <button type="button" className="doll-bcfg-del" onClick={onDelete}>видалити</button>
          </div>
          <div className="doll-bcfg-stats">
            {params.map(([val, label], i) => (
              <div className="doll-bcfg-row" key={i}><b>{String(val)}</b><span>{label}</span></div>
            ))}
          </div>
          {hasDesc && (
            <>
              <div className="doll-bcfg-sep"></div>
              {c.side === 'rs' && <span className="doll-bcfg-side-tag light">☀ світла</span>}
              {c.side === 'je' && <span className="doll-bcfg-side-tag dark">🌙 темна</span>}
              {curEffects.length ? (
                curEffects.map((e, i) => <div className="doll-bcfg-desc" key={i}>{buffDesc(e.type, e.val)}</div>)
              ) : (
                <div className="doll-bcfg-desc muted">без ефекту</div>
              )}
            </>
          )}
          <div className="doll-bcfg-ctrl">
            <button type="button" onClick={() => onLvl('1')}>1 ур.</button>
            <button type="button" onClick={() => onLvl('-1')}>−1 ур.</button>
            <button type="button" onClick={() => onLvl('+1')}>+1 ур.</button>
            <button type="button" onClick={() => onLvl('10')}>10 ур.</button>
            {hasSides && (
              <>
                <button type="button" className={'doll-bcfg-side' + (c.side === 'rs' ? ' on' : '')} onClick={() => onSide('rs')}>світл.</button>
                <button type="button" className={'doll-bcfg-side' + (c.side === 'je' ? ' on' : '')} onClick={() => onSide('je')}>темн.</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================ Пошук бафа ============================
export function BuffPickModal({
  kind, classes, setClasses, q, setQ, onClose, onAdd, showBuffTip,
}: {
  kind: 'buff' | 'debuff';
  classes: Set<number>;
  setClasses: Dispatch<SetStateAction<Set<number>>>;
  q: string;
  setQ: (v: string) => void;
  onClose: () => void;
  onAdd: (id: number) => void;
  showBuffTip: (el: HTMLElement, b: BuffDef) => void;
}) {
  const bd = kind === 'debuff' ? getDebuffs() : getBuffs();
  const clsLabel = (sm: number) => (sm === 0 ? 'Загальні' : CLASS_BY_SM[sm]);
  const rows = useMemo(() => {
    if (!bd) return [] as Array<{ b: BuffDef; sm: number }>;
    const nameQ = q.trim().toLowerCase();
    // Стани з груп ("0"=глобальні), фільтр за назвою + ФІЛЬТР за класами:
    // класові бафи показуємо лише для ВІДМІЧЕНИХ класів; глобальні (sm=0)
    // без класу — показуємо завжди (для них немає чекбокса).
    const all: Array<{ b: BuffDef; sm: number }> = [];
    for (const key in bd) {
      const sm = key === '0' ? 0 : Number(key);
      if (BUFF_PICK_HIDDEN.has(sm)) continue;
      if (sm !== 0 && !classes.has(sm)) continue; // клас не відмічено — ховаємо
      for (const b of bd[key]) if (!nameQ || b.name.toLowerCase().includes(nameQ)) all.push({ b, sm });
    }
    // Сорт: класові за sm, глобальні (0) — в кінці списку.
    all.sort((a, b) => (a.sm === 0 ? 1 : 0) - (b.sm === 0 ? 1 : 0) || a.sm - b.sm);
    // Дедуп за назвою (перше входження — з меншого sm).
    const seen = new Set<string>();
    const out: Array<{ b: BuffDef; sm: number }> = [];
    for (const x of all) {
      if (seen.has(x.b.name)) continue;
      seen.add(x.b.name);
      out.push(x);
    }
    return out;
  }, [bd, classes, q]);

  return (
    <div className="doll-picker" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="doll-picker-box card">
        <header className="doll-picker-head">
          <h3>{kind === 'debuff' ? 'Додати дебаф' : 'Додати баф'}</h3>
          <button type="button" className="doll-picker-x doll-buffpick-x" aria-label="Закрити" onClick={onClose}>✕</button>
        </header>
        <input type="search" placeholder={kind === 'debuff' ? 'назва дебафа…' : 'назва бафа…'} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="doll-pick-types doll-buffpick-classes">
          {Object.keys(CLASS_BY_SM).filter((sm) => !BUFF_PICK_HIDDEN.has(Number(sm))).map((sm) => {
            const n = Number(sm);
            return (
              <label key={n}>
                <input type="checkbox" checked={classes.has(n)} onChange={(e) => setClasses((prev) => {
                  const s = new Set(prev);
                  if (e.target.checked) s.add(n); else s.delete(n);
                  return s;
                })} /> {CLASS_BY_SM[n]}
              </label>
            );
          })}
        </div>
        <div className="doll-picker-list">
          {rows.length ? (
            rows.map(({ b, sm }) => (
              <button type="button" key={b.id} className="doll-buffpick-row" onClick={() => onAdd(b.id)}
                onMouseOver={(e) => showBuffTip(e.currentTarget, b)} onMouseOut={hideTooltip}>
                <span className="doll-icon" style={buffIconObj(b.an)}></span>
                <span className="doll-buffpick-name">{b.name}<span className="muted"> · {clsLabel(sm)}</span></span>
              </button>
            ))
          ) : (
            <div className="muted" style={{ padding: '8px' }}>Нічого не знайдено.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================ Опонент (моб) ============================
export function Opponent({ opp, setOpp, oppKey }: { opp: OppMob; setOpp: Dispatch<SetStateAction<OppMob>>; oppKey: number }) {
  const f = (n: number) => n.toLocaleString('uk');
  const field = (label: string, key: keyof OppMob, extraCls = '') => (
    <label className={'doll-opp-f ' + extraCls} key={key}>
      <span className="doll-opp-l">{label}</span>
      <input type="text" inputMode="numeric" className="doll-opp-in" defaultValue={f(opp[key] as number)}
        onChange={(e) => { const v = parseFloat(e.target.value.replace(/[^\d.-]/g, '')) || 0; setOpp((o) => ({ ...o, [key]: v })); }}
        onBlur={(e) => { e.currentTarget.value = f(opp[key] as number); }} />
    </label>
  );
  return (
    <div className="doll-opp-panel" key={oppKey}>
      <div className="doll-opp-title">
        <input type="text" className="doll-opp-name" defaultValue={opp.name} aria-label="Назва суперника"
          onChange={(e) => setOpp((o) => ({ ...o, name: e.target.value }))} />
      </div>
      <div className="doll-opp-top">
        <label className="doll-opp-f hp"><span className="doll-opp-l">ЖС</span>
          <input type="text" inputMode="numeric" className="doll-opp-in" defaultValue={f(opp.hp)}
            onChange={(e) => { const v = parseFloat(e.target.value.replace(/[^\d.-]/g, '')) || 0; setOpp((o) => ({ ...o, hp: v })); }}
            onBlur={(e) => { e.currentTarget.value = f(opp.hp); }} />
        </label>
        <label className="doll-opp-f lvl"><span className="doll-opp-l">Рівень</span>
          <input type="text" inputMode="numeric" maxLength={3} className="doll-opp-in" defaultValue={f(opp.level)}
            onChange={(e) => { const v = parseFloat(e.target.value.replace(/[^\d.-]/g, '')) || 0; setOpp((o) => ({ ...o, level: v })); }}
            onBlur={(e) => { e.currentTarget.value = f(opp.level); }} />
        </label>
      </div>
      <div className="doll-opp-cols">
        <div className="doll-opp-col">
          <div className="doll-opp-col-h">Атака</div>
          {field('Мін. фіз. атака', 'physAtkMin')}
          {field('Макс. фіз. атака', 'physAtkMax')}
          {field('Мін. маг. атака', 'magAtkMin')}
          {field('Макс. маг. атака', 'magAtkMax')}
          {field('Міткість', 'acc')}
          {field('Ухилення', 'eva')}
        </div>
        <div className="doll-opp-col">
          <div className="doll-opp-col-h">Захист</div>
          {field('Фіз. захист', 'physDef')}
          {field('Метал', 'lw')}
          {field('Дерево', 'mo')}
          {field('Вода', 'dn')}
          {field('Вогонь', 'vt')}
          {field('Земля', 'sp')}
        </div>
      </div>
    </div>
  );
}
