// One subject area: its functional area, the fact tables the bus matrix lists with their grain, the shared
// dimensions its row lists, and its report folders.

import { grainOf, grainSentence, keyOrder } from './grain';
import { dimsOf, reach } from './matrix';
import type { ColumnModel, CoreModel } from './types';

export interface AreaFact {
  table: number;
  name: string;
  /** "One row per sales order transaction line.", or null when the key list gives the table no entry */
  grain: string | null;
  /** key-list entity name of the leading entry, or null */
  entity: string | null;
  /** key columns of the leading entry in reading order; empty when none */
  key: string[];
  secured: boolean;
}

export interface AreaFolder {
  /** presentationTable index */
  pt: number;
  name: string;
  /** report columns in the folder */
  columns: number;
}

export interface AreaTableRead {
  table: number;
  /** report columns in this area reading the table */
  reportColumns: number;
}

export interface AreaSummary {
  sa: number;
  name: string;
  label: string;
  slug: string;
  fa: number;
  faName: string;
  /** facts with a stated grain first, then by name */
  facts: AreaFact[];
  /** bus-matrix columns its row lists, most shared first */
  dimensions: number[];
  /** report folders in semantic-model order */
  folders: AreaFolder[];
  reportColumns: number;
  /** warehouse tables this area reads (column level), most report columns first; empty until columns load */
  tablesRead: AreaTableRead[];
}

export function areaSummary(m: CoreModel, cm: ColumnModel | null | undefined, sa: number): AreaSummary {
  const s = m.subjectAreas[sa];
  const facts = m.factsOfSa[sa].map((t): AreaFact => {
    const g = grainOf(m, t)[0];
    return { table: t, name: m.tables[t].name, grain: grainSentence(m, t), entity: g?.entity ?? null, key: g ? keyOrder(g.cols) : [], secured: m.tables[t].isSecured };
  }).sort((a, b) => Number(!a.grain) - Number(!b.grain) || a.name.localeCompare(b.name));
  const dimensions = dimsOf(m, sa).slice().sort((x, y) => reach(m, y) - reach(m, x) || x - y);
  const PRT = m.core.nodes.presentationTable!.cols;
  const folders: AreaFolder[] = [];
  m.ptSa.forEach((x, pt) => { if (x === sa) folders.push({ pt, name: m.ptName[pt], columns: Number(PRT.columns?.[pt] ?? 0) }); });

  const tablesRead: AreaTableRead[] = [];
  if (cm) {
    const cnt = new Map<number, number>();
    cm.prcSa.forEach((x, p) => {
      if (x !== sa) return;
      const ts = new Set(cm.presPhys[p].map((c) => cm.pcTable[c]).filter((t) => t >= 0));
      for (const t of ts) cnt.set(t, (cnt.get(t) ?? 0) + 1);
    });
    for (const [table, reportColumns] of cnt) tablesRead.push({ table, reportColumns });
    tablesRead.sort((a, b) => b.reportColumns - a.reportColumns || m.tables[a.table].name.localeCompare(m.tables[b.table].name));
  }

  return {
    sa, name: s.name, label: s.label, slug: s.slug, fa: s.fa, faName: s.fa >= 0 ? m.functionalAreas[s.fa].name : '',
    facts, dimensions, folders, reportColumns: s.presentationColumns, tablesRead,
  };
}
