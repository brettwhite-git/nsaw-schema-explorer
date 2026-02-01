import Papa from 'papaparse';
import {
  LineageRecord,
  EnrichedLineageRecord,
  DataIndex,
  SubjectAreaInfo,
  PresentationTableInfo,
  PhysicalTableInfo,
  createInferredSource,
  isNsawGeneratedTable,
  inferRecordType,
} from '../types';

const CSV_PATH = '/25R4_NS_Semantic_Model_Lineage - 25R4_NS_Semantic_Model_Lineage.csv';

interface CsvRow {
  'Subject Area': string;
  'Presentation Table': string;
  'Presentation Column': string;
  'Physical Table': string;
  'Physical Column': string;
}

/**
 * Load and parse the NSAW lineage CSV file
 */
export async function loadLineageData(): Promise<DataIndex> {
  const startTime = performance.now();

  // Fetch the CSV file
  const response = await fetch(CSV_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.statusText}`);
  }
  const csvText = await response.text();

  // Parse CSV
  const parseResult = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parseResult.errors.length > 0) {
    console.warn('CSV parsing warnings:', parseResult.errors);
  }

  // Transform to enriched records
  const records: EnrichedLineageRecord[] = parseResult.data
    .filter(row => row['Physical Table']?.startsWith('DW_NS_')) // Filter out SQL queries
    .map(row => {
      const physicalTable = row['Physical Table']?.trim() || '';
      const physicalColumn = row['Physical Column']?.trim() || '';

      return {
        subjectArea: row['Subject Area']?.trim() || '',
        presentationTable: row['Presentation Table']?.trim() || '',
        presentationColumn: row['Presentation Column']?.trim() || '',
        physicalTable,
        physicalColumn,
        inferredSource: createInferredSource(physicalTable, physicalColumn),
      };
    })
    .filter(r => r.subjectArea && r.presentationTable && r.presentationColumn);

  // Build the index
  const index = buildDataIndex(records);
  index.loadTimeMs = performance.now() - startTime;

  console.log(`Loaded ${index.totalRecords} lineage records in ${index.loadTimeMs.toFixed(0)}ms`);

  return index;
}

/**
 * Build indexed data structures for fast lookups
 */
function buildDataIndex(records: EnrichedLineageRecord[]): DataIndex {
  // Initialize maps
  const bySubjectArea = new Map<string, EnrichedLineageRecord[]>();
  const byPresentationTable = new Map<string, EnrichedLineageRecord[]>();
  const byPhysicalTable = new Map<string, EnrichedLineageRecord[]>();
  const byPresentationColumn = new Map<string, EnrichedLineageRecord[]>();

  // Subject area aggregation
  const subjectAreaMap = new Map<string, Set<string>>();
  // Presentation table aggregation
  const presTableMap = new Map<string, { sa: string; cols: Set<string>; physTables: Set<string> }>();
  // Physical table aggregation
  const physTableMap = new Map<string, { cols: Set<string>; presSources: Set<string> }>();

  // Process each record
  for (const record of records) {
    // Index by subject area
    if (!bySubjectArea.has(record.subjectArea)) {
      bySubjectArea.set(record.subjectArea, []);
    }
    bySubjectArea.get(record.subjectArea)!.push(record);

    // Index by presentation table
    const presTableKey = `${record.subjectArea}::${record.presentationTable}`;
    if (!byPresentationTable.has(presTableKey)) {
      byPresentationTable.set(presTableKey, []);
    }
    byPresentationTable.get(presTableKey)!.push(record);

    // Index by physical table
    if (!byPhysicalTable.has(record.physicalTable)) {
      byPhysicalTable.set(record.physicalTable, []);
    }
    byPhysicalTable.get(record.physicalTable)!.push(record);

    // Index by presentation column
    const colKey = `${record.subjectArea}::${record.presentationTable}::${record.presentationColumn}`;
    if (!byPresentationColumn.has(colKey)) {
      byPresentationColumn.set(colKey, []);
    }
    byPresentationColumn.get(colKey)!.push(record);

    // Aggregate subject areas
    if (!subjectAreaMap.has(record.subjectArea)) {
      subjectAreaMap.set(record.subjectArea, new Set());
    }
    subjectAreaMap.get(record.subjectArea)!.add(record.presentationTable);

    // Aggregate presentation tables
    if (!presTableMap.has(presTableKey)) {
      presTableMap.set(presTableKey, {
        sa: record.subjectArea,
        cols: new Set(),
        physTables: new Set(),
      });
    }
    const presInfo = presTableMap.get(presTableKey)!;
    presInfo.cols.add(record.presentationColumn);
    presInfo.physTables.add(record.physicalTable);

    // Aggregate physical tables
    if (!physTableMap.has(record.physicalTable)) {
      physTableMap.set(record.physicalTable, {
        cols: new Set(),
        presSources: new Set(),
      });
    }
    const physInfo = physTableMap.get(record.physicalTable)!;
    physInfo.cols.add(record.physicalColumn);
    physInfo.presSources.add(presTableKey);
  }

  // Build subject area list
  const subjectAreas: SubjectAreaInfo[] = Array.from(subjectAreaMap.entries())
    .map(([name, tables]) => ({
      name,
      presentationTables: Array.from(tables).sort(),
      recordCount: bySubjectArea.get(name)?.length || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build presentation table list
  const presentationTables: PresentationTableInfo[] = Array.from(presTableMap.entries())
    .map(([key, info]) => {
      const [, tableName] = key.split('::');
      return {
        name: tableName,
        subjectArea: info.sa,
        columns: Array.from(info.cols).sort(),
        physicalTables: Array.from(info.physTables).sort(),
        recordCount: byPresentationTable.get(key)?.length || 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build physical table list
  const physicalTables: PhysicalTableInfo[] = Array.from(physTableMap.entries())
    .map(([name, info]) => ({
      name,
      columns: Array.from(info.cols).sort(),
      presentationSources: Array.from(info.presSources).sort(),
      inferredRecord: inferRecordType(name),
      isNsawGenerated: isNsawGeneratedTable(name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    records,
    subjectAreas,
    presentationTables,
    physicalTables,
    bySubjectArea,
    byPresentationTable,
    byPhysicalTable,
    byPresentationColumn,
    totalRecords: records.length,
    loadTimeMs: 0,
  };
}

/**
 * Get records for a specific subject area
 */
export function getRecordsForSubjectArea(
  index: DataIndex,
  subjectArea: string
): EnrichedLineageRecord[] {
  return index.bySubjectArea.get(subjectArea) || [];
}

/**
 * Get records for a specific presentation table
 */
export function getRecordsForPresentationTable(
  index: DataIndex,
  subjectArea: string,
  presentationTable: string
): EnrichedLineageRecord[] {
  const key = `${subjectArea}::${presentationTable}`;
  return index.byPresentationTable.get(key) || [];
}

/**
 * Get records for a specific physical table
 */
export function getRecordsForPhysicalTable(
  index: DataIndex,
  physicalTable: string
): EnrichedLineageRecord[] {
  return index.byPhysicalTable.get(physicalTable) || [];
}

/**
 * Get subject area info by name
 */
export function getSubjectAreaInfo(
  index: DataIndex,
  subjectArea: string
): SubjectAreaInfo | undefined {
  return index.subjectAreas.find(sa => sa.name === subjectArea);
}

/**
 * Get presentation table info
 */
export function getPresentationTableInfo(
  index: DataIndex,
  subjectArea: string,
  tableName: string
): PresentationTableInfo | undefined {
  return index.presentationTables.find(
    t => t.subjectArea === subjectArea && t.name === tableName
  );
}
