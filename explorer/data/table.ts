// One warehouse table, any role: what the files state about it, plus the bus-matrix neighbourhood that fits its role.
// Dimensions: reach by functional area, report folders, facts in the same areas.
// Facts: dimension tables in the same subject areas, ranked by how many of the fact's areas list them.

import { reportFoldersReading, type FolderCount } from './folders';
import { grainOf, grainSentence, headerOf, linesOf } from './grain';
import { areasWithFact, dimensionReach, dimensionsWithFact, factsInSameAreas, reach } from './matrix';
import { isFact } from './model';
import { prettyTable } from './names';
import type { ColumnModel, CoreModel, GrainEntry, HeaderLink, ReachByArea, TableRole } from './types';

export interface TableRecord {
  /** netsuiteRecord index */
  rec: number;
  name: string;
  key: string;
}

export interface AreasByFa {
  fa: number;
  name: string;
  /** subject areas, by label */
  areas: number[];
}

export interface TableSummary {
  t: number;
  name: string;
  pretty: string;
  role: TableRole;
  secured: boolean;
  derived: boolean;
  columns: number;
  grain: GrainEntry[];
  grainSentence: string | null;
  header: HeaderLink | null;
  lines: number[];
  /** NetSuite records the table is loaded from (loadedFrom, stated) */
  records: TableRecord[];
  /** subject areas whose bus-matrix row lists the table (as a fact or a shared dimension), grouped by functional area */
  listedIn: AreasByFa[];
  /** subject areas reading any of its columns (column level), grouped by functional area; null until columns load */
  readBy: AreasByFa[] | null;
  /** bus-matrix column, -1 when it is not a shared dimension */
  col: number;
  dimension: null | {
    reach: number;
    byArea: ReachByArea[];
    /** empty until columns load */
    folders: FolderCount[];
    facts: { table: number; areas: number }[];
  };
  fact: null | {
    /** subject areas where the bus matrix lists it as a fact, in matrix order */
    areas: number[];
    dimensions: { table: number; col: number; areas: number }[];
  };
}

function groupByFa(m: CoreModel, sas: Iterable<number>): AreasByFa[] {
  const by = new Map<number, number[]>();
  for (const sa of new Set(sas)) { const fa = m.subjectAreas[sa].fa; (by.get(fa) ?? by.set(fa, []).get(fa)!).push(sa); }
  return [...by].sort((a, b) => (a[0] < 0 ? 1 : b[0] < 0 ? -1 : a[0] - b[0]))
    .map(([fa, areas]) => ({ fa, name: fa >= 0 ? m.functionalAreas[fa].name : '', areas: areas.sort((x, y) => m.subjectAreas[x].label.localeCompare(m.subjectAreas[y].label)) }));
}

const recordsCache = new WeakMap<CoreModel, number[][]>();
/** physicalTable -> NetSuite records (loadedFrom edges in core.json). */
function loadedFrom(m: CoreModel): number[][] {
  let r = recordsCache.get(m);
  if (!r) {
    r = m.tables.map(() => []);
    const g = m.core.edges.find((e) => e.type === 'loadedFrom' && e.from === 'physicalTable' && e.to === 'netsuiteRecord');
    if (g) for (let k = 0; k < g.n; k++) r[g.pairs[2 * k]].push(g.pairs[2 * k + 1]);
    recordsCache.set(m, r);
  }
  return r;
}

export function tableSummary(m: CoreModel, cm: ColumnModel | null | undefined, t: number): TableSummary {
  const info = m.tables[t];
  const REC = m.core.nodes.netsuiteRecord!.cols;
  const records = loadedFrom(m)[t].map((rec) => ({ rec, name: String(REC.name[rec]), key: m.recordKey[rec] }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const listed: number[] = [];
  m.bus.rows.forEach((sa, r) => { if (m.factsOfSa[sa].includes(t) || (info.col >= 0 && m.rowSets[r].has(info.col))) listed.push(sa); });

  const dimension = info.col >= 0 ? {
    reach: reach(m, info.col),
    byArea: dimensionReach(m, info.col),
    folders: cm ? reportFoldersReading(m, cm, t) : [],
    facts: factsInSameAreas(m, info.col),
  } : null;

  const factAreas = areasWithFact(m, t);
  const fact = isFact(m, t) || factAreas.length ? {
    areas: factAreas,
    dimensions: dimensionsWithFact(m, t).map(({ col, areas }) => ({ table: m.bus.columns[col], col, areas })),
  } : null;

  const h = headerOf(m, t);
  return {
    t, name: info.name, pretty: prettyTable(m, info.name), role: info.role, secured: info.isSecured, derived: info.derived,
    columns: cm ? cm.tableCols[t].length : info.columns,
    grain: grainOf(m, t), grainSentence: grainSentence(m, t), header: h ?? null, lines: linesOf(m, t),
    records, listedIn: groupByFa(m, listed), readBy: cm ? groupByFa(m, cm.tableSas[t]) : null,
    col: info.col, dimension, fact,
  };
}
