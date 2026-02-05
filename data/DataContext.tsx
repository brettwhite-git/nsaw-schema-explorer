import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  DataIndex,
  SelectionState,
  SearchResult,
  EnrichedLineageRecord,
  ViewMode,
  FunctionalAreaGroup,
} from '../types';
import { loadLineageData, getRecordsForPresentationTable } from './dataLoader';
import { initializeSearchIndex, searchLineage, groupSearchResults } from './searchIndex';
import { groupByFunctionalArea } from '../config/functionalAreas';

interface DataContextValue {
  // Data state
  dataIndex: DataIndex | null;
  isLoading: boolean;
  error: string | null;

  // Selection state
  selection: SelectionState;
  setSelection: (selection: Partial<SelectionState>) => void;
  clearSelection: () => void;

  // Selected records for graph
  selectedRecords: EnrichedLineageRecord[];

  // Search
  search: (query: string) => SearchResult[];
  searchResults: SearchResult[];
  setSearchQuery: (query: string) => void;
  searchQuery: string;

  // Navigation helpers
  selectSubjectArea: (subjectArea: string) => void;
  selectPresentationTable: (subjectArea: string, table: string) => void;
  selectFromSearchResult: (result: SearchResult) => void;

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Grouped subject areas by functional area
  functionalAreaGroups: FunctionalAreaGroup[];
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps): React.ReactElement {
  // Data state
  const [dataIndex, setDataIndex] = useState<DataIndex | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selection, setSelectionState] = useState<SelectionState>({
    subjectArea: null,
    presentationTable: null,
    presentationColumn: null,
    physicalTable: null,
    physicalColumn: null,
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('detailedFlow');

  // Compute functional area groups when dataIndex changes
  const functionalAreaGroups = useMemo(() => {
    if (!dataIndex) return [];
    return groupByFunctionalArea(dataIndex.subjectAreas);
  }, [dataIndex]);

  // Load data on mount
  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const index = await loadLineageData();
        setDataIndex(index);

        // Initialize search index
        initializeSearchIndex(index);

        console.log(`Data loaded: ${index.subjectAreas.length} subject areas, ${index.presentationTables.length} tables`);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  // Update selection
  const setSelection = useCallback((updates: Partial<SelectionState>) => {
    setSelectionState(prev => ({ ...prev, ...updates }));
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectionState({
      subjectArea: null,
      presentationTable: null,
      presentationColumn: null,
      physicalTable: null,
      physicalColumn: null,
    });
  }, []);

  // Get selected records for graph
  const selectedRecords = React.useMemo(() => {
    if (!dataIndex || !selection.subjectArea || !selection.presentationTable) {
      return [];
    }
    return getRecordsForPresentationTable(
      dataIndex,
      selection.subjectArea,
      selection.presentationTable
    );
  }, [dataIndex, selection.subjectArea, selection.presentationTable]);

  // Search function
  const search = useCallback((query: string): SearchResult[] => {
    if (!dataIndex || !query.trim()) {
      return [];
    }
    return searchLineage(query, 50, dataIndex);
  }, [dataIndex]);

  // Update search results when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results = search(searchQuery);
    setSearchResults(results);
  }, [searchQuery, search]);

  // Navigation helpers
  const selectSubjectArea = useCallback((subjectArea: string) => {
    setSelectionState({
      subjectArea,
      presentationTable: null,
      presentationColumn: null,
      physicalTable: null,
      physicalColumn: null,
    });
  }, []);

  const selectPresentationTable = useCallback((subjectArea: string, table: string) => {
    setSelectionState(prev => ({
      ...prev,
      subjectArea,
      presentationTable: table,
      presentationColumn: null,
      physicalTable: null,
      physicalColumn: null,
    }));
  }, []);

  const selectFromSearchResult = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'subjectArea':
        selectSubjectArea(result.value);
        break;

      case 'presentationTable':
        // Parse context to get subject area
        if (result.context) {
          selectPresentationTable(result.context, result.value);
        }
        break;

      case 'presentationColumn':
        if (result.record) {
          setSelectionState({
            subjectArea: result.record.subjectArea,
            presentationTable: result.record.presentationTable,
            presentationColumn: result.record.presentationColumn,
            physicalTable: result.record.physicalTable,
            physicalColumn: result.record.physicalColumn,
          });
        }
        break;

      case 'physicalTable':
        if (dataIndex) {
          const ptRecords = dataIndex.byPhysicalTable.get(result.value);
          if (ptRecords && ptRecords.length > 0) {
            const firstRecord = ptRecords[0];
            setSelectionState({
              subjectArea: firstRecord.subjectArea,
              presentationTable: firstRecord.presentationTable,
              presentationColumn: null,
              physicalTable: result.value,
              physicalColumn: null,
            });
          }
        }
        break;

      case 'physicalColumn':
        if (result.record) {
          setSelectionState({
            subjectArea: result.record.subjectArea,
            presentationTable: result.record.presentationTable,
            presentationColumn: result.record.presentationColumn,
            physicalTable: result.record.physicalTable,
            physicalColumn: result.record.physicalColumn,
          });
        }
        break;
    }

    // Clear search after selection
    setSearchQuery('');
    setSearchResults([]);
  }, [selectSubjectArea, selectPresentationTable]);

  const value: DataContextValue = {
    dataIndex,
    isLoading,
    error,
    selection,
    setSelection,
    clearSelection,
    selectedRecords,
    search,
    searchResults,
    setSearchQuery,
    searchQuery,
    selectSubjectArea,
    selectPresentationTable,
    selectFromSearchResult,
    viewMode,
    setViewMode,
    functionalAreaGroups,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
