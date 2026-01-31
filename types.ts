
export enum NodeType {
  SOURCE = 'SOURCE',
  PIPELINE = 'PIPELINE',
  TABLE = 'TABLE',
  FACT = 'FACT',
  DIMENSION = 'DIMENSION'
}

export interface SchemaNode {
  id: string;
  label: string;
  type: NodeType;
  description?: string;
  columns?: Array<{ name: string; type: string }>;
  sources?: string[];
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface OntologyData {
  nodes: SchemaNode[];
  links: GraphLink[];
}
