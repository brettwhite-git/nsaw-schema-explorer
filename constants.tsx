
import { NodeType, OntologyData } from './types';

export const INITIAL_DATA: OntologyData = {
  nodes: [
    { 
      id: 'sys-telemetry', 
      label: 'System A Telemetry', 
      type: NodeType.SOURCE,
      description: 'Raw high-frequency telemetry events from edge sensors.',
      columns: [
        { name: 'timestamp', type: 'TIMESTAMP' },
        { name: 'payload', type: 'JSON' },
        { name: 'device_id', type: 'STRING' }
      ]
    },
    { 
      id: 'log-stream-b', 
      label: 'Log Stream B', 
      type: NodeType.SOURCE,
      description: 'Application logs from backend services cluster.'
    },
    { 
      id: 'db-raw', 
      label: 'DB C (Raw)', 
      type: NodeType.SOURCE,
      description: 'Snapshot of legacy customer database.'
    },
    { 
      id: 'etl-process', 
      label: 'ETL Process', 
      type: NodeType.PIPELINE,
      description: 'Standard cleansing and normalization workflow.'
    },
    { 
      id: 'staging-tables', 
      label: 'Staging Tables', 
      type: NodeType.TABLE,
      description: 'Intermediate storage for validated data.'
    },
    { 
      id: 'fact-events', 
      label: 'Fact Table: Events', 
      type: NodeType.FACT,
      description: 'Centralized immutable event history for all system interactions.',
      columns: [
        { name: 'event_id', type: 'UUID' },
        { name: 'user_id', type: 'UUID' },
        { name: 'event_type', type: 'STRING' },
        { name: 'occurred_at', type: 'TIMESTAMP' }
      ]
    },
    { 
      id: 'dim-users', 
      label: 'Dim Table: Users', 
      type: NodeType.DIMENSION,
      description: 'Slowly changing dimension for user profiles.',
      columns: [
        { name: 'user_id', type: 'UUID' },
        { name: 'email', type: 'STRING' },
        { name: 'region', type: 'STRING' }
      ]
    },
    { id: 'staging-1', label: 'Staging Metadata', type: NodeType.TABLE },
    { id: 'staging-2', label: 'Flow Metrics', type: NodeType.TABLE },
    { id: 'dim-geo', label: 'Dim Table: Geo', type: NodeType.DIMENSION }
  ],
  links: [
    { source: 'sys-telemetry', target: 'etl-process' },
    { source: 'log-stream-b', target: 'etl-process' },
    { source: 'etl-process', target: 'staging-tables' },
    { source: 'staging-tables', target: 'fact-events' },
    { source: 'db-raw', target: 'staging-tables' },
    { source: 'fact-events', target: 'staging-1' },
    { source: 'fact-events', target: 'staging-2' },
    { source: 'fact-events', target: 'dim-users' },
    { source: 'fact-events', target: 'dim-geo' }
  ]
};
