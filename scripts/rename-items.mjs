// =========================================================
// Перейменування предметів mypers за дампом клієнта PW.
// Джерело назв — elements_id_name.csv (витяг з elements.data):
// рядки `id;name;section;record_size;id_offset;name_offset`.
// У наших файлах public/assets/data/mypers/*.json кожен предмет
// має pw_id (ігровий id) — за ним і зіставляємо. Міняються ЛИШЕ
// значення поля name; решта даних і формат файлів незмінні.
//
// Частина рядків CSV — внутрішні кодові імена (A_A11, C_MD09…),
// такі пропускаємо: замінюємо лише коли нова назва містить кирилицю.
//
// Запуск: node scripts/rename-items.mjs <elements_id_name.csv> [mypersDir]
//   напр.: node scripts/rename-items.mjs D:/CyberPW/surfaces/data.files/data/elements_id_name.csv
// =========================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [csvPath, dirArg] = process.argv.slice(2);
if (!csvPath) {
  console.error('usage: node scripts/rename-items.mjs <elements_id_name.csv> [mypersDir]');
  process.exit(1);
}
const DIR = dirArg || join(import.meta.dirname, '..', 'public', 'assets', 'data', 'mypers');

// Файли mypers, що містять предмети з pw_id.
const FILES = [
  'ft', 'gv', 'ic', 'it', 'mj', 'ob', 'oq', 'pk', 'pp',
  'qn', 'rv', 'rx', 'st', 'ta', 'tg', 'vx', 'wdf', 'wy',
];

// ---- читання CSV: id → назва --------------------------------
// Назва може містити «;», тому парсимо регекспом з жорсткими
// числовими колонками по краях, а не split(';').
const names = new Map();
const csv = readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
const ROW = /^(\d+);(.*);(\d+);(\d+);(0x[0-9A-Fa-f]+);(0x[0-9A-Fa-f]+)$/;
for (const line of csv.split(/\r?\n/)) {
  const m = ROW.exec(line);
  if (!m) continue;
  const id = Number(m[1]);
  // ^RRGGBB — ігровий кольоровий код на початку назви, у UI не потрібен.
  const name = m[2].replace(/\^[0-9a-fA-F]{6}/g, '').trim();
  if (!name || !/[Ѐ-ӿ]/.test(name)) continue; // кодові імена — повз
  if (!names.has(id)) names.set(id, name);
}
console.log(`CSV: ${names.size} придатних назв (з кирилицею)`);

// ---- перейменування -----------------------------------------
let renamed = 0, same = 0, missing = 0;
for (const f of FILES) {
  const path = join(DIR, f + '.json');
  const items = JSON.parse(readFileSync(path, 'utf8'));
  let changed = 0;
  for (const it of items) {
    const nn = names.get(it.pw_id);
    if (nn === undefined) { missing++; continue; }
    if (it.name === nn) { same++; continue; }
    it.name = nn;
    changed++;
  }
  renamed += changed;
  if (changed) writeFileSync(path, JSON.stringify(items));
  console.log(`${f}.json: ${changed} перейменовано (з ${items.length})`);
}
console.log(`\nРазом: ${renamed} перейменовано, ${same} вже збігалися, ${missing} без назви у CSV`);
