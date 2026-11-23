// Grain from Oracle's Entity Key List only (entity nodes and their keys in core.json).
// Never derived from table names. A _SEC table is its own table: it shows only entries the list gives it.

import type { EntityKey } from '../../ontology/types';
import type { CoreModel, Grain, GrainEntry, GrainIndex, HeaderLink } from './types';

const GRAIN_ORDER: Grain[] = ['line', 'document', 'book', 'other'];
const KEY_ORDER = ['accountingbook', 'id', 'transaction'];

const classify = (cols: string[]): Grain =>
  cols.includes('accountingbook') ? 'book' : cols.join('+') === 'id+transaction' ? 'line' : cols.join('+') === 'id' ? 'document' : 'other';

/**
 * Build the grain index from the key list. A table whose only key in an entity is `transaction`, while the same
 * entity keys another table by `id`, is a line table pointing at that header; that entry is a link, not a grain.
 */
export function indexGrain(entities: { name: string; keys: EntityKey[] }[], tableName: (t: number) => string): GrainIndex {
  const entries = new Map<number, GrainEntry[]>();
  const header = new Map<number, HeaderLink>();
  const lines = new Map<number, number[]>();
  const isSnapshot = (t: number) => Number(/SNAPSHOT/i.test(tableName(t)));
  for (const ent of entities) {
    const byT = new Map<number, EntityKey[]>();
    for (const k of ent.keys) if (k.ti >= 0) (byT.get(k.ti) ?? byT.set(k.ti, []).get(k.ti)!).push(k);
    const idTables = [...byT].filter(([, ks]) => ks.some((k) => k.c.toLowerCase() === 'id')).map(([t]) => t);
    for (const [t, ks] of byT) {
      const cols = [...new Set(ks.map((k) => k.c.toLowerCase()))].sort();
      if (cols.length === 1 && cols[0] === 'transaction' && idTables.length) {
        const hs = idTables.filter((x) => x !== t).sort((a, b) => isSnapshot(a) - isSnapshot(b) || a - b);
        if (hs.length) {
          header.set(t, { table: hs[0], col: ks[0].c, entity: ent.name, key: ks[0].k, also: hs.slice(1) });
          (lines.get(hs[0]) ?? lines.set(hs[0], []).get(hs[0])!).push(t);
        }
        continue;
      }
      const missing = [...new Set(ks.filter((k) => k.ci < 0).map((k) => k.c.toLowerCase()))].sort();
      (entries.get(t) ?? entries.set(t, []).get(t)!).push({ entity: ent.name, cols, missing, grain: classify(cols) });
    }
  }
  return { entries, header, lines };
}

/**
 * Key-list entries for a table in canonical order: entries whose key columns are all columns of the table first,
 * then line, document, book, other, then by entity name. Empty when the list gives the table no entry.
 */
export function grainOf(m: CoreModel, t: number): GrainEntry[] {
  return (m.grain.entries.get(t) ?? []).slice().sort((a, b) =>
    Number(a.missing.length > 0) - Number(b.missing.length > 0)
    || GRAIN_ORDER.indexOf(a.grain) - GRAIN_ORDER.indexOf(b.grain)
    || a.entity.localeCompare(b.entity));
}

/** The leading grain entry, or undefined. */
export const primaryGrain = (m: CoreModel, t: number): GrainEntry | undefined => grainOf(m, t)[0];

/** The header a line table points to, from a shared entity key. */
export const headerOf = (m: CoreModel, t: number): HeaderLink | undefined => m.grain.header.get(t);

/** Line tables that point at this header table. */
export const linesOf = (m: CoreModel, t: number): number[] => m.grain.lines.get(t) ?? [];

/** Key columns in reading order: accountingbook, id, transaction, then the rest alphabetically. */
export const keyOrder = (cols: string[]): string[] =>
  [...cols].sort((a, b) => (KEY_ORDER.indexOf(a) + 1 || 99) - (KEY_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));

/** "One row per sales order transaction line." The entity name is used as the key list states it. */
export function grainSentence(m: CoreModel, t: number): string | null {
  const g = primaryGrain(m, t);
  return g ? `One row per ${singularLast(g.entity.toLowerCase())}.` : null;
}

/** Key-list entity names are sometimes plural ("Sales Order Transactions"); the sentence reads per one row. */
function singularLast(s: string): string {
  return s.replace(/([a-z]+)$/, (w) =>
    /ies$/.test(w) ? w.slice(0, -3) + 'y' : /(ss|us|is|xes)$/.test(w) || !/s$/.test(w) ? w : w.slice(0, -1));
}

const GRAIN_LABEL: Record<Grain, string> = { line: 'line', document: 'document', book: 'book line', other: 'keyed' };
/** Short label for chips and filters. A document-grain table that is not a fact reads as "record". */
export function grainLabel(m: CoreModel, t: number, g: Grain): string {
  const role = m.tables[t].role;
  return g === 'document' && role !== 'fact' && role !== 'enhanced' ? 'record' : GRAIN_LABEL[g];
}

/**
 * Facts with a grain: the one count every page uses. Over fact and enhanced-fact tables the lineage lists directly
 * under a subject area, each _SEC table counted as its own table (never paired by name), how many have an entry in
 * Oracle's Entity Key List.
 */
export function factsWithGrain(m: CoreModel): { has: number; total: number } {
  let has = 0, total = 0;
  for (const t of m.tables) {
    if ((t.role !== 'fact' && t.role !== 'enhanced') || !t.saCount) continue;
    total++;
    if (m.grain.entries.get(t.i)?.length) has++;
  }
  return { has, total };
}
