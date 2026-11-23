// The subject-area flow: the facts the bus matrix lists for one area that Oracle's 26R4 data model draws, and the
// tables their diagrams relate them to, each with how many of those facts relate to it ("2 of 4 facts").
// Facts listed without a diagram (mostly _SEC tables) are kept apart as "also listed". Also: the subject areas
// that list a table, and an area's neighbours in its functional area (the level bar).
// Stated only: facts per area come from the bus matrix, relations from relatesTo. No direction or cardinality.

import { areaSummary } from './area';
import { hasModel, modelRelations } from './relations';
import type { ColumnModel, CoreModel, ModelRelation } from './types';

export interface FlowFact {
  /** position in AreaFlow.facts */
  i: number;
  table: number;
  name: string;
  /** stated grain sentence, or null */
  grain: string | null;
  /** tables its diagram relates it to, widest reach first */
  rels: ModelRelation[];
}

export interface FlowTable extends ModelRelation {
  /** position in AreaFlow.tables */
  i: number;
  /** FlowFact positions whose diagram draws this table, ascending */
  facts: number[];
}

export interface AreaFlow {
  sa: number;
  /** fact tables the bus matrix lists for the area (grain first, then by name) */
  listed: number;
  /** listed facts that have a data-model diagram, in the same order */
  facts: FlowFact[];
  /**
   * tables those diagrams draw: most facts first, then by which facts (so tables shared by the same facts sit
   * together), then widest reach, then readable name
   */
  tables: FlowTable[];
  /** tables related to two or more of the facts */
  shared: number;
  /** listed facts without a diagram (physicalTable indexes), in listing order */
  others: number[];
}

const cache = new WeakMap<CoreModel, Map<number, AreaFlow>>();

export function areaFlow(m: CoreModel, sa: number): AreaFlow {
  let per = cache.get(m);
  if (!per) cache.set(m, (per = new Map()));
  const hit = per.get(sa);
  if (hit) return hit;

  const s = areaSummary(m, null, sa);
  const facts: FlowFact[] = s.facts.filter((f) => hasModel(m, f.table))
    .map((f, i) => ({ i, table: f.table, name: f.name, grain: f.grain, rels: modelRelations(m, f.table) }));
  const byT = new Map<number, FlowTable>();
  for (const f of facts) for (const r of f.rels) {
    let d = byT.get(r.table);
    if (!d) byT.set(r.table, (d = { ...r, i: 0, facts: [] }));
    if (!d.facts.includes(f.i)) d.facts.push(f.i);
  }
  const sig = (d: FlowTable) => facts.map((f) => (d.facts.includes(f.i) ? '1' : '0')).join('');
  const tables = [...byT.values()].sort((a, b) =>
    b.facts.length - a.facts.length || sig(b).localeCompare(sig(a)) || b.reach - a.reach || a.display.localeCompare(b.display) || a.table - b.table);
  tables.forEach((d, i) => { d.i = i; });
  const flow: AreaFlow = {
    sa,
    listed: s.facts.length,
    facts,
    tables,
    shared: tables.filter((d) => d.facts.length >= 2).length,
    others: s.facts.filter((f) => !hasModel(m, f.table)).map((f) => f.table),
  };
  per.set(sa, flow);
  return flow;
}

/** The flow table for a physicalTable in this area's flow, or undefined. */
export const flowTable = (flow: AreaFlow, t: number): FlowTable | undefined => flow.tables.find((d) => d.table === t);

/** The flow fact for a physicalTable in this area's flow, or undefined. */
export const flowFact = (flow: AreaFlow, t: number): FlowFact | undefined => flow.facts.find((f) => f.table === t);

/**
 * Subject areas where the bus matrix lists the table, as a fact or as a dimension column, in matrix order
 * (functional area, then row).
 */
export function areasOfTable(m: CoreModel, t: number): number[] {
  const col = m.tables[t]?.col ?? -1;
  return m.bus.rows.filter((sa, r) => m.factsOfSa[sa].includes(t) || (col >= 0 && m.rowSets[r].has(col)));
}

/** The subject areas before and after this one in its functional area (bus-matrix order), or null at either end. */
export function areaNeighbours(m: CoreModel, sa: number): { prev: number | null; next: number | null } {
  const fa = m.subjectAreas[sa]?.fa ?? -1;
  if (fa < 0) return { prev: null, next: null };
  const sibs = m.functionalAreas[fa].subjectAreas;
  const at = sibs.indexOf(sa);
  return { prev: at > 0 ? sibs[at - 1] : null, next: at >= 0 && at < sibs.length - 1 ? sibs[at + 1] : null };
}

/** One NetSuite field with a count (subject areas reached, or report columns in one area). */
export interface FieldCount {
  /** netsuiteField index */
  field: number;
  /** record key, e.g. "transactions" */
  record: string;
  /** field name as the lineage spells it, e.g. "TRANID" */
  name: string;
  /** "transactions.tranid", lower-case: record and field for fieldPath */
  key: string;
  n: number;
}

function fieldCount(cm: ColumnModel, f: number, n: number): FieldCount {
  const record = cm.core.recordKey[cm.nfRecord[f]];
  return { field: f, record, name: cm.nfName[f], key: `${record}.${cm.nfName[f].toLowerCase()}`, n };
}

/**
 * NetSuite fields reaching the most subject areas (through their warehouse columns), most first, then by key.
 * At most `perRecord` fields per NetSuite record, so one wide record (subsidiary) does not fill the list.
 */
export function topFields(cm: ColumnModel, n = 12, perRecord = 1): FieldCount[] {
  const all: FieldCount[] = [];
  cm.fieldSas.forEach((s, f) => { if (s.length) all.push(fieldCount(cm, f, s.length)); });
  all.sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
  const per = new Map<string, number>();
  const out: FieldCount[] = [];
  for (const x of all) {
    const k = per.get(x.record) ?? 0;
    if (k >= perRecord) continue;
    per.set(x.record, k + 1);
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

/**
 * NetSuite fields behind one subject area's facts: fields a listed fact's warehouse columns are loaded from, counted
 * by the area's report columns that read those columns. Most report columns first, then by key.
 */
export function areaFields(m: CoreModel, cm: ColumnModel, sa: number, n = 12): FieldCount[] {
  const facts = new Set(m.factsOfSa[sa]);
  const cnt = new Map<number, Set<number>>();
  cm.prcSa.forEach((x, p) => {
    if (x !== sa) return;
    for (const c of cm.presPhys[p]) {
      if (!facts.has(cm.pcTable[c])) continue;
      for (const f of cm.colSrc[c]) (cnt.get(f) ?? cnt.set(f, new Set()).get(f)!).add(p);
    }
  });
  return [...cnt].map(([f, ps]) => fieldCount(cm, f, ps.size))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).slice(0, n);
}
