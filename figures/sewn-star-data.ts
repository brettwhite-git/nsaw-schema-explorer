// Which tables the sewn star draws for a subject area. Pure: no DOM, tested against the real ontology.
//
// Honest by construction: a dimension is "with" a fact when both appear in the same subject area
// (co-occurrence, drawn as an inferred thread). It is not a verified join. The cap is stated on the figure.
import type { Ontology } from '../ontology/load';

export const DEFAULT_CAP = 8;

export interface StarTable { i: number; name: string }
export interface StarDim extends StarTable { saCount: number; derived: boolean; /** presentation columns of THIS subject area it feeds (0 when columns.json is not loaded) */ feeds: number }
/** a dimension is universal when this share of all subject areas (or more) use it: location, department, day, currency... */
export const UNIVERSAL_SHARE = 0.9
export interface StarData {
  subjectArea: { i: number; name: string; label: string };
  /** the primary fact, or null when the subject area has no (unsecured) fact table */
  fact: StarTable | null;
  /** the most-shared dimensions, at most `cap`, most shared first */
  dims: StarDim[];
  /** the dimensions every subject area shares, bundled into one tag; not counted in totalDims */
  universal: StarDim[];
  /** how the drawn ones were ranked: by presentation columns fed in this subject area, or by how widely shared they are */
  rankedBy: 'columns' | 'shared';
  /** every non-universal dimension found for this subject area */
  totalDims: number;
  /** totalDims - dims.length: said on the figure, never dropped silently */
  notDrawn: number;
}

/** 1 for a line-level table (the _LINES_F table is finer than its header _F). _SEC twins are filtered out before this. */
export const finerGrain = (name: string): number => (/_LINES?(_|$)/.test(name) ? 1 : 0);

const STOP = new Set(['and', 'of', 'the', 'for', 'to', 'by', 'a']);
const tokens = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));

/** Token overlap of subject area label with table name (CLAUDE.md: >= 50% of the label's tokens). */
export function nameOverlap(label: string, table: string): number {
  const want = tokens(label);
  if (!want.length) return 0;
  const have = new Set(tokens(table.replace(/^DW_NS_/i, '')));
  return want.filter((t) => have.has(t)).length / want.length;
}

export function selectStar(o: Ontology, subjectAreaKey: string, cap = DEFAULT_CAP): StarData | undefined {
  const sai = o.find('subjectArea', subjectAreaKey);
  if (sai === undefined) return undefined;
  const sa = o.get('subjectArea', sai);
  const bm = o.busMatrix;
  const row = bm.rows.indexOf(sai);

  // primary fact: unsecured fact tables of this subject area, best name overlap first
  let fact: StarTable | null = null;
  if (row >= 0) {
    const cands = bm.facts[row]
      .map((i) => ({ i, t: o.get('physicalTable', i) }))
      .filter((c) => !c.t.isSecured && (c.t.role === 'fact' || c.t.role === 'enhanced'))
      .map((c) => ({ ...c, ov: nameOverlap(sa.label, c.t.name) }));
    cands.sort((a, b) =>
      (b.ov >= 0.5 ? 1 : 0) - (a.ov >= 0.5 ? 1 : 0) ||
      b.ov - a.ov ||
      finerGrain(b.t.name) - finerGrain(a.t.name) ||
      (b.t.role === 'fact' ? 1 : 0) - (a.t.role === 'fact' ? 1 : 0) ||
      b.t.lineageRows - a.t.lineageRows ||
      a.t.name.localeCompare(b.t.name));
    if (cands[0]) fact = { i: cands[0].i, name: cands[0].t.name };
  }

  // presentation columns of this subject area fed by each physical table (needs columns.json)
  const feeds = new Map<number, number>();
  const haveCols = o.available('physicalColumn') && o.available('presentationColumn');
  if (haveCols) {
    for (const pt of o.neighbors({ type: 'subjectArea', i: sai }, 'contains'))
      for (const pc of o.neighbors(pt.ref, 'contains'))
        for (const m of o.neighbors(pc.ref, 'mapsTo')) {
          const t = o.get('physicalColumn', m.ref.i).table;
          feeds.set(t, (feeds.get(t) ?? 0) + 1);
        }
  }
  const nSa = bm.rows.length;
  const universal: StarDim[] = [];
  const all: StarDim[] = [];
  if (row >= 0) {
    for (const ci of bm.cells[row]) {
      const i = bm.columns[ci];
      if (fact && i === fact.i) continue;
      const d: StarDim = { i, name: o.get('physicalTable', i).name, saCount: bm.columnSaCount[ci], derived: bm.columnDerived[ci] === 1, feeds: feeds.get(i) ?? 0 };
      (d.saCount >= UNIVERSAL_SHARE * nSa ? universal : all).push(d);
    }
  }
  const rankedBy = haveCols ? 'columns' : 'shared';
  const key = (d: StarDim): number => (haveCols ? d.feeds : d.saCount);
  all.sort((a, b) => key(b) - key(a) || b.saCount - a.saCount || a.name.localeCompare(b.name));
  universal.sort((a, b) => a.name.localeCompare(b.name));
  const dims = all.slice(0, cap);
  return { subjectArea: { i: sai, name: sa.name, label: sa.label }, fact, dims, universal, rankedBy, totalDims: all.length, notDrawn: all.length - dims.length };
}
