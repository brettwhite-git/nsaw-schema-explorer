// Matrix page state and small helpers shared by the bus matrix, its side panel, the phone lists and Compare.
// Selection lives in the query: ?a=slug&b=slug (one or two rows), ?dim=TABLE (one column), ?open=0,2 (bands).
import { useEffect, useState } from 'react';
import { matrixColumns, unslug, type Band, type CoreModel } from '../../../explorer/data';

export interface Sel {
  /** bus-matrix rows picked (a first) */
  a: number | null;
  b: number | null;
  /** bus-matrix column picked */
  dim: number | null;
  /** long-tail bands shown open */
  open: Set<number>;
}

export interface Layout {
  head: number[];
  bands: Band[];
  /** column -> band index, -1 for head columns */
  bandOf: number[];
}

const layoutCache = new WeakMap<CoreModel, Layout>();
export function matrixLayout(m: CoreModel): Layout {
  let l = layoutCache.get(m);
  if (!l) {
    const { head, bands } = matrixColumns(m, 29);
    const bandOf = new Array<number>(m.bus.columns.length).fill(-1);
    bands.forEach((b, k) => b.cols.forEach((c) => { bandOf[c] = k; }));
    l = { head, bands, bandOf };
    layoutCache.set(m, l);
  }
  return l;
}

const rowOfSlug = (m: CoreModel, s: string | undefined): number | null => {
  if (!s) return null;
  const sa = unslug(m, s);
  return sa === undefined || m.subjectAreas[sa].row < 0 ? null : m.subjectAreas[sa].row;
};

/** ?dim= accepts DW_NS_EMPLOYEE_D, EMPLOYEE_D or EMPLOYEE. */
export function colOfName(m: CoreModel, s: string | undefined): number | null {
  if (!s) return null;
  const u = s.trim().toUpperCase();
  for (const name of [u, `DW_NS_${u}`, `DW_NS_${u}_D`]) {
    const t = m.tableByName.get(name);
    if (t !== undefined && m.tables[t].col >= 0) return m.tables[t].col;
  }
  return null;
}

export function readSel(m: CoreModel, q: Record<string, string>): Sel {
  let a = rowOfSlug(m, q.a);
  let b = rowOfSlug(m, q.b);
  if (a === null && b !== null) { a = b; b = null; }
  if (a !== null && a === b) b = null;
  const dim = a === null ? colOfName(m, q.dim) : null;
  const { bands, bandOf } = matrixLayout(m);
  const open = new Set((q.open ?? '').split(',').filter((x) => x !== '').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < bands.length));
  if (dim !== null && bandOf[dim] >= 0) open.add(bandOf[dim]);
  return { a, b, dim, open };
}

/** The query patch that writes a selection. */
export function selQuery(m: CoreModel, s: Sel): Record<string, string | null> {
  const slugOf = (r: number | null) => (r === null ? null : m.subjectAreas[m.bus.rows[r]].slug);
  return {
    a: slugOf(s.a),
    b: slugOf(s.b),
    dim: s.dim === null ? null : m.tables[m.bus.columns[s.dim]].name,
    open: s.open.size ? [...s.open].sort().join(',') : null,
  };
}

/** Clicking a row: first click picks A, a second row picks B, clicking a picked row lets it go. */
export function pickRow(s: Sel, r: number): Sel {
  let { a, b } = s;
  if (a === null) a = r;
  else if (b === null) { if (r === a) a = null; else b = r; }
  else if (r === a) { a = b; b = null; }
  else if (r === b) b = null;
  else b = r;
  return { ...s, a, b, dim: null };
}

export const ordinal = (n: number): string => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
};

/** true while the media query matches. */
export function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [query]);
  return on;
}

export const PHONE = '(max-width: 759px)';
