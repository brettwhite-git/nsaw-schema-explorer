import { Index } from 'flexsearch';
import {
  DataIndex,
  EnrichedLineageRecord,
  SearchResult,
  SearchResultType,
} from '../types';

// Simple index for text search
let index: Index | null = null;

// Store records for retrieval
let recordsStore: EnrichedLineageRecord[] = [];

// Unique values tracking
const uniqueSubjectAreas = new Set<string>();
const uniquePresentationTables = new Map<string, string>(); // key -> subjectArea
const uniquePhysicalTables = new Set<string>();

/**
 * Initialize the FlexSearch index with lineage data
 */
export function initializeSearchIndex(dataIndex: DataIndex): void {
  const startTime = performance.now();

  // Create simple index
  index = new Index({
    tokenize: 'forward',
    resolution: 9,
    cache: 100,
  });

  recordsStore = dataIndex.records;

  // Index all records - create searchable text for each
  dataIndex.records.forEach((record, idx) => {
    // Create combined searchable text
    const searchText = [
      record.subjectArea,
      record.presentationTable,
      record.presentationColumn,
      record.physicalTable,
      record.physicalColumn,
    ].join(' ');

    index!.add(idx, searchText);

    // Track unique values
    uniqueSubjectAreas.add(record.subjectArea);
    uniquePresentationTables.set(
      `${record.subjectArea}::${record.presentationTable}`,
      record.subjectArea
    );
    uniquePhysicalTables.add(record.physicalTable);
  });

  const elapsed = performance.now() - startTime;
  console.log(`Built search index for ${dataIndex.records.length} records in ${elapsed.toFixed(0)}ms`);
}

/**
 * Search the lineage data
 */
export function searchLineage(
  query: string,
  limit: number = 50,
  dataIndex: DataIndex
): SearchResult[] {
  if (!index || !query.trim()) {
    return [];
  }

  const results: SearchResult[] = [];
  const seenKeys = new Set<string>();

  // Search the index
  const searchResults = index.search(query, { limit: limit * 3 });

  // Process search results
  for (const idx of searchResults) {
    if (typeof idx !== 'number') continue;

    const record = recordsStore[idx];
    if (!record) continue;

    // Add subject area result
    const saKey = `sa::${record.subjectArea}`;
    if (!seenKeys.has(saKey) && record.subjectArea.toLowerCase().includes(query.toLowerCase())) {
      seenKeys.add(saKey);
      results.push({
        id: saKey,
        type: 'subjectArea',
        value: record.subjectArea,
        context: `${dataIndex.bySubjectArea.get(record.subjectArea)?.length || 0} fields`,
      });
    }

    // Add presentation table result
    const ptKey = `pt::${record.subjectArea}::${record.presentationTable}`;
    if (!seenKeys.has(ptKey) && record.presentationTable.toLowerCase().includes(query.toLowerCase())) {
      seenKeys.add(ptKey);
      results.push({
        id: ptKey,
        type: 'presentationTable',
        value: record.presentationTable,
        context: record.subjectArea,
      });
    }

    // Add presentation column result
    const pcKey = `pc::${record.subjectArea}::${record.presentationTable}::${record.presentationColumn}`;
    if (!seenKeys.has(pcKey) && record.presentationColumn.toLowerCase().includes(query.toLowerCase())) {
      seenKeys.add(pcKey);
      results.push({
        id: pcKey,
        type: 'presentationColumn',
        value: record.presentationColumn,
        context: `${record.presentationTable} › ${record.subjectArea}`,
        record,
      });
    }

    // Add physical table result
    const dwtKey = `dwt::${record.physicalTable}`;
    if (!seenKeys.has(dwtKey) && record.physicalTable.toLowerCase().includes(query.toLowerCase())) {
      seenKeys.add(dwtKey);
      results.push({
        id: dwtKey,
        type: 'physicalTable',
        value: record.physicalTable,
        context: `${dataIndex.byPhysicalTable.get(record.physicalTable)?.length || 0} mappings`,
      });
    }

    // Add physical column result
    const dwcKey = `dwc::${record.physicalTable}::${record.physicalColumn}`;
    if (!seenKeys.has(dwcKey) && record.physicalColumn.toLowerCase().includes(query.toLowerCase())) {
      seenKeys.add(dwcKey);
      results.push({
        id: dwcKey,
        type: 'physicalColumn',
        value: record.physicalColumn,
        context: record.physicalTable,
        record,
      });
    }

    // Stop if we have enough results
    if (results.length >= limit) break;
  }

  // Sort results by type priority
  const typePriority: Record<SearchResultType, number> = {
    presentationColumn: 1,
    presentationTable: 2,
    physicalColumn: 3,
    physicalTable: 4,
    subjectArea: 5,
  };

  return results
    .sort((a, b) => typePriority[a.type] - typePriority[b.type])
    .slice(0, limit);
}

/**
 * Group search results by type
 */
export function groupSearchResults(
  results: SearchResult[]
): Map<SearchResultType, SearchResult[]> {
  const groups = new Map<SearchResultType, SearchResult[]>();

  for (const result of results) {
    if (!groups.has(result.type)) {
      groups.set(result.type, []);
    }
    groups.get(result.type)!.push(result);
  }

  return groups;
}

/**
 * Get display label for search result type
 */
export function getResultTypeLabel(type: SearchResultType): string {
  const labels: Record<SearchResultType, string> = {
    subjectArea: 'Subject Areas',
    presentationTable: 'Presentation Tables',
    presentationColumn: 'Columns',
    physicalTable: 'DW Tables',
    physicalColumn: 'DW Columns',
  };
  return labels[type];
}
