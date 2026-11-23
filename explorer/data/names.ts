// Names: subject-area slugs, readable table names, number formatting.

import type { CoreModel } from './types';

/** "Sales Order" -> "sales-order". */
export const slugify = (s: string): string => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Unique slugs for a list of labels, in order. A repeated slug gets -2, -3 and so on. */
export function uniqueSlugs(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((l) => {
    const base = slugify(l) || 'area';
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** Subject area -> its URL slug. */
export const slug = (m: CoreModel, sa: number): string => m.subjectAreas[sa].slug;

/** Slug (or a label typed by hand) -> subject area, or undefined. */
export const unslug = (m: CoreModel, s: string): number | undefined => m.saBySlug.get(s.toLowerCase()) ?? m.saBySlug.get(slugify(s));

/** 12345 -> "12,345". */
export const fmt = (n: number): string => n.toLocaleString('en-US');

/** plural(1, 'area') -> "1 area"; plural(3, 'entry', 'entries') -> "3 entries". */
export const plural = (n: number, one: string, many = one + 's'): string => `${fmt(n)} ${n === 1 ? one : many}`;

/** "DW_NS_CUSTOMER_D_SEC" -> "DW_NS_CUSTOMER_D". For grouping a pair in a list; it states no relation. */
export const unsecuredName = (name: string): string => name.replace(/_SEC$/i, '');

// ------------------------------------------------------------------ readable table names
// Spelled from report folder names (presentation tables) in the semantic model, as the bus-matrix lab does:
// a table whose name matches a folder takes the folder's spelling; otherwise its words are split with the
// folders' vocabulary (UNITSTYPEUOM -> Units Type UOM).

const EXTRA_WORDS = [
  'uom', 'units', 'costing', 'method', 'subtype', 'payment', 'instrument', 'merchandise', 'hierarchy', 'node', 'version',
  'ship', 'revrec', 'rev', 'rec', 'planned', 'ratable', 'forecast', 'recurrence', 'revenue', 'event', 'type',
  'amortization', 'billing', 'schedule', 'pattern', 'bom', 'revision', 'component', 'classification', 'consolidated',
  'exchange', 'rate', 'effectivity', 'based', 'on', 'fiscal', 'cal', 'period', 'inventory', 'item', 'locations', 'job',
  'resource', 'role', 'manufacturing', 'cost', 'template', 'operation', 'task', 'project', 'constraint', 'reforecast',
  'amount', 'source', 'change', 'impact', 'date', 'scheduling', 'subscription', 'order', 'action', 'modification',
  'option', 'vsoe', 'sop', 'group', 'workplace', 'main', 'address', 'email', 'preference', 'policy', 'categories',
  'reporting', 'section', 'support', 'case', 'origin', 'work', 'calendar', 'holiday', 'plan', 'subsidiary', 'map',
  'relationship', 'company', 'feature', 'setup', 'accounting', 'book', 'subsidiaries', 'assembly', 'assignment',
  'expense', 'report', 'next', 'transaction', 'line', 'link', 'status', 'vendor',
];
const ACRONYM = new Set(['uom', 'bom', 'vsoe', 'sop']);
/** Role suffixes a table name ends with, longest first. They are dropped from the readable name. */
const ROLE_SUFFIX = /_(CF_DH|DH|EF|CF|SEC|D|F|G)$/i;
/** When two tables read the same once suffixes are dropped, the less common one gets a word for its suffix. */
const QUALIFIER: Record<string, string> = { EF: 'Enhanced', DH: 'Hierarchy', CF_DH: 'Hierarchy', CF: 'Calculated', G: 'Global' };
interface Vocab { vocab: Set<string>; folders: Map<string, string>; bases: Map<string, Set<string>> }
const vocabCache = new WeakMap<CoreModel, Vocab>();

function vocabOf(m: CoreModel): Vocab {
  let v = vocabCache.get(m);
  if (!v) {
    const vocab = new Set<string>(EXTRA_WORDS);
    const folders = new Map<string, string>();
    for (const n of m.ptName) {
      const k = n.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (!folders.has(k)) folders.set(k, n);
      for (const w of n.toLowerCase().split(/[^a-z]+/)) if (w.length > 1) vocab.add(w);
    }
    const bases = new Map<string, Set<string>>();
    for (const t of m.tables) {
      const { base, suffix } = parts(t.name);
      const k = base.replace(/_/g, '').toLowerCase();
      (bases.get(k) ?? bases.set(k, new Set()).get(k)!).add(suffix);
    }
    v = { vocab, folders, bases };
    vocabCache.set(m, v);
  }
  return v;
}

/** "DW_NS_LOCATION_CF_DH_SEC" -> base "LOCATION", suffix "CF_DH". */
function parts(name: string): { base: string; suffix: string } {
  const c = name.replace(/^DW_NS_/i, '').replace(/_SEC$/i, '');
  const m = ROLE_SUFFIX.exec(c);
  return m ? { base: c.slice(0, m.index), suffix: m[1].toUpperCase() } : { base: c, suffix: '' };
}

function segment(w: string, vocab: Set<string>): string[] {
  const best: (string[] | null)[] = [[]];
  for (let i = 1; i <= w.length; i++) {
    best[i] = null;
    for (let j = Math.max(0, i - 16); j < i; j++) {
      const piece = w.slice(j, i);
      const prev = best[j];
      if (prev && vocab.has(piece) && (!best[i] || prev.length + 1 < best[i]!.length)) best[i] = [...prev, piece];
    }
  }
  return best[w.length] ?? [w];
}

/** "DW_NS_CUSTOMER_D" -> "Customer". The _SEC suffix and the role suffix are dropped. */
export function prettyTable(m: CoreModel, name: string): string {
  const { vocab, folders, bases } = vocabOf(m);
  const { base, suffix } = parts(name);
  const flat = base.replace(/_/g, '').toLowerCase();
  // A suffix word only when another table shares the base and this one is not the plain _D / _F table.
  const q = (bases.get(flat)?.size ?? 0) > 1 ? QUALIFIER[suffix] : undefined;
  const hit = folders.get(flat);
  const text = hit ?? base
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')        // camelCase names keep their word breaks
    .toLowerCase().split('_').filter(Boolean).flatMap((w) => segment(w, vocab))
    .map((w) => (ACRONYM.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  return q ? `${text} ${q}` : text;
}

/** Table name without the DW_NS_ prefix, for tight lists. */
export const shortTable = (name: string): string => name.replace(/^DW_NS_/i, '');
