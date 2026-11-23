// Public types of the explorer data module. Pure data: no React, no DOM.
// Every index refers to a node table in public/ontology/*.json (see ontology/types.ts):
//   subject area `sa`, functional area `fa`, physical table `t`, physical column `c`,
//   presentation table `pt`, presentation column `p`, NetSuite record `r`, NetSuite field `f`,
//   bus-matrix row `row` (index into busMatrix.rows) and bus-matrix column `col` (index into busMatrix.columns).

import type { BusMatrix, CoreJson, EntityKey } from '../../ontology/types';

/** Warehouse table role, as the ontology build writes it (`physicalTable.role`). */
export type TableRole = 'fact' | 'dimension' | 'hierarchy' | 'calculated' | 'enhanced' | 'global' | 'prediction' | 'security' | 'unknown';

/** Grain class of one Entity Key List entry. line = id + transaction, document = id, book = includes accountingbook. */
export type Grain = 'line' | 'document' | 'book' | 'other';

/** One Entity Key List entry for one table, as the list states it. */
export interface GrainEntry {
  /** Entity name in the key list, e.g. "Sales Order Transaction Line". */
  entity: string;
  /** Key columns, lower-case, sorted alphabetically. */
  cols: string[];
  /** Key columns the list names that are not columns of this table (lower-case). Used only to order entries. */
  missing: string[];
  grain: Grain;
}

/** A line table's header: the key list gives one key to `id` in the header and to `col` in the line table. */
export interface HeaderLink {
  /** header physicalTable index */
  table: number;
  /** the line table's column that holds the header id, as the key list spells it (e.g. "transaction") */
  col: string;
  /** entity name in the key list */
  entity: string;
  /** the key's name in the key list (e.g. "SalesOrdTransactions_id") */
  key: string;
  /** other tables the same key is listed for with `id` (snapshots), physicalTable indexes */
  also: number[];
}

export interface GrainIndex {
  /** physicalTable -> entries, unsorted (use grainOf() for the canonical order) */
  entries: Map<number, GrainEntry[]>;
  header: Map<number, HeaderLink>;
  /** header physicalTable -> its line tables */
  lines: Map<number, number[]>;
}

export interface FunctionalAreaInfo {
  i: number;
  name: string;
  /** subject areas in bus-matrix row order */
  subjectAreas: number[];
}

export interface SubjectAreaInfo {
  i: number;
  /** semantic-model name, e.g. "NetSuite - Sales Order" */
  name: string;
  /** display label, e.g. "Sales Order" */
  label: string;
  /** URL slug, unique across all subject areas */
  slug: string;
  /** functional area index, -1 when none */
  fa: number;
  presentationTables: number;
  presentationColumns: number;
  physicalTables: number;
  facts: number;
  dimensions: number;
  /** bus-matrix row, -1 when the area has no row */
  row: number;
}

export interface TableInfo {
  i: number;
  name: string;
  role: TableRole;
  isSecured: boolean;
  /** NSAW-generated (calendar and the like) */
  derived: boolean;
  columns: number;
  saCount: number;
  lineageRows: number;
  /** bus-matrix column, -1 when it is not a shared dimension */
  col: number;
}

/** Indexes built from core.json only (buildCore). */
export interface CoreModel {
  core: CoreJson;
  bus: BusMatrix;
  functionalAreas: FunctionalAreaInfo[];
  subjectAreas: SubjectAreaInfo[];
  tables: TableInfo[];
  /** upper-case table name -> physicalTable */
  tableByName: Map<string, number>;
  /** slug -> subject area */
  saBySlug: Map<string, number>;
  /** presentationTable -> subject area */
  ptSa: number[];
  /** presentationTable -> its name, trimmed */
  ptName: string[];
  /** netsuiteRecord -> key (lower-case record id used in field keys) */
  recordKey: string[];
  /** entity -> name and keys */
  entities: { name: string; domainCode: string; keys: EntityKey[] }[];
  /** bus-matrix row -> set of bus-matrix columns listed in that row */
  rowSets: Set<number>[];
  /** subject area -> fact physicalTables the bus matrix lists for it (unique, as listed) */
  factsOfSa: number[][];
  grain: GrainIndex;
}

/** Column-level indexes built from columns.json (buildColumns). Arrays are indexed by node index. */
export interface ColumnModel {
  core: CoreModel;
  /** physicalColumn -> physicalTable (-1 for SQL-sourced columns) */
  pcTable: number[];
  pcName: string[];
  /** netsuiteField -> netsuiteRecord */
  nfRecord: number[];
  nfName: string[];
  /** presentationColumn -> presentationTable */
  prcPt: number[];
  prcName: string[];
  /** presentationColumn -> subject area */
  prcSa: number[];
  /** physicalTable -> its physicalColumns (in file order) */
  tableCols: number[][];
  /** physicalColumn -> NetSuite fields it is loaded from (sourcedFrom) */
  colSrc: number[][];
  /** netsuiteField -> physicalColumns loaded from it */
  fieldCols: number[][];
  /** physicalColumn -> presentationColumns that map to it (mapsTo, reversed) */
  physPres: number[][];
  /** presentationColumn -> physicalColumns it maps to (mapsTo) */
  presPhys: number[][];
  /** physicalColumn -> subject areas (sorted) whose presentation columns map to it */
  colSas: number[][];
  /** physicalTable -> subject areas (sorted) that read any of its columns */
  tableSas: number[][];
  /** netsuiteField -> subject areas (sorted) reached through its columns */
  fieldSas: number[][];
  /** netsuiteRecord -> its fields */
  recordFields: number[][];
  /** "record.field" lower-case -> netsuiteField */
  fieldByKey: Map<string, number>;
}

/** compare(): bus-matrix columns, each list sorted by reach (most shared first). */
export interface Comparison {
  onlyA: number[];
  onlyB: number[];
  both: number[];
}

/** One long-tail band of bus-matrix columns. */
export interface Band {
  cols: number[];
  /** smallest and largest reach in the band */
  lo: number;
  hi: number;
  label: string;
}

export interface MatrixRowGroup {
  fa: number;
  name: string;
  rows: { row: number; sa: number; label: string; dims: number }[];
}

export interface ReachByArea {
  fa: number;
  name: string;
  /** subject areas in this functional area that have a bus-matrix row */
  total: number;
  /** of those, how many list the dimension */
  has: number;
}

/** One table in a data-model relation (modelRelations / modelFactsOf). */
export interface ModelRelation {
  /** physicalTable index */
  table: number;
  name: string;
  /** readable name (prettyTable) */
  display: string;
  role: TableRole;
  /** subject areas the bus matrix lists the table under */
  reach: number;
  /** fact or enhanced fact */
  isFact: boolean;
}
