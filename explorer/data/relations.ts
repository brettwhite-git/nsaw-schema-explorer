// Data-model relations: Oracle's NSAW Data Models diagrams (26R4) draw one star per fact, FACT -- TABLE.
// core.json holds them as the explicit edge group `relatesTo` (physicalTable fact -> related physicalTable).
// A relation states only that the diagram draws the pair: no join columns, direction or cardinality.

import { isFact } from './model';
import { prettyTable } from './names';
import type { CoreModel, ModelRelation, TableRole } from './types';

interface RelIndex {
  /** fact -> related tables */
  out: Map<number, number[]>;
  /** related table -> facts whose diagram draws it */
  in: Map<number, number[]>;
  /** fact -> diagram area */
  area: Map<number, string>;
  edges: number;
}
const cache = new WeakMap<CoreModel, RelIndex>();

function relIndex(m: CoreModel): RelIndex {
  let x = cache.get(m);
  if (!x) {
    x = { out: new Map(), in: new Map(), area: new Map(), edges: 0 };
    for (const g of m.core.edges) {
      if (g.type !== 'relatesTo' || g.from !== 'physicalTable' || g.to !== 'physicalTable') continue;
      for (let k = 0; k < g.n; k++) {
        const f = g.pairs[2 * k], t = g.pairs[2 * k + 1];
        (x.out.get(f) ?? x.out.set(f, []).get(f)!).push(t);
        (x.in.get(t) ?? x.in.set(t, []).get(t)!).push(f);
        x.edges++;
      }
    }
    const areas = m.core.nodes.physicalTable?.cols.modelArea as (string | null)[] | undefined;
    areas?.forEach((a, t) => { if (a) x!.area.set(t, a); });
    cache.set(m, x);
  }
  return x;
}

/** Subject areas the bus matrix lists the table under (as a dimension column or as a fact). */
export const modelReach = (m: CoreModel, t: number): number => m.tables[t].saCount;

function relation(m: CoreModel, t: number): ModelRelation {
  const name = m.tables[t].name;
  return { table: t, name, display: prettyTable(m, name), role: m.tables[t].role as TableRole, reach: modelReach(m, t), isFact: isFact(m, t) };
}

const byReachThenName = (a: ModelRelation, b: ModelRelation) => b.reach - a.reach || a.name.localeCompare(b.name);

/** True when the table is the fact of a data-model diagram. */
export const hasModel = (m: CoreModel, t: number): boolean => relIndex(m).out.has(t);

/** True when some fact's diagram draws this table. */
export const inModel = (m: CoreModel, t: number): boolean => relIndex(m).in.has(t);

/** Area of the fact's data-model diagram ("Order to Cash" and the like), or '' when it has none. */
export const modelArea = (m: CoreModel, t: number): string => relIndex(m).area.get(t) ?? '';

/** Tables the fact's diagram draws, widest reach first, then by name. Empty when the table has no diagram. */
export function modelRelations(m: CoreModel, fact: number): ModelRelation[] {
  return (relIndex(m).out.get(fact) ?? []).map((t) => relation(m, t)).sort(byReachThenName);
}

/** Facts whose diagram draws this table (usually a dimension), widest reach first, then by name. */
export function modelFactsOf(m: CoreModel, t: number): ModelRelation[] {
  return (relIndex(m).in.get(t) ?? []).map((f) => relation(m, f)).sort(byReachThenName);
}

/** Totals: relatesTo edges, facts with a diagram, tables some diagram draws. */
export function modelCounts(m: CoreModel): { relations: number; facts: number; related: number } {
  const x = relIndex(m);
  return { relations: x.edges, facts: x.out.size, related: x.in.size };
}
