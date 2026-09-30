// =========================================================
// Серверні значення рівня атаки (ПА) на зброї.
// Каталог mypers узято з новішої версії гри, де в частини топової зброї
// фіксоване ПА більше, ніж на нашому сервері (1.4.6). Власник, 30.09.2026:
//   ЦГД (80 рів.)  — ПА 30   (у каталозі 50)
//   РЦГД (80 рів.) — ПА 50   (у каталозі 65 і пізніші перековки 65+50, 65+50+50)
//   R9 — 30, R9R1 — 40      (збігається з каталогом, не чіпаємо)
//   R9R2 — ПА 50            (у каталозі 40+25, 70 або 70+40)
//
// Списки id нижче виведено один раз із НЕЗМІНЕНОГО каталогу (30.09.2026):
//   ЦГД  — oj 80, hf 16, 2 зірки (tv 42), фіксоване ПА < 65 (базові, pw_id 20xxx…);
//   РЦГД — oj 80, hf 16, решта з фіксованим ПА (перековані: 3 зірки або ПА ≥ 65);
//   R9R2 — репутація 300000, hf 16, 3 зірки (tv 43), без комплекту (ps), з фіксованим ПА.
// Після заміни ПА базових і перекованих двозіркових збігаються з каталожними
// числами інших родин, тож правило «за числом» повторно застосувати не можна —
// тому явні списки. Скрипт ідемпотентний.
//
// Усі записи ПА (nw.wu, type 'ad') речі зводяться до одного з серверним
// значенням на місці першого; решта даних і формат файла незмінні.
//
// Той самий каталог лежить копією в pw-pvp (src/doll/data/json/ta.json) —
// прогнати скрипт і для неї:
//   node scripts/server-weapon-pa.mjs                       (цей репозиторій)
//   node scripts/server-weapon-pa.mjs ../pw-pvp/src/doll/data/json/ta.json
// =========================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = process.argv[2] || join(import.meta.dirname, '..', 'public', 'assets', 'data', 'mypers', 'ta.json');

const CGD_IDS = [1167, 1168, 1169, 1170, 1171, 1172, 1173, 1174, 1175, 1176, 1177, 1178, 1179, 1180, 1181, 2412, 2504, 2845, 2846];
const RCGD_IDS = [
  1187, 1191, 1194, 1204, 1210, 1219, 1222, 2355, 2356, 2357, 2358, 2359, 2360, 2361, 2362, 2413, 2414, 2415, 2505, 2506, 2507,
  2560, 2561, 2562, 2563, 2564, 2565, 2566, 2567, 2568, 2569, 2570, 2571, 2572, 2573, 2574, 2575, 2576, 2577, 2578, 2579, 2580,
  2581, 2582, 2583, 2584, 2585, 2586, 2587, 2588, 2589, 2620, 2843, 2844, 2847, 2848, 2849, 2850, 2851, 2852, 2853, 2854,
];
const R9R2_IDS = [
  1915, 1917, 1918, 1921, 1923, 1924, 1926, 1927, 1929, 1930, 1933, 1934, 1936, 1937, 1939, 1940, 1942, 1943, 1945, 1946,
  2451, 2543, 2892, 2894, 2896, 2898,
];

const WANT = new Map([...CGD_IDS.map((id) => [id, 30]), ...RCGD_IDS.map((id) => [id, 50]), ...R9R2_IDS.map((id) => [id, 50])]);

const raw = readFileSync(FILE, 'utf8');
const items = JSON.parse(raw);
if (JSON.stringify(items) !== raw) {
  console.error('ta.json не в компактному форматі JSON — перезапис змінив би весь файл; зупиняюсь.');
  process.exit(1);
}

const seen = new Set();
const changed = [];
for (const it of items) {
  const want = WANT.get(it.id);
  if (want == null) continue;
  seen.add(it.id);
  const wu = it.nw?.wu ?? [];
  const ads = wu.filter((w) => w.type === 'ad');
  if (!ads.length) {
    console.error(`${it.id} ${it.name}: немає ПА в каталозі — список не відповідає файлу; зупиняюсь.`);
    process.exit(1);
  }
  if (ads.length === 1 && Number(ads[0].val) === want) continue;
  const before = ads.map((w) => w.val).join('+');
  const first = wu.indexOf(ads[0]);
  it.nw.wu = wu.map((w, i) => (i === first ? { ...w, val: want } : w)).filter((w, i) => w.type !== 'ad' || i === first);
  changed.push(`${it.id} ${it.name}: ПА ${before} → ${want}`);
}
const missing = [...WANT.keys()].filter((id) => !seen.has(id));
if (missing.length) {
  console.error(`У файлі немає речей зі списку: ${missing.join(', ')} — зупиняюсь.`);
  process.exit(1);
}

if (!changed.length) {
  console.log('Нічого міняти — серверні значення вже стоять.');
} else {
  writeFileSync(FILE, JSON.stringify(items));
  console.log(`Змінено ${changed.length} речей у ${FILE}:`);
  for (const line of changed) console.log('  ' + line);
}
