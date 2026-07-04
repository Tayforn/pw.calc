// =========================================================
// Симулятор скринь — ідіоматичний React (фаза 3).
// Дані/симуляція — src/lib/chests.ts; модалка налаштувань вмісту —
// у цьому компоненті (з GlobalModals прибрана); legacy chestsInit видалено.
// =========================================================

import { useEffect, useMemo, useState } from 'react';
import { fmt, fmt2 } from '../utils/format';
import { useSettings } from '../app/useSettings';
import {
  CHEST_SIM_CAP,
  chestDefaultItems,
  chestFmtChance,
  chestPools,
  chestRarity,
  chestRollOnce,
  nextChestUid,
  type ChestDrop,
  type ChestItem,
  type InvEntry,
} from '../lib/chests';

type Inventory = Record<string, InvEntry>;

interface SimResult {
  target: string;
  got: boolean;
  gotQty: number;
  opens: number;
  expected: number;
  prob: number;
  goldSpent: number;
  coinsSpent: number;
  keyPrice: number;
}

function addDropToInv(inv: Inventory, drop: ChestDrop[]): Inventory {
  const next = { ...inv };
  for (const d of drop) {
    const cur = next[d.name];
    next[d.name] = cur
      ? { ...cur, count: cur.count + d.qty }
      : { name: d.name, count: d.qty, chance: d.chance };
  }
  return next;
}

export default function ChestsPage() {
  const settings = useSettings();
  const [items, setItems] = useState<ChestItem[]>(chestDefaultItems);
  const [inventory, setInventory] = useState<Inventory>({});
  const [opens, setOpens] = useState(0);
  const [lastDrop, setLastDrop] = useState<ChestDrop[] | null>(null);
  const [count, setCount] = useState('100');
  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [keyPrice, setKeyPrice] = useState('0');
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  const pools = useMemo(() => chestPools(items), [items]);

  // Опції цілі симуляції — предмети з шансом > 0, від рідкісних до частих.
  const targetOptions = useMemo(
    () => items.filter((it) => it.name && it.chance > 0).sort((a, b) => a.chance - b.chance),
    [items],
  );
  // Тримаємо валідний target при зміні складу скрині.
  useEffect(() => {
    if (targetOptions.length && !targetOptions.some((it) => it.name === target)) {
      setTarget(targetOptions[0].name);
    }
  }, [targetOptions, target]);

  const openChest = (times: number) => {
    let inv = inventory;
    let o = opens;
    let last: ChestDrop[] | null = null;
    for (let i = 0; i < times; i++) {
      const drop = chestRollOnce(items);
      if (!drop) break;
      inv = addDropToInv(inv, drop);
      o++;
      last = drop;
    }
    setInventory(inv);
    setOpens(o);
    if (last) setLastDrop(last);
  };

  const clearInventory = () => {
    setInventory({});
    setOpens(0);
    setLastDrop(null);
    setSimResult(null);
  };

  const simulate = () => {
    if (!target) return;
    const { roll, totalWeight, guaranteed } = chestPools(items);
    const isGuaranteed = guaranteed.some((it) => it.name === target);
    const targetWeight = roll.filter((it) => it.name === target).reduce((s, it) => s + it.chance, 0);
    if (!isGuaranteed && (targetWeight <= 0 || totalWeight <= 0)) {
      setSimResult({ target, got: false, gotQty: 0, opens: 0, expected: Infinity, prob: 0, goldSpent: 0, coinsSpent: 0, keyPrice: 0 });
      return;
    }

    let inv = inventory;
    let o = opens;
    let last: ChestDrop[] | null = null;
    let localOpens = 0;
    let got = false;
    let gotQty = 0;
    while (localOpens < CHEST_SIM_CAP) {
      const drop = chestRollOnce(items);
      localOpens++;
      o++;
      if (drop) {
        inv = addDropToInv(inv, drop);
        last = drop;
        const hit = drop.find((d) => d.name === target);
        if (hit) {
          got = true;
          gotQty = hit.qty;
          break;
        }
      }
    }
    setInventory(inv);
    setOpens(o);
    if (last) setLastDrop(last);

    const prob = isGuaranteed ? 1 : targetWeight / totalWeight;
    const kp = parseFloat(keyPrice) || 0;
    const goldSpent = kp * localOpens;
    setSimResult({
      target, got, gotQty, opens: localOpens,
      expected: prob > 0 ? 1 / prob : Infinity,
      prob,
      keyPrice: kp,
      goldSpent,
      coinsSpent: goldSpent * settings.goldPrice,
    });
  };

  const invRows = useMemo(
    () => Object.values(inventory).sort((a, b) => a.chance - b.chance || b.count - a.count),
    [inventory],
  );

  return (
    <>
      <header className="section-head">
        <span className="eyebrow">Симулятор скринь</span>
        <h2>Відкриття скрині</h2>
        <p>
          Налаштуй вміст скрині (шанси та кількість), відкривай її та дивись,
          що випало. Інвентар збирає все за поточну сесію. Режим «Симулювати»
          відкриває скриню доти, доки не випаде обраний предмет.
          Налаштування тимчасові — оновлення сторінки скидає скриню до дефолтної.
        </p>
      </header>

      <div className="card calc-card">
        <div className="chest-toolbar">
          <button type="button" id="chestSettingsBtn" className="btn btn-ghost" onClick={() => setModalOpen(true)}>
            ⚙ Налаштування вмісту
          </button>
          <span className="muted" id="chestSummary">
            Предметів: {fmt(items.length)} · у пулі: {fmt(pools.roll.length)}
            {' '}(сума шансів {chestFmtChance(pools.totalWeight)})
            {pools.guaranteed.length ? ' · гарантованих: ' + fmt(pools.guaranteed.length) : ''}
          </span>
        </div>

        <div className="chest-open-row">
          <button type="button" id="chestOpen" className="btn btn-primary chest-open-btn" onClick={() => openChest(1)}>🎁 Відкрити</button>
          <button type="button" id="chestOpen10" className="btn btn-ghost" onClick={() => openChest(10)}>Відкрити ×10</button>
          <div className="chest-bulk">
            <input type="number" id="chestCount" min={1} step={1} value={count} onChange={(e) => setCount(e.target.value)} aria-label="Кількість скринь" />
            <button
              type="button"
              id="chestOpenAll"
              className="btn btn-ghost"
              onClick={() => {
                const n = parseInt(count, 10);
                if (Number.isFinite(n) && n >= 1) openChest(Math.min(n, CHEST_SIM_CAP));
              }}
            >
              Відкрити всі
            </button>
          </div>
          <button type="button" id="chestClearInv" className="btn btn-ghost" onClick={clearInventory}>↺ Очистити інвентар</button>
        </div>

        <div className="chest-drop" id="chestDrop">
          {!lastDrop || !lastDrop.length ? (
            <div className="hist-empty muted">Натисни «Відкрити», щоб подивитись, що випаде.</div>
          ) : (
            [...lastDrop].sort((a, b) => a.chance - b.chance).map((d, i) => (
              <div key={d.name + i} className={'chest-drop-item rarity-' + chestRarity(d.chance)}>
                <span className="chest-gem">◈</span>
                <span className="chest-drop-name">{d.name}</span>
                <span className="chest-drop-qty">×{fmt(d.qty)}</span>
                <span className="chest-drop-chance">{d.chance >= 100 ? 'бонус' : chestFmtChance(d.chance)}</span>
              </div>
            ))
          )}
        </div>

        <div className="chest-sim-block">
          <h3 className="craft-h">Симуляція до бажаного предмета</h3>
          <p className="muted" style={{ margin: '4px 0 12px' }}>
            Обери предмет — скриня відкриватиметься, доки він не випаде.
            Показуємо, скільки відкриттів знадобилось і скільки б це коштувало.
          </p>
          <form className="chest-sim-form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); simulate(); }}>
            <div className="field">
              <label htmlFor="chestTarget">Бажаний предмет</label>
              <select id="chestTarget" value={target} onChange={(e) => setTarget(e.target.value)}>
                {targetOptions.map((it) => (
                  <option key={it.uid} value={it.name}>{it.name} — {chestFmtChance(it.chance)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="chestKeyPrice">Ціна 1 ключа/скрині, голда</label>
              <input type="number" id="chestKeyPrice" min={0} step={0.1} value={keyPrice} onChange={(e) => setKeyPrice(e.target.value)} />
            </div>
            <div className="field chest-sim-submit">
              <button type="submit" id="chestSimulate" className="btn btn-primary">▶ Симулювати</button>
            </div>
          </form>
          <div id="chestSimResult" className="result" aria-live="polite">
            {simResult && <SimResultView r={simResult} />}
          </div>
        </div>

        <div className="chest-inv-block">
          <div className="chest-inv-head">
            <h3 className="craft-h" style={{ margin: 0 }}>Інвентар (за сесію)</h3>
            <span className="muted" id="chestInvCount">{fmt(opens)} {opens === 1 ? 'відкриття' : 'відкриттів'}</span>
          </div>
          <div className="chest-inv-list" id="chestInv">
            {invRows.length === 0 ? (
              <div className="hist-empty muted">Поки що порожньо. Відкрий скриню, щоб щось отримати.</div>
            ) : (
              invRows.map((r) => (
                <div key={r.name} className={'chest-inv-item rarity-' + chestRarity(r.chance)}>
                  <span className="chest-gem">◈</span>
                  <span className="chest-inv-name">{r.name}</span>
                  <span className="chest-inv-num">×{fmt(r.count)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <ChestConfigModal
          items={items}
          setItems={setItems}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function SimResultView({ r }: { r: SimResult }) {
  if (r.prob === 0 && !r.got) {
    return <div className="banner">У цього предмета шанс 0% — його неможливо отримати.</div>;
  }
  if (!r.got) {
    return (
      <div className="banner">
        За {fmt(r.opens)} відкриттів предмет «{r.target}» так і не випав (ліміт симуляції). Шанс надто малий.
      </div>
    );
  }
  return (
    <>
      <div className="banner info">
        Готово! «{r.target}» (×{fmt(r.gotQty)}) випав за <b>{fmt(r.opens)}</b> {r.opens === 1 ? 'відкриття' : 'відкриттів'}.
      </div>
      <div className="result-summary three-cols">
        <div className="metric">
          <span className="metric-label">Відкриттів знадобилось</span>
          <span className="metric-value">{fmt(r.opens)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Очікувано (в середньому)</span>
          <span className="metric-value">{Number.isFinite(r.expected) ? fmt2(r.expected) : '∞'}</span>
          <span className="metric-sub">шанс {chestFmtChance(r.prob * 100)} за відкриття</span>
        </div>
        {r.keyPrice > 0 && (
          <div className="metric">
            <span className="metric-label">Витрачено на ключі</span>
            <span className="metric-value">{fmt2(r.goldSpent)} г</span>
            <span className="metric-sub">{fmt(r.coinsSpent)} монет</span>
          </div>
        )}
      </div>
    </>
  );
}

function ChestConfigModal({
  items,
  setItems,
  onClose,
}: {
  items: ChestItem[];
  setItems: (updater: (prev: ChestItem[]) => ChestItem[]) => void;
  onClose: () => void;
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

  const pools = chestPools(items);
  const patch = (uid: number, p: Partial<ChestItem>) =>
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...p } : it)));

  return (
    <div className="modal-overlay" id="chestModal" onClick={(e) => { if ((e.target as HTMLElement).id === 'chestModal') onClose(); }}>
      <div className="modal chest-modal" role="dialog" aria-modal="true" aria-labelledby="chestModalTitle">
        <div className="modal-head">
          <h3 id="chestModalTitle">Налаштування вмісту скрині</h3>
          <button type="button" className="modal-close" aria-label="Закрити" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ marginTop: 0 }}>
            Шанс — у відсотках. Предмети з шансом &lt;100% утворюють спільний пул:
            за одне відкриття випадає рівно один з них (пропорційно шансам).
            Предмети зі шансом <b>100%</b> — гарантований бонус і випадають завжди.
          </p>
          <div className="chest-cfg-row chest-cfg-head">
            <span>Назва</span>
            <span>Шанс, %</span>
            <span>К-сть</span>
            <span></span>
          </div>
          <div id="chestCfgList" className="chest-cfg-list">
            {items.map((it) => (
              <div key={it.uid} className="chest-cfg-row" data-uid={it.uid}>
                <input
                  type="text"
                  className="chest-cfg-name"
                  value={it.name}
                  placeholder="Назва предмета"
                  onChange={(e) => patch(it.uid, { name: e.target.value })}
                />
                <input
                  type="number"
                  className="chest-cfg-chance"
                  value={it.chance}
                  min={0}
                  step="any"
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    patch(it.uid, { chance: Number.isFinite(v) && v >= 0 ? v : 0 });
                  }}
                />
                <input
                  type="number"
                  className="chest-cfg-qty"
                  value={it.qty}
                  min={1}
                  step={1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    patch(it.uid, { qty: Number.isFinite(v) && v >= 1 ? v : 1 });
                  }}
                />
                <button
                  type="button"
                  className="chest-cfg-del"
                  aria-label="Видалити"
                  onClick={() => setItems((prev) => prev.filter((x) => x.uid !== it.uid))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="chest-cfg-summary" id="chestCfgSummary">
            У пулі: <b>{fmt(pools.roll.length)}</b>, сума шансів: <b>{chestFmtChance(pools.totalWeight)}</b>
            {pools.guaranteed.length ? <> · гарантованих: <b>{fmt(pools.guaranteed.length)}</b></> : null}
            {pools.totalWeight > 0 ? null : (
              <span style={{ color: 'var(--warn)' }}> — пул порожній, додай предмети з шансом &lt;100%</span>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button
            type="button"
            id="chestAddItem"
            className="btn btn-ghost"
            onClick={() => setItems((prev) => [...prev, { uid: nextChestUid(), name: 'Новий предмет', chance: 1, qty: 1 }])}
          >
            + Додати предмет
          </button>
          <button type="button" id="chestResetCfg" className="btn btn-ghost" onClick={() => setItems(() => chestDefaultItems())}>
            ↺ Дефолтна скриня
          </button>
          <button type="button" id="chestModalDone" className="btn btn-primary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  );
}
