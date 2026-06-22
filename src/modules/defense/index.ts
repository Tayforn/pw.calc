// =========================================================
// АТАКА / ЗАХИСТ / ДЕФ / РІВЕНЬ
// =========================================================

import { $ } from '../../utils/dom';
import { fmt } from '../../utils/format';

// --- Фільтр 1: ПА / ПЗ ---

const DEF_DELTA_ROWS: Array<{ delta: number; note: string }> = [
  { delta: 150, note: 'Перевага ПА +150 — шкода ×2.5.' },
  { delta: 100, note: 'Перевага ПА +100 — шкода вдвічі.' },
  { delta: 50, note: 'Перевага ПА +50 — +50% до урону.' },
  { delta: 20, note: 'Невелика перевага атаки, +20% урону.' },
  { delta: 0, note: 'ПА = ПЗ → базова шкода без модифікаторів.' },
  { delta: -10, note: 'Початок захисту: −9% урону.' },
  { delta: -20, note: 'Перші 20 одиниць ПЗ дають чудовий приріст.' },
  { delta: -50, note: 'Супротивник втрачає третину сили.' },
  { delta: -100, note: '«Ponto de corte» — урон урізано рівно вдвічі.' },
  { delta: -150, note: 'Diminishing returns: −60%, але кожна одиниця дешевшає.' },
  { delta: -200, note: 'Урон зменшено на 2/3.' },
  { delta: -300, note: 'Максимально досяжна порізка у ~75% (важко в реальному бою).' },
];

/** Коефіцієнт ПА/ПЗ за різницею Δ = ПА − ПЗ. */
export function paPzCoef(delta: number): number {
  if (delta >= 0) return 1 + delta / 100;
  return 1 / (1 + Math.abs(delta) / 100);
}

/** Текстове представлення коефіцієнта як % зміни шкоди. */
function coefEffectText(k: number): string {
  if (k > 1) return '+' + ((k - 1) * 100).toFixed(0) + '% шкоди';
  if (k < 1) return '−' + ((1 - k) * 100).toFixed(0) + '% шкоди';
  return 'без змін';
}

// --- Фільтр 2: фіз / маг деф ---

const DEF_ARMOR_VALUES = [0, 1000, 2000, 4200, 10000, 20000, 40000, 80000, 160000];

/** Частка зрізаної шкоди від фіз/маг дефу: Деф / (Деф + 40×Рівень − 85). */
export function armorReduction(def: number, level: number): number {
  if (!(def > 0)) return 0;
  const denom = def + 40 * level - 85;
  if (denom <= 0) return 0;
  const r = def / denom;
  return Math.max(0, Math.min(0.999, r));
}

// --- Фільтр 3: різниця рівнів ---

/** PvP-коефіцієнт за абсолютною різницею рівнів (дзеркальний). */
export function pvpLevelCoef(levelDiff: number): number {
  const d = Math.abs(levelDiff);
  if (d <= 2) return 1.0;
  if (d <= 5) return 0.9;
  if (d <= 8) return 0.8;
  if (d <= 11) return 0.7;
  if (d <= 15) return 0.6;
  if (d <= 20) return 0.5;
  if (d >= 40) return 0.2;
  return 0.5 - (d - 20) * (0.3 / 20);
}

/** PvE-коефіцієнт: рівень_гравця / рівень_моба, не більше 1.0. */
export function pveLevelCoef(playerLevel: number, monsterLevel: number): number {
  if (!(monsterLevel > 0)) return 1;
  return Math.min(1, playerLevel / monsterLevel);
}

const PVP_RANGES: Array<{ lo: number; hi: number | null; k: number | null }> = [
  { lo: 0, hi: 2, k: 1.0 },
  { lo: 3, hi: 5, k: 0.9 },
  { lo: 6, hi: 8, k: 0.8 },
  { lo: 9, hi: 11, k: 0.7 },
  { lo: 12, hi: 15, k: 0.6 },
  { lo: 16, hi: 20, k: 0.5 },
  { lo: 21, hi: null, k: null }, // 0.4…0.2
];

function getDefMode(): 'pvp' | 'pve' {
  const el = document.querySelector('input[name="defMode"]:checked') as HTMLInputElement | null;
  return (el ? el.value : 'pvp') as 'pvp' | 'pve';
}

// ---------- Таблиці ----------

export function buildDeltaTable(): void {
  const body = document.getElementById('defTableBody');
  if (!body) return;
  body.innerHTML = DEF_DELTA_ROWS.map((r) => {
    const k = paPzCoef(r.delta);
    let cls = '';
    let badgeCls = '';
    let deltaTxt: string;
    if (r.delta > 0) {
      cls = 'def-row-attack';
      badgeCls = 'bad';
      deltaTxt = '+' + r.delta;
    } else if (r.delta < 0) {
      cls = 'def-row-defense';
      badgeCls = 'good';
      deltaTxt = String(r.delta);
    } else {
      deltaTxt = '0';
    }
    return (
      '<tr class="def-row def-row-delta ' + cls + '" data-delta="' + r.delta + '" tabindex="0">' +
      '<td><span class="badge ' + badgeCls + '">Δ ' + deltaTxt + '</span></td>' +
      '<td class="num"><b>' + k.toFixed(2) + '</b></td>' +
      '<td class="num">' + coefEffectText(k) + '</td>' +
      '<td>' + r.note + '</td>' +
      '</tr>'
    );
  }).join('');
}

export function buildArmorTable(level: number): void {
  const body = document.getElementById('defArmorTableBody');
  if (!body) return;
  const lvlEl = document.getElementById('defArmorTableLevel');
  if (lvlEl) lvlEl.textContent = String(level);
  body.innerHTML = DEF_ARMOR_VALUES.map((dv) => {
    const red = armorReduction(dv, level);
    const left = (1 - red) * 100;
    const near50 = Math.abs(red - 0.5) < 0.02;
    return (
      '<tr class="def-row def-row-armor' + (near50 ? ' def-row-defense' : '') + '" data-armor="' + dv + '" tabindex="0">' +
      '<td><span class="badge' + (near50 ? ' good' : '') + '">' + fmt(dv) + '</span></td>' +
      '<td class="num"><b>' + (red * 100).toFixed(1) + '%</b></td>' +
      '<td class="num">' + left.toFixed(1) + '%</td>' +
      '<td>' +
      (near50
        ? '«Точка перелому» — урон урізано рівно вдвічі.'
        : dv === 0
          ? 'Без дефу — чистий урон.'
          : 'Diminishing returns: кожна нова 1k дефу зрізає все менше.') +
      '</td>' +
      '</tr>'
    );
  }).join('');
}

export function buildPvpLevelTable(): void {
  const body = document.getElementById('defLevelTableBody');
  if (!body) return;
  body.innerHTML = PVP_RANGES.map((r) => {
    const label = r.hi === null ? 'понад ' + (r.lo - 1) : r.lo + '–' + r.hi;
    const kTxt = r.k === null ? '~0.4 … 0.2' : r.k.toFixed(2);
    const dmgTxt = r.k === null ? '~40 … 20%' : (r.k * 100).toFixed(0) + '%';
    return (
      '<tr>' +
      '<td><span class="badge">' + label + ' лвл</span></td>' +
      '<td class="num"><b>' + kTxt + '</b></td>' +
      '<td class="num">' + dmgTxt + '</td>' +
      '</tr>'
    );
  }).join('');
}

// ---------- Рендер калькулятора ----------

function renderDefense(): void {
  const out = document.getElementById('defResult');
  if (!out) return;

  const mode = getDefMode();
  const atk = parseFloat(($<HTMLInputElement>('#defAtk')?.value ?? ''));
  const pz = parseFloat(($<HTMLInputElement>('#defDef')?.value ?? ''));
  const armor = parseFloat(($<HTMLInputElement>('#defArmor')?.value ?? ''));
  const atkLevel = parseInt(($<HTMLInputElement>('#defAtkLevel')?.value ?? ''), 10);
  const defLevel = parseInt(($<HTMLInputElement>('#defDefLevel')?.value ?? ''), 10);
  const baseDmgRaw = parseFloat(($<HTMLInputElement>('#defBaseDmg')?.value ?? ''));

  // Динамічні підписи режиму.
  const defLevelLabel = document.getElementById('defDefLevelLabel');
  const defLevelHint = document.getElementById('defDefLevelHint');
  if (defLevelLabel) defLevelLabel.textContent = mode === 'pve' ? 'Рівень моба/боса' : 'Рівень цілі';
  if (defLevelHint) {
    defLevelHint.textContent =
      mode === 'pve'
        ? 'Рівень моба — впливає на формулу дефу та PvE-штраф.'
        : 'Рівень цілі — впливає й на формулу дефу.';
  }

  if (
    !Number.isFinite(atk) ||
    atk < 0 ||
    !Number.isFinite(pz) ||
    pz < 0 ||
    !Number.isFinite(atkLevel) ||
    atkLevel < 1 ||
    !Number.isFinite(defLevel) ||
    defLevel < 1
  ) {
    out.innerHTML = '<div class="banner">Введи коректні (невід\'ємні) значення ПА, ПЗ та рівнів.</div>';
    return;
  }

  buildArmorTable(defLevel);

  const delta = atk - pz;
  const kPaPz = paPzCoef(delta);

  const armorVal = Number.isFinite(armor) && armor > 0 ? armor : 0;
  const reduction = armorReduction(armorVal, defLevel);
  const kArmor = 1 - reduction;

  const levelDiff = atkLevel - defLevel;
  const kLevel = mode === 'pve' ? pveLevelCoef(atkLevel, defLevel) : pvpLevelCoef(levelDiff);

  const kTotal = kPaPz * kArmor * kLevel;
  const totalCls = kTotal > 1 ? 'bad' : kTotal < 1 ? 'good' : '';

  let dmgMetric = '';
  if (Number.isFinite(baseDmgRaw) && baseDmgRaw > 0) {
    const finalDmg = baseDmgRaw * kTotal;
    const diff = finalDmg - baseDmgRaw;
    const sign = diff >= 0 ? '+' : '−';
    dmgMetric =
      '<div class="metric ' + totalCls + '">' +
      '<span class="metric-label">Фінальна шкода</span>' +
      '<span class="metric-value">' + fmt(finalDmg) + '</span>' +
      '<span class="metric-sub">з ' + fmt(baseDmgRaw) + ' базової · ' + sign + fmt(Math.abs(diff)) + '</span>' +
      '</div>';
  }

  const summary =
    '<div class="result-summary' + (dmgMetric ? '' : ' three-cols') + '">' +
    '<div class="metric accent">' +
    '<span class="metric-label">Фінальний коефіцієнт</span>' +
    '<span class="metric-value">×' + kTotal.toFixed(3) + '</span>' +
    '<span class="metric-sub">' + (kTotal * 100).toFixed(1) + '% від базової · ' + coefEffectText(kTotal) + '</span>' +
    '</div>' +
    '<div class="metric">' +
    '<span class="metric-label">ПА/ПЗ (Δ ' + (delta >= 0 ? '+' : '') + fmt(delta) + ')</span>' +
    '<span class="metric-value">×' + kPaPz.toFixed(3) + '</span>' +
    '<span class="metric-sub">' + coefEffectText(kPaPz) + '</span>' +
    '</div>' +
    '<div class="metric">' +
    '<span class="metric-label">Деф (' + fmt(armorVal) + ')</span>' +
    '<span class="metric-value">−' + (reduction * 100).toFixed(1) + '%</span>' +
    '<span class="metric-sub">множник ×' + kArmor.toFixed(3) + '</span>' +
    '</div>' +
    '<div class="metric">' +
    '<span class="metric-label">Рівень (' + (mode === 'pve' ? 'PvE' : 'PvP ' + (levelDiff >= 0 ? '+' : '') + levelDiff) + ')</span>' +
    '<span class="metric-value">×' + kLevel.toFixed(3) + '</span>' +
    '<span class="metric-sub">' + coefEffectText(kLevel) + '</span>' +
    '</div>' +
    dmgMetric +
    '</div>';

  const paPzFormula =
    delta >= 0
      ? 'k₁ = 1 + ' + delta + '/100 = ' + kPaPz.toFixed(3)
      : 'k₁ = 1 / (1 + ' + Math.abs(delta) + '/100) = ' + kPaPz.toFixed(3);
  const armorFormula =
    armorVal > 0
      ? 'k₂ = 1 − ' + armorVal + '/(' + armorVal + ' + 40×' + defLevel + ' − 85) = ' + kArmor.toFixed(3)
      : 'k₂ = 1.000 (деф = 0)';
  const levelFormula =
    mode === 'pve'
      ? 'k₃ = min(1, ' + atkLevel + '/' + defLevel + ') = ' + kLevel.toFixed(3)
      : 'k₃ = ' + kLevel.toFixed(3) + ' (PvP, різниця ' + Math.abs(levelDiff) + ' лвл)';

  const formula =
    '<code>фінал = k₁ × k₂ × k₃ = ' +
    kPaPz.toFixed(3) + ' × ' + kArmor.toFixed(3) + ' × ' + kLevel.toFixed(3) + ' = ' + kTotal.toFixed(3) + '</code>' +
    '<br/><span class="muted" style="font-size:12.5px">' +
    paPzFormula + ' &nbsp;·&nbsp; ' + armorFormula + ' &nbsp;·&nbsp; ' + levelFormula +
    '</span>';

  const tips: string[] = [];
  if (delta < -100) tips.push('ПА/ПЗ: ти за «точкою розрізу» (Δ &lt; −100) — кожна нова одиниця ПЗ дає &lt; 0.5% дефу.');
  else if (delta < 0) tips.push('ПА/ПЗ: до «точки розрізу» (Δ = −100, урон навпіл) ще є простір.');
  else if (delta > 0) tips.push('ПА/ПЗ: перевага атаки — кожна +1 ПА додає +1% урону.');
  if (armorVal > 0 && reduction >= 0.5) tips.push('Деф: ти вже за 50% зрізання — далі diminishing returns, кожна 1k дефу дає все менше.');
  if (mode === 'pvp' && Math.abs(levelDiff) >= 3) tips.push('Рівень: різниця ≥ 3 лвл вмикає PvP-штраф (дзеркальний для обох сторін).');
  if (mode === 'pve' && atkLevel < defLevel) tips.push('Рівень: моб вищий за тебе — урон ріжеться за k = твій_рівень/рівень_моба.');
  if (mode === 'pve' && atkLevel >= defLevel) tips.push('Рівень: ти не нижчий за моба — PvE-штрафу на урон немає (k = 1.0).');

  out.innerHTML =
    summary +
    '<div class="banner info" style="margin-top:4px">' +
    formula +
    (tips.length ? '<br/>' + tips.join('<br/>') : '') +
    '</div>';
}

export function defInit(): void {
  const form = document.getElementById('defForm');
  if (!form) return;
  buildDeltaTable();
  buildPvpLevelTable();
  form.addEventListener('input', renderDefense);
  form.addEventListener('change', renderDefense);

  const swap = document.getElementById('defSwap');
  if (swap) {
    swap.addEventListener('click', () => {
      const a = $<HTMLInputElement>('#defAtk');
      const d = $<HTMLInputElement>('#defDef');
      const al = $<HTMLInputElement>('#defAtkLevel');
      const dl = $<HTMLInputElement>('#defDefLevel');
      if (a && d) {
        const t = a.value;
        a.value = d.value;
        d.value = t;
      }
      if (al && dl) {
        const t = al.value;
        al.value = dl.value;
        dl.value = t;
      }
      renderDefense();
    });
  }

  // Клік по рядку довідкових таблиць.
  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    if (!target || !target.closest) return;
    const deltaRow = target.closest<HTMLElement>('.def-row-delta');
    if (deltaRow) {
      const dlt = parseFloat(deltaRow.dataset.delta ?? '');
      const pzEl = $<HTMLInputElement>('#defDef');
      const atkEl = $<HTMLInputElement>('#defAtk');
      if (Number.isFinite(dlt) && pzEl && atkEl) {
        const pzVal = parseFloat(pzEl.value);
        if (Number.isFinite(pzVal)) {
          atkEl.value = String(Math.max(0, pzVal + dlt));
          renderDefense();
        }
      }
      return;
    }
    const armorRow = target.closest<HTMLElement>('.def-row-armor');
    if (armorRow) {
      const av = parseFloat(armorRow.dataset.armor ?? '');
      const armorEl = $<HTMLInputElement>('#defArmor');
      if (Number.isFinite(av) && armorEl) {
        armorEl.value = String(av);
        renderDefense();
      }
    }
  });

  renderDefense();
}
