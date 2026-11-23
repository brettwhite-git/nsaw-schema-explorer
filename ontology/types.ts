// Types for the JSON written by scripts/build-ontology.mjs (public/ontology/*.json).
// Shape: columnar node tables (one array per field, same length) + edge groups (flat [from,to,from,to,...] int pairs).

import type { PhysicalTableType } from './naming';

export type NodeType =
  | 'functionalArea'
  | 'subjectArea'
  | 'concept'
  | 'presentationTable'
  | 'presentationColumn'
  | 'physicalTable'
  | 'physicalColumn'
  | 'netsuiteRecord'
  | 'netsuiteField'
  | 'entity'
  | 'docGroup'
  | 'sqlSource';

export type EdgeType =
  | 'contains'
  | 'instanceOf'
  | 'mapsTo'
  | 'sourcedFrom'
  | 'securedVariantOf'
  | 'keyedBy'
  | 'inDocGroup'
  | 'inFunctionalArea'
  | 'usedWith'
  | 'loadedFrom'
  | 'entityOf'
  | 'readsFrom';

/** explicit: a source row states it. inferred: our rule / co-occurrence. curated: hand-authored rule in the repo. */
export type Provenance = 'explicit' | 'inferred' | 'curated';

export type OntologyFile = 'core' | 'columns' | 'usedwith';

/** Columnar node table. `strCols` lists columns holding indexes into the file's `strings` table. */
export interface NodeTable {
  n: number;
  strCols?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cols: Record<string, any[]>;
}

export interface EdgeGroupJson {
  type: EdgeType;
  from: NodeType;
  to: NodeType;
  n: number;
  /** flat [from0, to0, from1, to1, ...] indexes into the from/to node tables */
  pairs: number[];
  /** one provenance for the whole group, or 'mixed' with per-edge codes in `prov` (0 explicit, 1 inferred, 2 curated) */
  provenance: Provenance | 'mixed';
  prov?: number[];
  /** optional per-edge weight (usedWith: number of subject areas) */
  weight?: number[];
  note?: string;
}

export interface BusMatrix {
  note: string;
  provenance: Provenance;
  /** subject-area indexes in display order */
  rows: number[];
  /** physicalTable indexes (dimensions used in 2+ subject areas, most shared first) */
  columns: number[];
  columnSaCount: number[];
  /** 1 when the dimension is NSAW-generated (calendar etc.) */
  columnDerived: number[];
  /** cells[i] = column indexes (into `columns`) present in row i */
  cells: number[][];
  /** facts[i] = physicalTable indexes of fact tables in row i */
  facts: number[][];
  /** absent when meta.statedOnly (pairs by shared dimensions are inferred) */
  saPairs?: { note: string; a: number[]; b: number[]; shared: number[] };
}

export interface OntologyCounts {
  subjectAreas: number;
  functionalAreas: number;
  /** absent when meta.statedOnly */
  concepts?: number;
  conceptsWithDwNsLineage?: number;
  presentationTables: number;
  presentationColumns: number;
  physicalTables: number;
  physicalTablesInLineage: number;
  physicalColumns: number;
  physicalColumnsInLineage: number;
  sqlSources: number;
  sqlColumns: number;
  netsuiteRecords: number;
  explicitNetsuiteRecords: number;
  netsuiteFields: number;
  entities: number;
  docGroups: number;
  explicitSourceEdges: number;
  inferredSourceEdges?: number;
  derivedColumnsFlagged: number;
  derivedFlaggedTables: number;
  securedTables: number;
  usedWithPairs?: number;
  busMatrixColumns: number;
  entityKeysResolved: number;
  entityKeysTotal: number;
}

export interface CoreJson {
  schema: number;
  meta: {
    provenanceLegend: Record<Provenance, string>;
    provenanceCodes: Provenance[];
    sources: Record<string, unknown>;
    ingest: { csvRows: number; nanRowsDropped: number; dwNsRows: number; sqlRows: number; aliasRows: number; docsSkippedNonNs: number };
    derivedDefinition: string;
    roleDefinition: string;
    files: Record<string, string>;
    counts: OntologyCounts;
    /** true when the build emitted only relationships Oracle's files state (scripts/build-ontology.mjs STATED_ONLY) */
    statedOnly?: boolean;
    statedOnlyNote?: string;
  };
  nodes: Partial<Record<NodeType, NodeTable>>;
  edges: EdgeGroupJson[];
  busMatrix: BusMatrix;
}

export interface DetailJson {
  schema: number;
  strings?: string[];
  nodes?: Partial<Record<NodeType, NodeTable>>;
  edges: EdgeGroupJson[];
}

// ------------------------------------------------------------------ typed node views (what accessors return)

/** table.src / column.src bit flags */
export const SRC_LINEAGE = 1;
export const SRC_WORKBOOK = 2;
export const SRC_DOCS = 4;

export interface NodeRef {
  type: NodeType;
  i: number;
}

export interface FunctionalAreaNode { name: string; subjectAreaCount: number }
export interface SubjectAreaNode {
  name: string; label: string; presentationTables: number; presentationColumns: number;
  physicalTables: number; facts: number; dimensions: number; sqlSources: number;
}
export interface ConceptNode {
  name: string; saCount: number; tableCount: number; columnNames: number; physicalTables: number;
  /** most-used physicalTable indexes */
  topPhysical: number[]; hasDwNs: 0 | 1;
}
/** name: the presentation table's own name. concept: only when the inferred concept layer is built. */
export interface PresentationTableNode { sa: number; name: string; concept?: number; columns: number; physicalTables: number }
export interface PresentationColumnNode { pt: number; name: string }
/** baseTable is -1 everywhere when meta.statedOnly (X_SEC -> X pairing by name is inferred). */
export interface PhysicalTableNode {
  name: string; role: PhysicalTableType; isSecured: 0 | 1; baseTable: number; derived: 0 | 1;
  derivedRule: 'pattern' | 'flagged-columns' | 'both' | null; src: number; preview: 0 | 1;
  columns: number; mappedColumns: number; derivedColumns: number;
  saCount: number; presentationTables: number; conceptCount?: number; lineageRows: number;
}
/** derived: 0 none | 1 flagged in nsaw_derived.csv | 2 table matched isNsawGeneratedTable | 3 both */
export interface PhysicalColumnNode { table: number; sql: number; name: string; derived: 0 | 1 | 2 | 3; src: number; saCount: number; conceptCount?: number }
export interface NetsuiteRecordNode {
  name: string; key: string; recordType: 'Entity' | 'TransactionLine' | 'Other Record' | null; explicit: 0 | 1;
  fieldCount: number; explicitFieldCount: number; tableCount: number; columnCount: number;
  saReach: number; saReachExplicit: number; conceptReach?: number;
}
export interface NetsuiteFieldNode { record: number; name: string; explicit: 0 | 1 }
export interface EntityKey { k: string; t: string; c: string; ti: number; ci: number }
export interface EntityNode { name: string; domainCode: string; keys: EntityKey[]; resolvedKeys: number }
export interface DocGroupNode { name: string; tableCount: number }
export interface SqlSourceNode { kind: 'sql' | 'alias'; text: string; label: string; saCount: number; columns: number }

export interface NodeViews {
  functionalArea: FunctionalAreaNode;
  subjectArea: SubjectAreaNode;
  concept: ConceptNode;
  presentationTable: PresentationTableNode;
  presentationColumn: PresentationColumnNode;
  physicalTable: PhysicalTableNode;
  physicalColumn: PhysicalColumnNode;
  netsuiteRecord: NetsuiteRecordNode;
  netsuiteField: NetsuiteFieldNode;
  entity: EntityNode;
  docGroup: DocGroupNode;
  sqlSource: SqlSourceNode;
}

export interface Neighbor {
  ref: NodeRef;
  edge: EdgeType;
  provenance: Provenance;
  weight?: number;
}
