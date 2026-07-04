// =========================================================
// Лялька персонажа — ідіоматичний React (фаза 3).
// Формули — чисті модулі src/lib/doll/* (винесені byte-у-байт із legacy).
// Тут: стан білду (localStorage), похідні через useMemo, підпанелі, 4 модалки,
// тултіпи (спільний util), drag-drop / ПКМ / тач-гейт.
// =========================================================

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SLOTS,
  ADDON_OPTIONS,
  XZ,
  CLASS_BY_SM,
  defaultSockets,
  maxSockets,
  iconStyle,
  buffIconStyle,
  buffMaxLevel,
  buffHasSides,
  buffVal,
  buffEffects,
  buffDesc,
  buffDisplayName,
  lbl,
  loadCat,
  loadLabels,
  loadSets,
  loadBuffs,
  loadSkills,
  getBuffs,
  getBuffById,
  getSkills,
  ASSET_BASE,
  type Item,
  type SlotDef,
  type BuffDef,
} from '../modules/doll/data';
import {
  computeStats,
  meetsReq,
  availPoints,
  flattenItemStats,
  classRestriction,
  ATTR_BASE,
  TITLE_LIMIT,
  TITLE_FIELDS,
} from '../lib/doll/stats';
import { deriveIb, shownBuffs, buffCfgRead, buffTipHtml } from '../lib/doll/buffs';
import { DEFAULT_OPP, computeSkillDamage, dmgLogLine } from '../lib/doll/damage';
import { itemTipHtml, slotTipCtx, bpTipCtx, itemNameHtml, pickerReqLvl } from '../lib/doll/tooltip';
import { computeSummary } from '../lib/doll/summary';
import { defaultState, type DollState, type BackpackEntry, type OppMob, type EditorTarget, type SavedBuild } from '../lib/doll/types';
import { showTooltip, hideTooltip } from '../utils/tooltip';
import { escHtml } from '../utils/format';
import { styleFromCss } from '../utils/inlineStyle';
import { PickerModal, EditorModal, BuffCfgModal, BuffPickModal, Opponent } from './doll/DollModals';

const LS_KEY = 'pwDollBuild';
const LS_HISTORY = 'pwDollHistory';
const LS_OPP = 'pwDollOpp';
const INV_SIZE = 40; // 8×5

// Тач-екрани (без hover): перший тап показує тултіп, другий — виконує дію.
const COARSE_PTR = window.matchMedia('(pointer: coarse)').matches;

const iconStyleObj = (it: Item, cat: string, gender: 'm' | 'f') => styleFromCss(iconStyle(it, cat, gender));
const buffIconObj = (an: number) => styleFromCss(buffIconStyle(an));

/** Перше число з тексту стата (для напряму фліш-підсвітки). */
function statNum(s: string): number {
  const m = s.replace(/[ \s]/g, '').replace(/−/g, '-').match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : NaN;
}

/** Привести масив гнізд до фіксованої довжини (копія, без мутації джерела). */
function padGems(arr: Array<Item | null>, cat: string): Array<Item | null> {
  const want = defaultSockets(cat);
  const out = arr.slice();
  while (out.length < want) out.push(null);
  if (out.length > want) out.length = want;
  return out;
}

function loadState(): DollState {
  const s = defaultState();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return s;
}
function loadOpp(): OppMob {
  try {
    const raw = localStorage.getItem(LS_OPP);
    if (raw) return { ...DEFAULT_OPP, ...(JSON.parse(raw) as Partial<OppMob>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_OPP };
}
function loadHistory(): SavedBuild[] {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]') as SavedBuild[];
  } catch {
    return [];
  }
}

// Класи, відсутні на сервері — не пропонуємо в пікері бафів.
const BUFF_PICK_HIDDEN = new Set([11, 12, 13, 14]);
const MOD_HINTS: Record<string, string> = {
  buffs: 'чекбокс — активувати; клік по іконці — налаштування; «+» — додати',
  titles: 'сумарні доповнення від титулів — вводяться вручну, як у грі; кап 3000',
};

// ---- Стан пікера речі/каменя ----
interface PickerState {
  slot: SlotDef | null;
  gem: number | null; // idx гнізда
  special: 'wdf' | 'crystal' | null;
  cat: string;
  title: string;
  hasCurrent: boolean;
  items: Item[];
}

type EditorTab = 'gems' | 'addons' | 'engrave';

export default function DollPage() {
  const [build, setBuild] = useState<DollState>(loadState);
  const [opp, setOpp] = useState<OppMob>(loadOpp);
  const [history, setHistory] = useState<SavedBuild[]>(loadHistory);
  const [dmgLog, setDmgLog] = useState<string[]>([]);
  const [dmgCheckOn, setDmgCheckOn] = useState(false);
  const [ready, setReady] = useState(0); // тік завантаження даних (labels/sets/buffs/skills)
  const [classLabels, setClassLabels] = useState<Record<string, string>>({});
  const [modTab, setModTab] = useState<'buffs' | 'titles'>('buffs');
  const [headerKey, setHeaderKey] = useState(0); // ремонт хедер-інпутів після load/reset
  const [oppKey, setOppKey] = useState(0);
  const [buildName, setBuildName] = useState('');

  // Модалки
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [pickUi, setPickUi] = useState({ search: '', fit: false, sort: '', types: new Set<string>() });
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>('gems');
  const [buffCfgId, setBuffCfgId] = useState<number | null>(null);
  const [buffPickOpen, setBuffPickOpen] = useState(false);
  const [buffPickClasses, setBuffPickClasses] = useState<Set<number>>(new Set());
  const [buffPickQ, setBuffPickQ] = useState('');

  const buildRef = useRef(build);
  buildRef.current = build;
  const touchTipRef = useRef<HTMLElement | null>(null);

  // ---- Похідні ----
  const { t, gearAttr } = useMemo(() => computeStats(build), [build, ready]);
  const ib = useMemo(() => deriveIb(build), [build, ready]);
  const summary = useMemo(() => computeSummary(build, t, ib), [build, t, ib]);
  const avail = availPoints(build);

  // ---- Persist ----
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(build));
    } catch {
      /* ignore */
    }
  }, [build]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_OPP, JSON.stringify(opp));
    } catch {
      /* ignore */
    }
  }, [opp]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(0, 20)));
    } catch {
      /* ignore */
    }
  }, [history]);

  // ---- Завантаження даних ----
  useEffect(() => {
    document.documentElement.style.setProperty('--doll-cell-bg', "url('" + ASSET_BASE + "items/item-cells.png')");
    let alive = true;
    const bump = () => alive && setReady((x) => x + 1);
    loadLabels().then((l) => {
      if (!alive) return;
      setClassLabels(l.ee);
      bump();
    });
    loadSets().then(bump);
    loadBuffs().then(bump);
    loadSkills().then(bump);
    return () => {
      alive = false;
    };
  }, []);

  // ---- Мутація білду ----
  const mutate = useCallback((fn: (s: DollState) => void) => {
    setBuild((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  // ================= Тултіпи =================
  const touchGate = (el: HTMLElement, show: () => void): boolean => {
    if (!COARSE_PTR) return false;
    if (touchTipRef.current === el) {
      touchTipRef.current = null;
      return false;
    }
    touchTipRef.current = el;
    show();
    return true;
  };
  const showItemTip = (el: HTMLElement, it: Item, cat: string, ctx?: Parameters<typeof itemTipHtml>[4]) =>
    showTooltip(el, itemTipHtml(buildRef.current, it, cat, gearAttr, ctx));

  // ================= Хелпери редактора =================
  const edItemOf = (s: DollState, target: EditorTarget): Item | null =>
    target.kind === 'slot' ? s.equipped[target.slot] || null : s.backpack[target.idx]?.item || null;
  const edCatOf = (s: DollState, target: EditorTarget): string => {
    if (target.kind === 'slot') return SLOTS.find((d) => d.slot === target.slot)?.cat || '';
    return s.backpack[target.idx]?.cat || '';
  };
  /** Живий (draft) список редаговних статів для активної вкладки — з матеріалізацією базових. */
  const curList = (s: DollState, target: EditorTarget, tab: EditorTab, it: Item | null): Array<{ type: string; val: number }> => {
    if (tab === 'engrave') {
      if (target.kind === 'slot') return (s.engrave[target.slot] ||= []);
      const e = s.backpack[target.idx];
      if (!e) return [];
      return (e.engrave ||= []);
    }
    if (target.kind === 'slot') {
      const cur = s.addons[target.slot];
      if ((!cur || !cur.length) && it) s.addons[target.slot] = flattenItemStats(it);
      return (s.addons[target.slot] ||= []);
    }
    const e = s.backpack[target.idx];
    if (!e) return [];
    if ((!e.addons || !e.addons.length) && it) e.addons = flattenItemStats(it);
    return (e.addons ||= []);
  };
  const draftGems = (s: DollState, target: EditorTarget, cat: string): Array<Item | null> => {
    if (target.kind === 'slot') {
      s.gems[target.slot] = padGems(s.gems[target.slot] || [], cat);
      return s.gems[target.slot];
    }
    const e = s.backpack[target.idx];
    if (!e) return [];
    e.gems = padGems(e.gems || [], e.cat);
    return e.gems;
  };
  const setSpecial = (s: DollState, target: EditorTarget, kind: 'wdf' | 'crystal', it: Item | null) => {
    if (target.kind === 'slot') s[kind][target.slot] = it;
    else {
      const e = s.backpack[target.idx];
      if (e) e[kind] = it;
    }
  };

  // ================= Слоти / спорядження =================
  const clearSlot = (s: DollState, slot: string) => {
    delete s.equipped[slot];
    delete s.gems[slot];
    delete s.refine[slot];
    delete s.addons[slot];
    delete s.engrave[slot];
    delete s.wdf[slot];
    delete s.crystal[slot];
  };
  const entryFromSlot = (s: DollState, slot: string): BackpackEntry | null => {
    const it = s.equipped[slot];
    if (!it) return null;
    const def = SLOTS.find((d) => d.slot === slot);
    return {
      item: it,
      slot,
      cat: def ? def.cat : slot,
      gems: s.gems[slot] || [],
      refine: s.refine[slot] || 0,
      addons: s.addons[slot] || [],
      engrave: s.engrave[slot] || [],
      wdf: s.wdf[slot] || null,
      crystal: s.crystal[slot] || null,
    };
  };
  const firstFreeCell = (s: DollState): number => {
    for (let i = 0; i < INV_SIZE; i++) if (!s.backpack[i]) return i;
    return -1;
  };
  const toBackpack = (s: DollState, slot: string, cellIdx?: number) => {
    const e = entryFromSlot(s, slot);
    if (!e) return;
    const idx = cellIdx != null && !s.backpack[cellIdx] ? cellIdx : firstFreeCell(s);
    if (idx < 0) return;
    s.backpack[idx] = e;
    clearSlot(s, slot);
  };
  const fromBackpack = (s: DollState, idx: number) => {
    const e = s.backpack[idx];
    if (!e) return;
    let slot = e.slot;
    if (s.equipped[slot]) {
      if (e.cat === 'oq') slot = slot === 'cr' ? 'cd' : 'cr';
      if (s.equipped[slot]) return;
    }
    s.equipped[slot] = e.item;
    s.gems[slot] = e.gems;
    s.refine[slot] = e.refine;
    s.addons[slot] = e.addons || [];
    s.engrave[slot] = e.engrave || [];
    s.wdf[slot] = e.wdf || null;
    s.crystal[slot] = e.crystal || null;
    s.backpack[idx] = null;
  };
  const equipFromBp = (s: DollState, idx: number, targetSlot: string) => {
    const e = s.backpack[idx];
    if (!e) return;
    const def = SLOTS.find((d) => d.slot === targetSlot);
    if (!def || def.cat !== e.cat) return;
    const occ = s.equipped[targetSlot] ? entryFromSlot(s, targetSlot) : null;
    s.equipped[targetSlot] = e.item;
    s.gems[targetSlot] = e.gems;
    s.refine[targetSlot] = e.refine;
    s.addons[targetSlot] = e.addons || [];
    s.engrave[targetSlot] = e.engrave || [];
    s.wdf[targetSlot] = e.wdf || null;
    s.crystal[targetSlot] = e.crystal || null;
    s.backpack[idx] = occ;
  };
  const bpEquipSwap = (s: DollState, idx: number) => {
    const e = s.backpack[idx];
    if (!e) return;
    let slot = e.slot;
    if (e.cat === 'oq' && s.equipped[slot]) {
      const other = slot === 'cr' ? 'cd' : 'cr';
      if (!s.equipped[other]) slot = other;
    }
    equipFromBp(s, idx, slot);
  };
  const moveCell = (s: DollState, from: number, to: number) => {
    if (from === to) return;
    const tmp = s.backpack[to] || null;
    s.backpack[to] = s.backpack[from] || null;
    s.backpack[from] = tmp;
  };

  // ================= Пікер =================
  const openPicker = async (slotKey: string) => {
    const slot = SLOTS.find((s) => s.slot === slotKey);
    if (!slot) return;
    setPickUi({ search: '', fit: false, sort: '', types: new Set() });
    setPicker({ slot, gem: null, special: null, cat: slot.cat, title: slot.label, hasCurrent: !!build.equipped[slot.slot], items: [] });
    const items = await loadCat(slot.cat);
    setPicker((p) => (p && p.slot?.slot === slotKey && !p.gem && !p.special ? { ...p, items } : p));
  };
  const openGemPicker = async (idx: number) => {
    if (!editor) return;
    setPickUi({ search: '', fit: false, sort: '', types: new Set() });
    setPicker({ slot: null, gem: idx, special: null, cat: 'ob', title: 'Камінь — гніздо ' + (idx + 1), hasCurrent: !!draftGems(structuredClone(build), editor, edCatOf(build, editor))[idx], items: [] });
    const items = await loadCat('ob');
    setPicker((p) => (p && p.gem === idx ? { ...p, items } : p));
  };
  const openSpecialPicker = async (kind: 'wdf' | 'crystal') => {
    if (!editor) return;
    const cur = editor.kind === 'slot' ? build[kind][editor.slot] : build.backpack[editor.idx]?.[kind];
    setPickUi({ search: '', fit: false, sort: '', types: new Set() });
    setPicker({ slot: null, gem: null, special: kind, cat: kind, title: kind === 'wdf' ? 'Шліфовка (руна)' : 'Кристал', hasCurrent: !!cur, items: [] });
    const items = await loadCat(kind);
    setPicker((p) => (p && p.special === kind ? { ...p, items } : p));
  };
  const closePicker = () => setPicker(null);

  const pickerEquip = (id: number) => {
    const ps = picker;
    if (!ps) return;
    const it = ps.items.find((x) => Number(x.id) === id);
    if (!it) return;
    if (ps.gem != null && editor) {
      mutate((s) => {
        draftGems(s, editor, edCatOf(s, editor))[ps.gem as number] = it;
      });
    } else if (ps.special && editor) {
      mutate((s) => setSpecial(s, editor, ps.special!, it));
    } else if (ps.slot) {
      const slot = ps.slot.slot;
      const cat = ps.slot.cat;
      mutate((s) => {
        s.equipped[slot] = it;
        const n = defaultSockets(cat);
        s.gems[slot] = n > 0 ? new Array(n).fill(null) : [];
        s.refine[slot] = 0;
        s.addons[slot] = [];
        s.engrave[slot] = [];
        s.wdf[slot] = null;
        s.crystal[slot] = null;
      });
    }
    closePicker();
  };
  const pickerUnequip = () => {
    const ps = picker;
    if (!ps) return;
    if (ps.gem != null && editor) mutate((s) => (draftGems(s, editor, edCatOf(s, editor))[ps.gem as number] = null));
    else if (ps.special && editor) mutate((s) => setSpecial(s, editor, ps.special!, null));
    else if (ps.slot) mutate((s) => clearSlot(s, ps.slot!.slot));
    closePicker();
  };

  // Відфільтрований список пікера.
  const pickerRows = useMemo(() => {
    if (!picker) return { rows: [] as Item[], total: 0 };
    const q = pickUi.search;
    const m = q.trim().toLowerCase().match(/^(\d+)\s*(.*)$/);
    const lvlQ = m ? Number(m[1]) : null;
    const nameQ = m ? m[2].trim() : q.trim().toLowerCase();
    const isGem = picker.gem != null;
    const types = isGem || picker.special ? new Set<string>() : pickUi.types;
    const fitOnly = !isGem && !picker.special && pickUi.fit;
    const gemHost = isGem && editor ? edItemOf(build, editor) : null;
    const gemHostCat = isGem && editor ? edCatOf(build, editor) : '';
    const gemHostHf = Number(gemHost?.hf) || 0;
    const gemOk = (g: Item): boolean => {
      if (!isGem) return true;
      if (gemHostHf && (Number(g.hf) || 0) > gemHostHf) return false;
      if (['ft', 'rv', 'tg', 'rx', 'ta', 'wy', 'mj'].includes(gemHostCat) && g.pg !== 'generic') return false;
      return true;
    };
    const seen = new Set<string>();
    const rows = picker.items.filter((it) => {
      if (!gemOk(it)) return false;
      if (lvlQ != null && pickerReqLvl(it) !== lvlQ) return false;
      if (nameQ && !it.name.toLowerCase().includes(nameQ)) return false;
      if (types.size && !types.has(it.ir as string)) return false;
      if (fitOnly && !meetsReq(build, it, gearAttr).ok) return false;
      const o = it as Record<string, unknown>;
      const key = it.name + '|' + o.an + '|' + (it.oj ?? '') + '|' + (o.tv ?? '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (pickUi.sort === 'lvl-asc') rows.sort((a, b) => pickerReqLvl(a) - pickerReqLvl(b));
    else if (pickUi.sort === 'lvl-desc') rows.sort((a, b) => pickerReqLvl(b) - pickerReqLvl(a));
    return { rows: rows.slice(0, 400), total: rows.length };
  }, [picker, pickUi, build, gearAttr, editor]);

  const pickerTypeIrs = useMemo(() => {
    if (!picker || picker.gem != null || picker.special) return [] as string[];
    return [...new Set(picker.items.map((it) => it.ir).filter((x): x is string => !!x))];
  }, [picker]);

  // ================= Редактор дій =================
  const openEditor = (target: EditorTarget) => {
    setEditor(target);
    setEditorTab(maxSockets(edCatOf(build, target)) > 0 ? 'gems' : 'addons');
  };
  const closeEditor = () => setEditor(null);
  const edSetRefine = (n: number) => {
    if (!editor) return;
    const v = Math.max(0, Math.min(12, Math.floor(n) || 0));
    mutate((s) => {
      if (editor.kind === 'slot') s.refine[editor.slot] = v;
      else {
        const e = s.backpack[editor.idx];
        if (e) e.refine = v;
      }
    });
  };
  const edAddStat = () => {
    if (!editor) return;
    mutate((s) => curList(s, editor, editorTab, edItemOf(s, editor)).push({ type: ADDON_OPTIONS[0].code, val: 0 }));
  };
  const edSetAddonType = (i: number, type: string) => {
    if (!editor) return;
    mutate((s) => {
      const a = curList(s, editor, editorTab, edItemOf(s, editor));
      if (a[i]) a[i].type = type;
    });
  };
  const edSetAddonVal = (i: number, val: number) => {
    if (!editor) return;
    mutate((s) => {
      const a = curList(s, editor, editorTab, edItemOf(s, editor));
      if (a[i]) a[i].val = Number(val) || 0;
    });
  };
  const edDelAddon = (i: number) => {
    if (!editor) return;
    mutate((s) => curList(s, editor, editorTab, edItemOf(s, editor)).splice(i, 1));
  };

  // ================= Бафи =================
  const toggleBuffOn = (id: number) =>
    mutate((s) => {
      const k = String(id);
      if (!s.buffCfg[k]) s.buffCfg[k] = { on: false, lvl: 10, side: '' };
      s.buffCfg[k].on = !s.buffCfg[k].on;
    });
  const openBuffCfg = (id: number) => setBuffCfgId(id);
  const setBuffLvl = (spec: string) => {
    if (buffCfgId == null) return;
    const b = getBuffById(buffCfgId);
    if (!b) return;
    const max = buffMaxLevel(b);
    const plainMax = buffHasSides(b) ? Math.max(1, max - 1) : max;
    mutate((s) => {
      const k = String(buffCfgId);
      if (!s.buffCfg[k]) s.buffCfg[k] = { on: false, lvl: 10, side: '' };
      const c = s.buffCfg[k];
      if (c.side) {
        if (spec === '+1') return;
        c.lvl = spec === '-1' ? plainMax : Math.max(1, Math.min(plainMax, Number(spec) || 1));
      } else {
        if (spec === '+1') c.lvl = Math.min(plainMax, c.lvl + 1);
        else if (spec === '-1') c.lvl = Math.max(1, c.lvl - 1);
        else c.lvl = Math.max(1, Math.min(plainMax, Number(spec) || 1));
      }
      c.side = '';
    });
  };
  const setBuffSide = (side: string) => {
    if (buffCfgId == null) return;
    const b = getBuffById(buffCfgId);
    if (!b || !buffHasSides(b)) return;
    mutate((s) => {
      const k = String(buffCfgId);
      if (!s.buffCfg[k]) s.buffCfg[k] = { on: false, lvl: 10, side: '' };
      s.buffCfg[k].side = side;
      s.buffCfg[k].lvl = buffMaxLevel(b);
    });
  };
  const deleteBuff = () => {
    if (buffCfgId == null) return;
    const id = buffCfgId;
    mutate((s) => {
      delete s.buffCfg[String(id)];
      const i = s.extraBuffs.indexOf(id);
      if (i >= 0) s.extraBuffs.splice(i, 1);
    });
    setBuffCfgId(null);
  };
  const openBuffPick = () => {
    setBuffPickClasses(new Set([XZ[build.cls] || 1]));
    setBuffPickQ('');
    setBuffPickOpen(true);
  };
  const addBuff = (id: number) => {
    mutate((s) => {
      if (!s.extraBuffs.includes(id)) s.extraBuffs.push(id);
      const k = String(id);
      if (!s.buffCfg[k]) s.buffCfg[k] = { on: false, lvl: 10, side: '' };
      s.buffCfg[k].on = true;
    });
    setBuffPickOpen(false);
  };

  // ================= Дамаг =================
  const logSkillDamage = (skillId: number) => {
    const list = getSkills()?.[String(XZ[build.cls] || 1)] || [];
    const sk = list.find((x) => x.id === skillId);
    if (!sk) return;
    const d = computeSkillDamage(summary.char, opp, sk, build.level, t, ib);
    setDmgLog((prev) => [dmgLogLine(opp.name, sk, d), ...prev].slice(0, 200));
  };

  // ================= Історія =================
  const saveBuild = () => {
    const name = buildName.trim();
    setHistory((h) => [{ name: name || 'Білд ' + (h.length + 1), ts: Date.now(), state: structuredClone(build) }, ...h].slice(0, 20));
    setBuildName('');
  };
  const loadBuild = (idx: number) => {
    const b = history[idx];
    if (!b) return;
    setBuild(structuredClone(b.state));
    setHeaderKey((k) => k + 1);
  };
  const deleteBuild = (idx: number) => setHistory((h) => h.filter((_, i) => i !== idx));

  // ================= Хедер / атрибути =================
  const resetAll = () => {
    if (!window.confirm('Скинути все спорядження, камені, заточку, стани й атрибути?')) return;
    setBuild((prev) => {
      const s = defaultState();
      s.cls = prev.cls;
      s.gender = prev.gender;
      s.level = prev.level;
      s.server = prev.server;
      return s;
    });
    setHeaderKey((k) => k + 1);
  };
  const commitAttr = (key: 'str' | 'dex' | 'vit' | 'mag', raw: string) => {
    mutate((s) => {
      let v = Math.max(ATTR_BASE, Number(raw) || 0);
      s[key] = v;
      const over = -availPoints(s);
      if (over > 0) v = Math.max(ATTR_BASE, v - over);
      s[key] = v;
    });
  };

  // ================= Фліш зведення =================
  const prevSummaryRef = useRef<Record<string, string>>({});
  const flash: Record<number, string> = {};
  summary.cells.forEach((c, i) => {
    const old = prevSummaryRef.current[c.label];
    if (old != null && old !== c.val) {
      const a = statNum(old);
      const b = statNum(c.val);
      if (!Number.isNaN(a) && !Number.isNaN(b) && a !== b) flash[i] = b > a ? 'flash-up' : 'flash-down';
    }
  });
  useEffect(() => {
    const m: Record<string, string> = {};
    summary.cells.forEach((c) => (m[c.label] = c.val));
    prevSummaryRef.current = m;
  }, [summary]);

  // ================= Esc закриває модалки =================
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (picker) setPicker(null);
      else if (editor) setEditor(null);
      else if (buffPickOpen) setBuffPickOpen(false);
      else if (buffCfgId != null) setBuffCfgId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [picker, editor, buffPickOpen, buffCfgId]);

  // ================= Drag-and-drop =================
  const dragSrcRef = useRef<EditorTarget | null>(null);
  const dragCatRef = useRef<string | undefined>(undefined);
  const lastDropRef = useRef<HTMLElement | null>(null);
  const markDrop = (el: HTMLElement | null, ok: boolean) => {
    if (lastDropRef.current && lastDropRef.current !== el) lastDropRef.current.classList.remove('drop-ok');
    if (el && ok) {
      el.classList.add('drop-ok');
      lastDropRef.current = el;
    } else if (!el) lastDropRef.current = null;
  };
  const clearDrop = () => {
    if (lastDropRef.current) lastDropRef.current.classList.remove('drop-ok');
    lastDropRef.current = null;
  };
  const startDrag = (e: React.DragEvent) => {
    hideTooltip();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'x');
    }
  };
  useEffect(() => {
    const onEnd = () => {
      clearDrop();
      dragSrcRef.current = null;
    };
    document.addEventListener('dragend', onEnd);
    return () => document.removeEventListener('dragend', onEnd);
  }, []);

  // ================= Дані для рендера =================
  const buffs = shownBuffs(build);
  const buffsLoaded = !!getBuffs();
  const skillList = (getSkills()?.[String(XZ[build.cls] || 1)] || []).filter((sk) => sk.name);
  const activeBuffCfg = buffCfgId != null ? getBuffById(buffCfgId) : null;

  return (
    <>
      <header className="section-head doll-head">
        <div>
          <span className="eyebrow">Спорядження</span>
          <h2>Лялька персонажа</h2>
        </div>
        <button type="button" className="btn btn-ghost" onClick={resetAll}>↺ Скинути все</button>
      </header>

      {/* ---- Хедер персонажа ---- */}
      <div className="card calc-card doll-header" key={'hdr-' + headerKey}>
        <div className="field">
          <label htmlFor="dollClass">Клас</label>
          <select id="dollClass" value={build.cls} onChange={(e) => mutate((s) => (s.cls = e.target.value))}>
            {Object.entries(classLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Стать</label>
          <div className="segmented" role="radiogroup" aria-label="Стать">
            <input type="radio" id="dollGenderM" name="dollGender" value="m" checked={build.gender === 'm'} onChange={() => mutate((s) => (s.gender = 'm'))} />
            <label htmlFor="dollGenderM">Чол.</label>
            <input type="radio" id="dollGenderF" name="dollGender" value="f" checked={build.gender === 'f'} onChange={() => mutate((s) => (s.gender = 'f'))} />
            <label htmlFor="dollGenderF">Жін.</label>
          </div>
        </div>
        <div className="field">
          <label htmlFor="dollLevel">Рівень</label>
          <input type="number" id="dollLevel" min={1} max={200} defaultValue={build.level}
            onChange={(e) => mutate((s) => (s.level = Number(e.target.value) || 0))}
            onBlur={(e) => (e.currentTarget.value = String(buildRef.current.level))} />
        </div>
        <AttrField id="dollStr" label="Сила" k="str" build={build} bonus={t.om || 0} commit={commitAttr} ref2={buildRef} />
        <AttrField id="dollDex" label="Спритність" k="dex" build={build} bonus={t.uy || 0} commit={commitAttr} ref2={buildRef} />
        <AttrField id="dollVit" label="Тілобудова" k="vit" build={build} bonus={t.lf || 0} commit={commitAttr} ref2={buildRef} />
        <AttrField id="dollMag" label="Інтелект" k="mag" build={build} bonus={t.tx || 0} commit={commitAttr} ref2={buildRef} />
        <div className="field doll-avail">
          <label>Доступно очок</label>
          <div className={'doll-avail-v' + (avail < 0 ? ' over' : '')}>{avail}</div>
        </div>
      </div>

      {/* ---- Модифікатори: Бафи | Титули ---- */}
      <div className="card calc-card">
        <div className="doll-mods-head">
          <div className="segmented" role="tablist" aria-label="Модифікатори">
            <input type="radio" id="dollModTabBuffs" name="dollModTab" value="buffs" checked={modTab === 'buffs'} onChange={() => setModTab('buffs')} />
            <label htmlFor="dollModTabBuffs">Бафи</label>
            <input type="radio" id="dollModTabTitles" name="dollModTab" value="titles" checked={modTab === 'titles'} onChange={() => setModTab('titles')} />
            <label htmlFor="dollModTabTitles">Титули</label>
          </div>
          <span className="muted doll-mods-hint">{MOD_HINTS[modTab]}</span>
        </div>
        <div hidden={modTab !== 'buffs'}>
          <div className="doll-buffs">
            {!buffsLoaded ? (
              <div className="muted" style={{ padding: '6px 0' }}>Завантаження…</div>
            ) : (
              <>
                {buffs.map((b) => {
                  const on = !!build.buffCfg[String(b.id)]?.on;
                  return (
                    <div className="doll-buff-slot" key={b.id}>
                      <button type="button" className={'doll-buff-ic' + (on ? ' on' : '')}
                        onClick={() => openBuffCfg(b.id)}
                        onMouseOver={(e) => showTooltip(e.currentTarget, buffTipHtml(buildRef.current, b))}
                        onMouseOut={hideTooltip}>
                        <span className="doll-icon" style={buffIconObj(b.an)}></span>
                      </button>
                      <input type="checkbox" className="doll-buff-cb" checked={on} title="Активувати" onChange={() => toggleBuffOn(b.id)} />
                    </div>
                  );
                })}
                <div className="doll-buff-slot">
                  <button type="button" className="doll-buff-ic empty" title="Додати баф" onClick={openBuffPick}>+</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div hidden={modTab !== 'titles'}>
          <div className="doll-titles">
            {TITLE_FIELDS.map((fd) => {
              const v = Math.round(Number(build.titles[fd.code]) || 0) || 0;
              return (
                <label className="doll-title-f" key={fd.code}>
                  <span>{fd.label}</span>
                  <input type="number" min={0} max={TITLE_LIMIT} step={1} value={v}
                    onChange={(e) => {
                      const nv = Math.max(0, Math.min(TITLE_LIMIT, Math.round(Number(e.target.value) || 0)));
                      mutate((s) => {
                        if (nv) s.titles[fd.code] = nv;
                        else delete s.titles[fd.code];
                      });
                    }} />
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- Зведення + спорядження ---- */}
      <div className="doll-main">
        <div className="card calc-card doll-main-stats">
          <h3 className="doll-stats-title">Характеристики персонажа{' '}
            <span className="muted">(база + спорядження + камені + заточка + сети + титули + стани)</span>
          </h3>
          <div className="doll-stats2">
            {summary.cells.map((c, i) => (
              <div className={'doll-stat' + (flash[i] ? ' ' + flash[i] : '')} key={i}>
                <span>{c.label}</span>
                <b>{c.val}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="doll-main-eq">
          <div className="card calc-card">
            <div className="doll-fig">
              {SLOTS.map((slot) => {
                const it = build.equipped[slot.slot];
                const bad = it && !meetsReq(build, it, gearAttr).ok;
                const tip = slot.label + (it ? ': ' + it.name : '');
                return (
                  <div
                    key={slot.slot}
                    className={'doll-slot' + (it ? ' is-filled' : '') + (bad ? ' is-bad' : '')}
                    data-slot={slot.slot}
                    tabIndex={0}
                    role="button"
                    draggable={!!it}
                    aria-label={tip}
                    onClick={(e) => {
                      const el = e.currentTarget;
                      if (it && touchGate(el, () => showItemTip(el, it, slot.cat, slotTipCtx(build, slot.slot)))) return;
                      if (it) openEditor({ kind: 'slot', slot: slot.slot });
                      else void openPicker(slot.slot);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      if (it) openEditor({ kind: 'slot', slot: slot.slot });
                      else void openPicker(slot.slot);
                    }}
                    onMouseOver={(e) => {
                      if (dragSrcRef.current) return;
                      if (it) showItemTip(e.currentTarget, it, slot.cat, slotTipCtx(build, slot.slot));
                      else showTooltip(e.currentTarget, '<div class="doll-tip-name">' + escHtml(slot.label) + '</div><span class="doll-tip-type">Порожній слот — клікни, щоб обрати річ</span>');
                    }}
                    onMouseOut={hideTooltip}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (it) {
                        hideTooltip();
                        mutate((s) => toBackpack(s, slot.slot));
                      }
                    }}
                    onDragStart={(e) => {
                      if (!it) return;
                      dragSrcRef.current = { kind: 'slot', slot: slot.slot };
                      dragCatRef.current = slot.cat;
                      startDrag(e);
                    }}
                    onDragOver={(e) => {
                      if (dragSrcRef.current?.kind !== 'bp') return;
                      const ok = slot.cat === dragCatRef.current;
                      markDrop(e.currentTarget, ok);
                      if (ok) {
                        e.preventDefault();
                        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={(e) => {
                      const src = dragSrcRef.current;
                      if (src?.kind === 'bp') {
                        e.preventDefault();
                        mutate((s) => equipFromBp(s, src.idx, slot.slot));
                      }
                      dragSrcRef.current = null;
                      clearDrop();
                    }}
                  >
                    <span className="doll-cell">
                      {it && <span className="doll-icon" style={iconStyleObj(it, slot.cat, build.gender)}></span>}
                    </span>
                    <span className="doll-slot-label">{slot.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card calc-card">
            <h3 className="doll-stats-title">Рюкзак{' '}
              <span className="muted">(відкладені речі — не враховуються; клік повертає на персонажа)</span>
            </h3>
            <div className="doll-backpack"
              onDragOver={(e) => {
                const cell = (e.target as HTMLElement).closest<HTMLElement>('.doll-bp-cell');
                markDrop(cell, !!cell);
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const cell = (e.target as HTMLElement).closest<HTMLElement>('.doll-bp-cell');
                const src = dragSrcRef.current;
                mutate((s) => {
                  const to = cell?.dataset.bp != null ? Number(cell.dataset.bp) : firstFreeCell(s);
                  if (src?.kind === 'slot') toBackpack(s, src.slot, to);
                  else if (src?.kind === 'bp') moveCell(s, src.idx, to);
                });
                dragSrcRef.current = null;
                clearDrop();
              }}
            >
              {Array.from({ length: INV_SIZE }, (_, i) => {
                const e = build.backpack[i];
                if (!e) return <span className="doll-bp-cell empty" data-bp={i} key={i}><span className="doll-cell"></span></span>;
                const bad = !meetsReq(build, e.item, gearAttr).ok;
                return (
                  <button type="button" key={i} className={'doll-bp-cell is-filled' + (bad ? ' is-bad' : '')} draggable data-bp={i} aria-label={e.item.name}
                    onClick={(ev) => {
                      const el = ev.currentTarget;
                      if (touchGate(el, () => showItemTip(el, e.item, e.cat, bpTipCtx(e)))) return;
                      openEditor({ kind: 'bp', idx: i });
                    }}
                    onMouseOver={(ev) => {
                      if (dragSrcRef.current) return;
                      showItemTip(ev.currentTarget, e.item, e.cat, bpTipCtx(e));
                    }}
                    onMouseOut={hideTooltip}
                    onContextMenu={(ev) => {
                      ev.preventDefault();
                      hideTooltip();
                      mutate((s) => bpEquipSwap(s, i));
                    }}
                    onDragStart={(ev) => {
                      dragSrcRef.current = { kind: 'bp', idx: i };
                      dragCatRef.current = e.cat;
                      startDrag(ev);
                    }}
                  >
                    <span className="doll-cell"><span className="doll-icon" style={iconStyleObj(e.item, e.cat, build.gender)}></span></span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Перевірка дамага ---- */}
      <div className={'card calc-card doll-dmg-section' + (dmgCheckOn ? ' is-on' : '')}>
        <details className="doll-dmg-details">
          <summary>
            <h3 className="doll-stats-title">Перевірка дамага{' '}
              <span className="muted">(налаштуй суперника й перевір урон по ньому)</span>
            </h3>
          </summary>
          <Opponent opp={opp} setOpp={setOpp} oppKey={oppKey} />
          <div className="doll-compare-actions">
            <button type="button" className="btn btn-primary" onClick={() => setDmgCheckOn((x) => !x)}>{dmgCheckOn ? 'Сховати скіли' : 'Перевірити дамаг'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setOpp({ ...DEFAULT_OPP }); setOppKey((k) => k + 1); }}>Скинути суперника</button>
          </div>
          <div className="doll-dmg-body">
            <h4 className="doll-skills-h">Скіли класу <span className="muted">(клікни по скілу — урон додасться в лог)</span></h4>
            {dmgCheckOn && (
              <div className="doll-skill-grid">
                {!getSkills() ? (
                  <div className="muted" style={{ padding: '6px 0' }}>Завантаження скілів…</div>
                ) : skillList.length === 0 ? (
                  <div className="muted" style={{ padding: '6px 0' }}>Для цього класу даних скілів немає.</div>
                ) : (
                  skillList.map((sk) => (
                    <button type="button" key={sk.id} className="doll-skill-ic" data-skill={sk.id} title={sk.name} onClick={() => logSkillDamage(sk.id)}>
                      <span className="doll-icon" style={buffIconObj(sk.an)}></span>
                      <span className="doll-skill-cap">{sk.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <div className="doll-dmg-loghead">
              <h4 className="doll-skills-h">Лог урону</h4>
              <button type="button" className="btn btn-ghost" onClick={() => setDmgLog([])}>Очистити</button>
            </div>
            {dmgLog.length ? (
              <div className="doll-dmg-log" dangerouslySetInnerHTML={{ __html: dmgLog.join('') }} />
            ) : (
              <div className="doll-dmg-log"><div className="muted doll-dmg-empty">Клікни по скілу вище, щоб порахувати урон.</div></div>
            )}
          </div>
        </details>
      </div>

      {/* ---- Історія білдів ---- */}
      <div className="card calc-card">
        <h3 className="doll-stats-title">Збережені білди{' '}
          <span className="muted">(локально, до 20)</span>
        </h3>
        <div className="doll-save-row">
          <input type="text" placeholder="Назва білду…" autoComplete="off" maxLength={40} value={buildName} onChange={(e) => setBuildName(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={saveBuild}>Зберегти білд</button>
        </div>
        <div className="doll-history" style={{ marginTop: '12px' }}>
          {history.length ? (
            history.map((b, i) => (
              <div className="doll-hist-row" key={i}>
                <span className="doll-hist-name">{b.name}</span>
                <span className="doll-hist-act">
                  <button type="button" className="btn btn-ghost" onClick={() => loadBuild(i)}>Завантажити</button>
                  <button type="button" className="doll-hist-del" aria-label="Видалити" onClick={() => deleteBuild(i)}>✕</button>
                </span>
              </div>
            ))
          ) : (
            <div className="muted" style={{ padding: '6px 0' }}>Немає збережених білдів.</div>
          )}
        </div>
      </div>

      <details className="note">
        <summary>Про сторінку</summary>
        <p>
          Повний редактор: стати (5 очок/рівень), вимоги речей (рівень/Сила/Спритн/Інт —
          непридатна річ підсвічена червоним і не враховується), камені, заточка, сети,
          стани, порівняння з опонентом, збереження. Назви предметів — з ігрових даних
          і можуть бути російською. Дані та іконки — з відкритих джерел спільноти PW.
        </p>
      </details>

      {/* ================= Модалки ================= */}
      {picker && (
        <PickerModal
          picker={picker}
          ui={pickUi}
          setUi={setPickUi}
          rows={pickerRows.rows}
          total={pickerRows.total}
          typeIrs={pickerTypeIrs}
          build={build}
          gearAttr={gearAttr}
          onClose={closePicker}
          onEquip={pickerEquip}
          onUnequip={pickerUnequip}
          onBackpack={() => { if (picker.slot && picker.gem == null) { mutate((s) => toBackpack(s, picker.slot!.slot)); closePicker(); } }}
          showItemTip={showItemTip}
          touchGate={touchGate}
        />
      )}
      {editor && (
        <EditorModal
          key={'ed-' + (editor.kind === 'slot' ? editor.slot : 'bp' + editor.idx)}
          target={editor}
          tab={editorTab}
          setTab={setEditorTab}
          build={build}
          gearAttr={gearAttr}
          edItemOf={edItemOf}
          edCatOf={edCatOf}
          onClose={closeEditor}
          onRefine={edSetRefine}
          onAddStat={edAddStat}
          onSetType={edSetAddonType}
          onSetVal={edSetAddonVal}
          onDelStat={edDelAddon}
          onOpenGem={openGemPicker}
          onOpenSpecial={openSpecialPicker}
          onDelSpecial={(kind) => mutate((s) => setSpecial(s, editor, kind, null))}
          showItemTip={showItemTip}
          actions={{
            remove: () => { mutate((s) => clearSlot(s, (editor as { slot: string }).slot)); closeEditor(); },
            toBp: () => { mutate((s) => toBackpack(s, (editor as { slot: string }).slot)); closeEditor(); },
            change: () => { const s = (editor as { slot: string }).slot; closeEditor(); void openPicker(s); },
            toChar: () => { mutate((s) => fromBackpack(s, (editor as { idx: number }).idx)); closeEditor(); },
            del: () => { mutate((s) => s.backpack.splice((editor as { idx: number }).idx, 1)); closeEditor(); },
          }}
        />
      )}
      {buffCfgId != null && activeBuffCfg && (
        <BuffCfgModal
          buff={activeBuffCfg}
          cfg={buffCfgRead(build, activeBuffCfg.id)}
          onClose={() => setBuffCfgId(null)}
          onLvl={setBuffLvl}
          onSide={setBuffSide}
          onDelete={deleteBuff}
        />
      )}
      {buffPickOpen && (
        <BuffPickModal
          classes={buffPickClasses}
          setClasses={setBuffPickClasses}
          q={buffPickQ}
          setQ={setBuffPickQ}
          onClose={() => setBuffPickOpen(false)}
          onAdd={addBuff}
          showBuffTip={(el, b) => showTooltip(el, buffTipHtml(buildRef.current, b))}
        />
      )}
    </>
  );
}

// ============================================================
// Поле атрибута (uncontrolled: типізуй вільно, кламп на blur)
// ============================================================
const AttrField = forwardRef<HTMLInputElement, {
  id: string;
  label: string;
  k: 'str' | 'dex' | 'vit' | 'mag';
  build: DollState;
  bonus: number;
  commit: (k: 'str' | 'dex' | 'vit' | 'mag', raw: string) => void;
  ref2: React.MutableRefObject<DollState>;
}>(function AttrField({ id, label, k, build, bonus, commit, ref2 }, _ref) {
  const f = (n: number) => Math.round(n).toLocaleString('uk');
  const base = build[k];
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        <b className="doll-attr-plus" title={bonus ? f(base) + ' чистих + ' + f(bonus) + ' від речей = ' + f(base + bonus) : ''}>
          {bonus ? '+' + f(bonus) + ' (' + f(base + bonus) + ')' : ''}
        </b>
      </label>
      <input type="number" id={id} min={5} defaultValue={base}
        onChange={(e) => commit(k, e.target.value)}
        onBlur={(e) => (e.currentTarget.value = String(ref2.current[k]))} />
    </div>
  );
});
