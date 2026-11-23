// Builds the explorer's indexes from the ontology JSON. Pure: runs in the browser and under Vitest in Node.
//   const m = buildCore(coreJson);              // core.json: areas, tables, bus matrix, grain
//   const cm = buildColumns(m, columnsJson);    // columns.json: column-level lineage

import { Ontology } from '../../ontology/load';
import type { CoreJson, DetailJson, EdgeGroupJson, EntityKey } from '../../ontology/types';
import { indexGrain } from './grain';
import { slugify, uniqueSlugs } from './names';
import type { ColumnModel, CoreModel, FunctionalAreaInfo, SubjectAreaInfo, TableInfo, TableRole } from './types';

const group = (groups: EdgeGroupJson[], type: string, from: string, to: string): EdgeGroupJson | undefined =>
  groups.find((g) => g.type === type && g.from === from && g.to === to);

const sortedNums = (s: Iterable<number>) => [...s].sort((a, b) => a - b);

/** Indexes from core.json alone. Cheap enough to run before first paint. */
export function buildCore(core: CoreJson): CoreModel {
  const N = core.nodes;
  const SA = N.subjectArea!.cols, FA = N.functionalArea!.cols, PT = N.physicalTable!.cols;
  const PRT = N.presentationTable!.cols, REC = N.netsuiteRecord!.cols, ENT = N.entity!.cols;
  const bus = core.busMatrix;
  const nSA = SA.name.length, nPT = PT.name.length, nFA = FA.name.length;

  const saFa = new Array<number>(nSA).fill(-1);
  const g = group(core.edges, 'inFunctionalArea', 'subjectArea', 'functionalArea');
  if (g) for (let k = 0; k < g.n; k++) saFa[g.pairs[2 * k]] = g.pairs[2 * k + 1];

  const rowOfSa = new Array<number>(nSA).fill(-1);
  bus.rows.forEach((sa, r) => { rowOfSa[sa] = r; });
  const colOfTable = new Map<number, number>();
  bus.columns.forEach((t, c) => colOfTable.set(t, c));

  const slugs = uniqueSlugs(SA.label as string[]);
  const subjectAreas: SubjectAreaInfo[] = Array.from({ length: nSA }, (_, i) => ({
    i, name: String(SA.name[i]), label: String(SA.label[i]), slug: slugs[i], fa: saFa[i],
    presentationTables: SA.presentationTables[i], presentationColumns: SA.presentationColumns[i],
    physicalTables: SA.physicalTables[i], facts: SA.facts[i], dimensions: SA.dimensions[i], row: rowOfSa[i],
  }));
  const saBySlug = new Map<string, number>();
  subjectAreas.forEach((s) => { saBySlug.set(s.slug, s.i); });
  subjectAreas.forEach((s) => { const k = slugify(s.label); if (!saBySlug.has(k)) saBySlug.set(k, s.i); });

  const order = [...bus.rows, ...subjectAreas.map((s) => s.i).filter((s) => rowOfSa[s] < 0)];
  const functionalAreas: FunctionalAreaInfo[] = Array.from({ length: nFA }, (_, i) => ({
    i, name: String(FA.name[i]), subjectAreas: order.filter((s) => saFa[s] === i),
  }));

  const tables: TableInfo[] = Array.from({ length: nPT }, (_, i) => ({
    i, name: String(PT.name[i]), role: PT.role[i] as TableRole, isSecured: !!PT.isSecured[i], derived: !!PT.derived[i],
    columns: PT.columns[i], saCount: PT.saCount[i], lineageRows: PT.lineageRows[i], col: colOfTable.get(i) ?? -1,
  }));
  const tableByName = new Map<string, number>();
  tables.forEach((t) => tableByName.set(t.name.toUpperCase(), t.i));

  const factsOfSa: number[][] = Array.from({ length: nSA }, () => []);
  bus.facts.forEach((fs, r) => { factsOfSa[bus.rows[r]] = [...new Set(fs)]; });

  const entities = (ENT.name as string[]).map((name, e) => ({ name: String(name), domainCode: String(ENT.domainCode[e] ?? ''), keys: ENT.keys[e] as EntityKey[] }));

  return {
    core, bus, functionalAreas, subjectAreas, tables, tableByName, saBySlug,
    ptSa: PRT.sa as number[], ptName: (PRT.name as string[]).map((n) => String(n).trim()),
    recordKey: REC.key as string[], entities,
    rowSets: bus.cells.map((c) => new Set(c)),
    factsOfSa,
    grain: indexGrain(entities, (t) => tables[t].name),
  };
}

/** Column-level indexes from columns.json. Build it on idle or when a column-level page needs it. */
export function buildColumns(model: CoreModel, columnsJson: DetailJson): ColumnModel {
  const o = new Ontology(model.core).attach('columns', columnsJson);
  const PC = o.columnar('physicalColumn').cols, NF = o.columnar('netsuiteField').cols, PRC = o.columnar('presentationColumn').cols;
  const nPC = PC.table.length, nNF = NF.record.length, nPRC = PRC.pt.length, nPT = model.tables.length;
  const prcSa = (PRC.pt as number[]).map((pt) => model.ptSa[pt]);

  const colSrc: number[][] = Array.from({ length: nPC }, () => []);
  const fieldCols: number[][] = Array.from({ length: nNF }, () => []);
  const sf = group(columnsJson.edges, 'sourcedFrom', 'physicalColumn', 'netsuiteField');
  if (sf) for (let k = 0; k < sf.n; k++) { const c = sf.pairs[2 * k], f = sf.pairs[2 * k + 1]; colSrc[c].push(f); fieldCols[f].push(c); }

  const physPres: number[][] = Array.from({ length: nPC }, () => []);
  const presPhys: number[][] = Array.from({ length: nPRC }, () => []);
  const mt = group(columnsJson.edges, 'mapsTo', 'presentationColumn', 'physicalColumn');
  if (mt) for (let k = 0; k < mt.n; k++) { const p = mt.pairs[2 * k], c = mt.pairs[2 * k + 1]; physPres[c].push(p); presPhys[p].push(c); }

  const tableCols: number[][] = Array.from({ length: nPT }, () => []);
  for (let c = 0; c < nPC; c++) if (PC.table[c] >= 0) tableCols[PC.table[c]].push(c);

  const colSas = physPres.map((ps) => sortedNums(new Set(ps.map((p) => prcSa[p]))));
  const tableSas = tableCols.map((cs) => { const s = new Set<number>(); for (const c of cs) for (const a of colSas[c]) s.add(a); return sortedNums(s); });
  const fieldSas = fieldCols.map((cs) => { const s = new Set<number>(); for (const c of cs) for (const a of colSas[c]) s.add(a); return sortedNums(s); });

  const recordFields: number[][] = model.recordKey.map(() => []);
  for (let f = 0; f < nNF; f++) recordFields[NF.record[f]].push(f);
  const fieldByKey = new Map<string, number>();
  for (let f = 0; f < nNF; f++) fieldByKey.set(`${model.recordKey[NF.record[f]]}.${String(NF.name[f]).toLowerCase()}`.toLowerCase(), f);

  return {
    core: model,
    pcTable: PC.table as number[], pcName: PC.name as string[],
    nfRecord: NF.record as number[], nfName: NF.name as string[],
    prcPt: PRC.pt as number[], prcName: PRC.name as string[], prcSa,
    tableCols, colSrc, fieldCols, physPres, presPhys, colSas, tableSas, fieldSas, recordFields, fieldByKey,
  };
}

// ------------------------------------------------------------------ lookups

/** Table by name, case-insensitive. */
export const findTable = (m: CoreModel, name: string): number | undefined => m.tableByName.get(name.toUpperCase());

/** Fact or enhanced fact. */
export const isFact = (m: CoreModel, t: number): boolean => m.tables[t].role === 'fact' || m.tables[t].role === 'enhanced';

/** Functional area name of a subject area, or '' when it has none. */
export const faName = (m: CoreModel, sa: number): string => (m.subjectAreas[sa].fa >= 0 ? m.functionalAreas[m.subjectAreas[sa].fa].name : '');

/** Fact tables the bus matrix lists for a subject area. */
export const factsOf = (m: CoreModel, sa: number): number[] => m.factsOfSa[sa];

/** Bus-matrix column -> physicalTable. */
export const colTable = (m: CoreModel, col: number): number => m.bus.columns[col];

/** "customer.companyname" for a field. */
export const fieldKey = (cm: ColumnModel, f: number): string => `${cm.core.recordKey[cm.nfRecord[f]]}.${cm.nfName[f].toLowerCase()}`;

/** "customer.companyname" as the workbook spells the field. */
export const fieldLabel = (cm: ColumnModel, f: number): string => `${cm.core.recordKey[cm.nfRecord[f]]}.${cm.nfName[f]}`;

/** Field by "record.field", case-insensitive. */
export const findField = (cm: ColumnModel, key: string): number | undefined => cm.fieldByKey.get(key.toLowerCase());

/** A column of a table by its name, case-insensitive. */
export const findColumn = (cm: ColumnModel, t: number, name: string): number | undefined =>
  cm.tableCols[t].find((c) => cm.pcName[c].toLowerCase() === name.toLowerCase());

/** Presentation table name of a presentation column, trimmed. */
export const presTableName = (cm: ColumnModel, p: number): string => cm.core.ptName[cm.prcPt[p]];

/** Presentation columns that map to any column of a table. */
export function tablePres(cm: ColumnModel, t: number): number[] {
  const out: number[] = [];
  for (const c of cm.tableCols[t]) out.push(...cm.physPres[c]);
  return out;
}
