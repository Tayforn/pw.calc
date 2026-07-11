// =========================================================
// Розклад Евентів: розкладка появ у колонці дня (pure).
// 1) Появи з ОДНАКОВИМ стартом — «стос»: один юніт для колонок,
//    члени каскадом (top += k*10px, перший зверху).
// 2) Часткові накладання — interval-кластери → side-by-side колонки,
//    тож жодна поява не перекрита повністю.
// =========================================================

import type { Occ } from './types';

export interface Placed {
  occ: Occ;
  /** Індекс side-by-side колонки в кластері. */
  col: number;
  /** Кількість колонок у кластері. */
  cols: number;
  /** Позиція в стосі однакових стартів: 0 = верхній. */
  stackIdx: number;
}

interface Unit {
  start: number;
  end: number;
  members: Occ[];
  col: number;
}

/** occs — вже відсортовані (start asc, end desc, order asc), як з occurrencesForDay. */
export function layoutDay(occs: Occ[]): Placed[] {
  // Стоси: послідовні появи з тим самим стартом.
  const units: Unit[] = [];
  for (const occ of occs) {
    const last = units[units.length - 1];
    if (last && last.start === occ.startMin) {
      last.members.push(occ);
      last.end = Math.max(last.end, occ.endMin);
    } else {
      units.push({ start: occ.startMin, end: occ.endMin, members: [occ], col: 0 });
    }
  }

  // Кластери юнітів, що перетинаються в часі.
  const placed: Placed[] = [];
  let cluster: Unit[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    for (const u of cluster) {
      let c = colEnds.findIndex((end) => end <= u.start);
      if (c === -1) {
        c = colEnds.length;
        colEnds.push(u.end);
      } else {
        colEnds[c] = u.end;
      }
      u.col = c;
    }
    for (const u of cluster) {
      // Члени стосу — за order (менший = вище), потім за id для стабільності.
      const members = [...u.members].sort((a, b) => a.evt.order - b.evt.order || (a.evt.id < b.evt.id ? -1 : 1));
      members.forEach((occ, k) => placed.push({ occ, col: u.col, cols: colEnds.length, stackIdx: k }));
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const u of units) {
    if (cluster.length && u.start >= clusterEnd) flush();
    cluster.push(u);
    clusterEnd = Math.max(clusterEnd, u.end);
  }
  flush();

  return placed;
}
