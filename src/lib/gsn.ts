// =========================================================
// Симулятор ГСН (хроно-біжутерія): чисті функції (дані — window.GSN_DATA).
// =========================================================

export const GSN_HUNT_CAP = 5000000;
export const GSN_UNKNOWN = (typeof window !== 'undefined' && window.GSN_UNKNOWN) || '__unknown__';
export const GSN_UNKNOWN_LABEL = 'Невідомий параметр';

export interface GsnChar {
  name: string;
  value: string;
  um?: string;
  weight: number;
}
export interface GsnTier {
  code: string;
  ua: string;
  star: string;
  color: string;
  chance: number;
  counts: Array<[number, number]>;
}
export interface GsnLast {
  tier: string;
  stats: GsnChar[];
}
export type GsnTierData = Record<string, { static_char: string; chars: GsnChar[] }>;

export function gsnData(): { items: Array<{ code: string; ua: string; emoji: string }>; tiers: GsnTier[]; data: Record<string, GsnTierData> } | null {
  return (typeof window !== 'undefined' && window.GSN_DATA) || null;
}
export function gsnTier(code: string): GsnTier {
  return gsnData()!.tiers.find((t) => t.code === code)!;
}
export const gsnIsUnknown = (c: GsnChar): boolean => c.name === GSN_UNKNOWN;
export const gsnKey = (c: GsnChar): string => (gsnIsUnknown(c) ? GSN_UNKNOWN : c.name + ' ' + c.value + (c.um || ''));
export const gsnDispName = (c: GsnChar): string => (gsnIsUnknown(c) ? GSN_UNKNOWN_LABEL : c.name);
export const gsnDispVal = (c: GsnChar): string => (gsnIsUnknown(c) ? '?' : c.value + (c.um || ''));

/** Зважений вибір k допів з повтором (як у грі). */
export function gsnPickStats(chars: GsnChar[], k: number): GsnChar[] {
  const total = chars.reduce((s, c) => s + c.weight, 0);
  const out: GsnChar[] = [];
  for (let i = 0; i < k; i++) {
    let r = Math.random() * total;
    let pick = chars[chars.length - 1];
    for (const c of chars) {
      r -= c.weight;
      if (r < 0) {
        pick = c;
        break;
      }
    }
    out.push(pick);
  }
  return out;
}

/** Випадкова якість за офіційними шансами (сума = 1.0). */
export function gsnPickTier(): string {
  const tiers = gsnData()!.tiers;
  let r = Math.random();
  for (const t of tiers) {
    r -= t.chance;
    if (r < 0) return t.code;
  }
  return tiers[tiers.length - 1].code;
}

/** Випадкова кількість допів для якості за tiers[].counts. */
export function gsnPickCount(tierCode: string): number {
  const t = gsnTier(tierCode);
  const tot = t.counts.reduce((s, c) => s + c[1], 0);
  let r = Math.random() * tot;
  for (const [n, w] of t.counts) {
    r -= w;
    if (r < 0) return n;
  }
  return t.counts[t.counts.length - 1][0];
}

export function gsnCountLabel(t: GsnTier): string {
  const ns = t.counts.map((c) => c[0]);
  const min = Math.min(...ns);
  const max = Math.max(...ns);
  return (min === max ? String(min) : min + '–' + max) + ' допів';
}

/** Один повний крафт: якість → кількість → стати. */
export function gsnDoCraft(tierData: GsnTierData): GsnLast {
  const tier = gsnPickTier();
  const count = gsnPickCount(tier);
  const stats = gsnPickStats(tierData[tier].chars, count);
  return { tier, stats };
}

// --- Ймовірності ---
function gsnSlotProb(chars: GsnChar[], key: string): number {
  const total = chars.reduce((s, c) => s + c.weight, 0);
  let w = 0;
  for (const c of chars) if (gsnKey(c) === key) w += c.weight;
  return total ? w / total : 0;
}

export function gsnStatsPresentProb(tierData: GsnTierData, tierCode: string, targetKeys: string[]): number {
  if (targetKeys.length === 0) return 1;
  const td = tierData[tierCode];
  const need = new Map<string, number>();
  for (const k of targetKeys) need.set(k, (need.get(k) || 0) + 1);
  const distinct = [...need.keys()];
  const m = distinct.length;
  const ps = distinct.map((k) => gsnSlotProb(td.chars, k));
  if (ps.some((p) => p <= 0)) return 0;
  const reqs = distinct.map((k) => need.get(k) as number);
  const t = gsnTier(tierCode);
  const tot = t.counts.reduce((s, c) => s + c[1], 0);
  const cats = m + 1;
  const pcat = [Math.max(0, 1 - ps.reduce((s, p) => s + p, 0)), ...ps];
  let prob = 0;
  for (const [n, w] of t.counts) {
    const pc = w / tot;
    const total = Math.pow(cats, n);
    let acc = 0;
    for (let code = 0; code < total; code++) {
      let x = code;
      let pr = 1;
      const cnt = new Array<number>(m).fill(0);
      for (let s = 0; s < n; s++) {
        const cat = x % cats;
        x = Math.floor(x / cats);
        pr *= pcat[cat];
        if (cat > 0) cnt[cat - 1]++;
      }
      let ok = true;
      for (let i = 0; i < m; i++) {
        if (cnt[i] < reqs[i]) {
          ok = false;
          break;
        }
      }
      if (ok) acc += pr;
    }
    prob += pc * acc;
  }
  return Math.max(0, Math.min(1, prob));
}

export function gsnHuntProb(tierData: GsnTierData, tierCode: string, targetKeys: string[]): number {
  return gsnTier(tierCode).chance * gsnStatsPresentProb(tierData, tierCode, targetKeys);
}
