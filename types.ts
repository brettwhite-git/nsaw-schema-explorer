// NSAW Schema Explorer - Type Definitions

/**
 * Core lineage record - maps 1:1 to a CSV row
 * Represents a single field mapping from presentation layer to physical warehouse
 */
export interface LineageRecord {
  subjectArea: string;
  presentationTable: string;
  presentationColumn: string;
  physicalTable: string;
  physicalColumn: string;
}

/**
 * Inferred NetSuite source information
 * Derived algorithmically from DW table/column names
 */
export interface InferredSource {
  recordType: string | null;  // e.g., "customer", "account"
  fieldName: string | null;   // e.g., "accountNumber"
  isNsawGenerated: boolean;   // true for DAY_D, FISCALCALPERIOD_DH, etc.
}

/**
 * Extended lineage record with inferred source
 */
export interface EnrichedLineageRecord extends LineageRecord {
  inferredSource: InferredSource;
}

/**
 * Subject Area with its presentation tables
 */
export interface SubjectAreaInfo {
  name: string;
  presentationTables: string[];
  recordCount: number;
}

/**
 * Presentation Table with its columns and physical mappings
 */
export interface PresentationTableInfo {
  name: string;
  subjectArea: string;
  columns: string[];
  physicalTables: string[];
  recordCount: number;
}

/**
 * Physical (DW) Table with its columns
 */
export interface PhysicalTableInfo {
  name: string;
  columns: string[];
  presentationSources: string[];  // Which presentation tables map to this
  inferredRecord: string | null;  // Inferred NetSuite record type
  isNsawGenerated: boolean;
}

/**
 * Indexed data structure for fast lookups
 * Built once on app load from CSV data
 */
export interface DataIndex {
  // Raw records
  records: EnrichedLineageRecord[];

  // Aggregated lists
  subjectAreas: SubjectAreaInfo[];
  presentationTables: PresentationTableInfo[];
  physicalTables: PhysicalTableInfo[];

  // Fast lookup maps
  bySubjectArea: Map<string, EnrichedLineageRecord[]>;
  byPresentationTable: Map<string, EnrichedLineageRecord[]>;
  byPhysicalTable: Map<string, EnrichedLineageRecord[]>;
  byPresentationColumn: Map<string, EnrichedLineageRecord[]>;

  // Metadata
  totalRecords: number;
  loadTimeMs: number;
}

/**
 * Search result types
 */
export type SearchResultType =
  | 'subjectArea'
  | 'presentationTable'
  | 'presentationColumn'
  | 'physicalTable'
  | 'physicalColumn';

/**
 * Search result item
 */
export interface SearchResult {
  id: string;
  type: SearchResultType;
  value: string;
  context: string;  // Parent path for display (e.g., "Customer > Customer Account")
  record?: EnrichedLineageRecord;
}

/**
 * App selection state
 */
export interface SelectionState {
  subjectArea: string | null;
  presentationTable: string | null;
  presentationColumn: string | null;
  physicalTable: string | null;
  physicalColumn: string | null;
}

/**
 * Graph node types for React Flow
 */
export type GraphNodeType =
  | 'presentationTable'
  | 'presentationColumn'
  | 'physicalTable'
  | 'physicalColumn';

/**
 * Graph node data
 */
export interface GraphNodeData {
  label: string;
  type: GraphNodeType;
  record?: EnrichedLineageRecord;
  inferredSource?: InferredSource;
  isSelected?: boolean;
}

// ======================
// Utility type guards
// ======================

export function isNsawGeneratedTable(tableName: string): boolean {
  const nsawOnlyPatterns = [
    'DAY_D',
    'FISCALCALPERIOD',
    '_CF_DH',
    'DUMMY',
    'PREDICTION_P',
  ];
  return nsawOnlyPatterns.some(pattern => tableName.includes(pattern));
}

/**
 * Infer NetSuite record type from DW table name
 * DW_NS_CUSTOMER_D → customer
 */
export function inferRecordType(dwTableName: string): string | null {
  if (isNsawGeneratedTable(dwTableName)) {
    return null;
  }

  // Remove DW_NS_ prefix and _D/_F/_DH suffix
  const match = dwTableName.match(/^DW_NS_(.+?)(_D|_F|_DH|_EF|_G|_P|_TL|_CF_DH)?(_SEC)?$/);
  if (!match) return null;

  let recordName = match[1];

  // Convert UPPER_SNAKE to camelCase
  recordName = recordName
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

  return recordName;
}

/**
 * Infer NetSuite field name from DW column name
 * ACCOUNTNUMBER → accountNumber
 */
export function inferFieldName(dwColumnName: string): string {
  // Simple conversion: ACCOUNTNUMBER → accountNumber
  return dwColumnName.charAt(0).toLowerCase() +
         dwColumnName.slice(1).toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Create inferred source from DW table/column
 */
export function createInferredSource(physicalTable: string, physicalColumn: string): InferredSource {
  const isGenerated = isNsawGeneratedTable(physicalTable);
  return {
    recordType: isGenerated ? null : inferRecordType(physicalTable),
    fieldName: isGenerated ? null : inferFieldName(physicalColumn),
    isNsawGenerated: isGenerated,
  };
}
