// Bus matrix: rows (subject areas) grouped by functional area, shared-dimension columns ordered by reach,
// a readable head of columns plus long-tail bands, and the comparisons the matrix page draws.

import type { Band, Comparison, CoreModel, MatrixRowGroup, ReachByArea } from './types';

/** Number of subject areas that list a bus-matrix column. */
export const reach = (m: CoreModel, col: number): number => m.bus.columnSaCount[col];

const byReach = (m: CoreModel) => (x: number, y: number) => reach(m, y) - reach(m, x) || x - y;

/** Bus-matrix row of a subject area, or -1. */
export const rowOf = (m: CoreModel, sa: number): number => m.subjectAreas[sa].row;

/** Bus-matrix column of a table, or -1 when it is not a shared dimension. */
export const colOf = (m: CoreModel, t: number): number => m.tables[t].col;

/** Bus-matrix columns a subject area lists (empty when it has no row). */
export function dimsOf(m: CoreModel, sa: number): number[] {
  const r = rowOf(m, sa);
  return r < 0 ? [] : m.bus.cells[r];
}

/** Rows in matrix order, grouped by functional area (a new group starts whenever the area changes). */
export function matrixRows(m: CoreModel): MatrixRowGroup[] {
  const out: MatrixRowGroup[] = [];
  m.bus.rows.forEach((sa, row) => {
    const fa = m.subjectAreas[sa].fa;
    let g = out[out.length - 1];
    if (!g || g.fa !== fa) out.push((g = { fa, name: fa >= 0 ? m.functionalAreas[fa].name : '', rows: [] }));
    g.rows.push({ row, sa, label: m.subjectAreas[sa].label, dims: m.bus.cells[row].length });
  });
  return out;
}

/**
 * Head columns and long-tail bands. The head is the most shared columns, cut where reach drops below the reach of
 * the 29th column (ties stay in). The rest fall in bands of 21+, 6 to 20 and 5 or fewer areas; empty bands are left out.
 */
export function matrixColumns(m: CoreModel, headSize = 29): { head: number[]; bands: Band[] } {
  const n = m.bus.columns.length;
  const cut = reach(m, Math.min(headSize - 1, n - 1));
  let k = 0;
  while (k < n && reach(m, k) >= cut) k++;
  const head = [...Array(k).keys()];
  const tail = [...Array(n).keys()].slice(k);
  const defs = [{ lo: 21, hi: Infinity }, { lo: 6, hi: 20 }, { lo: 0, hi: 5 }];
  const bands = defs.map((d) => {
    const cols = tail.filter((c) => reach(m, c) >= d.lo && reach(m, c) <= d.hi);
    const lo = Math.min(...cols.map((c) => reach(m, c))), hi = Math.max(...cols.map((c) => reach(m, c)));
    const label = d.lo === 0 ? `listed under ${hi} or fewer areas` : `listed under ${lo} to ${hi} areas`;
    return { cols, lo, hi, label };
  }).filter((b) => b.cols.length);
  return { head, bands };
}

/** Dimensions two subject areas list: only in A, only in B, in both. Each list is sorted by reach. */
export function compare(m: CoreModel, saA: number, saB: number): Comparison {
  const a = dimsOf(m, saA), b = dimsOf(m, saB);
  const sa = new Set(a), sb = new Set(b);
  const sort = byReach(m);
  return {
    onlyA: a.filter((c) => !sb.has(c)).sort(sort),
    onlyB: b.filter((c) => !sa.has(c)).sort(sort),
    both: a.filter((c) => sb.has(c)).sort(sort),
  };
}

/** Per functional area: how many of its subject areas (with a matrix row) list the dimension column. */
export function dimensionReach(m: CoreModel, col: number): ReachByArea[] {
  return m.functionalAreas.map((fa) => {
    let total = 0, has = 0;
    for (const sa of fa.subjectAreas) {
      const r = rowOf(m, sa);
      if (r < 0) continue;
      total++;
      if (m.rowSets[r].has(col)) has++;
    }
    return { fa: fa.i, name: fa.name, total, has };
  });
}

/**
 * Fact tables the bus matrix lists in the subject areas that list this dimension column, with the number of those
 * areas each appears in. Most areas first. Each table is its own entry (a _SEC table is not folded into another).
 */
export function factsInSameAreas(m: CoreModel, col: number): { table: number; areas: number }[] {
  const cnt = new Map<number, number>();
  m.bus.rows.forEach((sa, r) => {
    if (!m.rowSets[r].has(col)) return;
    for (const t of m.factsOfSa[sa]) cnt.set(t, (cnt.get(t) ?? 0) + 1);
  });
  return [...cnt].map(([table, areas]) => ({ table, areas }))
    .sort((x, y) => y.areas - x.areas || m.tables[x.table].name.localeCompare(m.tables[y.table].name));
}

/**
 * Dimension columns listed in the subject areas where this table is a listed fact, with how many of those areas
 * list each. Most areas first, then wider reach. The table itself is left out.
 */
export function dimensionsWithFact(m: CoreModel, t: number): { col: number; areas: number }[] {
  const cnt = new Map<number, number>();
  m.bus.rows.forEach((sa, r) => {
    if (!m.factsOfSa[sa].includes(t)) return;
    for (const c of m.bus.cells[r]) if (m.bus.columns[c] !== t) cnt.set(c, (cnt.get(c) ?? 0) + 1);
  });
  return [...cnt].map(([col, areas]) => ({ col, areas })).sort((x, y) => y.areas - x.areas || reach(m, y.col) - reach(m, x.col) || x.col - y.col);
}

/** Subject areas where the bus matrix lists this table as a fact, in matrix order. */
export const areasWithFact = (m: CoreModel, t: number): number[] => m.bus.rows.filter((sa) => m.factsOfSa[sa].includes(t));
