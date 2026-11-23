// Loader + accessor API over the ontology JSON. Not wired into the React app yet.
//
//   const o = await loadOntology({ baseUrl: '/ontology/' });      // core.json
//   await o.ensure('columns');                                     // lazy: column-level nodes + edges
//   const i = o.find('physicalTable', 'DW_NS_CUSTOMER_D')!;
//   o.neighbors({ type: 'physicalTable', i }, 'contains')          // its columns, with provenance
//
// Tests and scripts can skip fetch: new Ontology(coreJson).attach('columns', columnsJson).

import type {
  BusMatrix, CoreJson, DetailJson, EdgeGroupJson, EdgeType, Neighbor, NodeRef, NodeTable, NodeType, NodeViews,
  OntologyFile, Provenance,
} from './types';

export type FetchJson = (url: string) => Promise<unknown>;

interface Adjacency {
  out: Map<number, number[]>;
  in: Map<number, number[]>;
}

const defaultFetch: FetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ontology: ${url} -> HTTP ${res.status}`);
  return res.json();
};

export class Ontology {
  readonly core: CoreJson;
  private tables = new Map<NodeType, { table: NodeTable; strings?: string[] }>();
  private groups: EdgeGroupJson[] = [];
  private adj = new Map<EdgeGroupJson, Adjacency>();
  private keyIndex = new Map<NodeType, Map<string, number>>();
  private files = new Set<OntologyFile>(['core']);
  private loading = new Map<OntologyFile, Promise<void>>();
  private opts: { baseUrl: string; fetchJson: FetchJson };

  constructor(core: CoreJson, opts: { baseUrl?: string; fetchJson?: FetchJson } = {}) {
    this.core = core;
    this.opts = { baseUrl: opts.baseUrl ?? '/ontology/', fetchJson: opts.fetchJson ?? defaultFetch };
    this.addNodes(core.nodes);
    this.groups.push(...core.edges);
  }

  private addNodes(nodes: DetailJson['nodes'], strings?: string[]) {
    for (const [t, table] of Object.entries(nodes ?? {})) this.tables.set(t as NodeType, { table: table!, strings });
  }

  /** Attach a lazily loaded file that you already have in memory. */
  attach(file: Exclude<OntologyFile, 'core'>, json: DetailJson): this {
    if (this.files.has(file)) return this;
    this.addNodes(json.nodes, json.strings);
    this.groups.push(...json.edges);
    this.keyIndex.clear();
    this.files.add(file);
    return this;
  }

  has(file: OntologyFile): boolean { return this.files.has(file); }

  /** Fetch + attach a detail file once. Concurrent callers share one request. */
  ensure(file: Exclude<OntologyFile, 'core'>): Promise<void> {
    if (this.files.has(file)) return Promise.resolve();
    let p = this.loading.get(file);
    if (!p) {
      const name = this.core.meta.files[file];
      p = this.opts.fetchJson(this.opts.baseUrl + name).then((j) => { this.attach(file, j as DetailJson); });
      this.loading.set(file, p);
    }
    return p;
  }

  // ---------------------------------------------------------------- nodes
  count(type: NodeType): number { return this.tables.get(type)?.table.n ?? 0; }
  available(type: NodeType): boolean { return this.tables.has(type); }

  get<T extends NodeType>(type: T, i: number): NodeViews[T] {
    const e = this.tables.get(type);
    if (!e) throw new Error(`ontology: ${type} nodes not loaded (call ensure() for the detail file)`);
    if (i < 0 || i >= e.table.n) throw new RangeError(`ontology: ${type}[${i}] out of range`);
    const str = e.table.strCols ?? [];
    const o: Record<string, unknown> = {};
    for (const [k, col] of Object.entries(e.table.cols)) o[k] = str.includes(k) ? e.strings![col[i]] : col[i];
    return o as unknown as NodeViews[T];
  }

  /** Natural key used by find(): name for most types, TABLE.COLUMN for physicalColumn, lower-case record / record.field for NetSuite. */
  key(type: NodeType, i: number): string {
    const n = this.get(type, i) as unknown as Record<string, any>;
    switch (type) {
      case 'physicalColumn':
        return (n.table >= 0 ? this.get('physicalTable', n.table).name : `sql${n.sql}`) + '.' + n.name;
      case 'presentationTable':
        return `${this.get('subjectArea', n.sa).name}::${n.name ?? this.get('concept', n.concept).name}`;
      case 'presentationColumn':
        return `${this.key('presentationTable', n.pt)}::${n.name}`;
      case 'netsuiteRecord':
        return n.key;
      case 'netsuiteField':
        return `${this.get('netsuiteRecord', n.record).key}.${String(n.name).toLowerCase()}`;
      case 'sqlSource':
        return n.text;
      default:
        return n.name;
    }
  }

  /** Case-insensitive lookup by natural key. */
  find(type: NodeType, key: string): number | undefined {
    let idx = this.keyIndex.get(type);
    if (!idx) {
      idx = new Map();
      const n = this.count(type);
      for (let i = 0; i < n; i++) idx.set(this.key(type, i).toLowerCase(), i);
      this.keyIndex.set(type, idx);
    }
    return idx.get(key.toLowerCase());
  }

  ref(type: NodeType, key: string): NodeRef | undefined {
    const i = this.find(type, key);
    return i === undefined ? undefined : { type, i };
  }

  // ---------------------------------------------------------------- edges
  edgeGroups(type?: EdgeType): EdgeGroupJson[] { return type ? this.groups.filter((g) => g.type === type) : this.groups; }

  private adjacency(g: EdgeGroupJson): Adjacency {
    let a = this.adj.get(g);
    if (!a) {
      a = { out: new Map(), in: new Map() };
      for (let k = 0; k < g.n; k++) {
        const f = g.pairs[2 * k], t = g.pairs[2 * k + 1];
        (a.out.get(f) ?? a.out.set(f, []).get(f)!).push(k);
        (a.in.get(t) ?? a.in.set(t, []).get(t)!).push(k);
      }
      this.adj.set(g, a);
    }
    return a;
  }

  private provOf(g: EdgeGroupJson, k: number): Provenance {
    return g.provenance === 'mixed' ? this.core.meta.provenanceCodes[g.prov![k]] : g.provenance;
  }

  /**
   * Neighbours of a node along one edge type.
   * dir 'out' follows from -> to, 'in' follows to -> from. Every result carries the edge provenance.
   * Groups whose file is not loaded yet are simply absent: call ensure() first.
   */
  neighbors(ref: NodeRef, edge: EdgeType, dir: 'out' | 'in' = 'out', opts: { provenance?: Provenance } = {}): Neighbor[] {
    const res: Neighbor[] = [];
    for (const g of this.groups) {
      if (g.type !== edge) continue;
      const here = dir === 'out' ? g.from : g.to;
      if (here !== ref.type) continue;
      const other = dir === 'out' ? g.to : g.from;
      const list = this.adjacency(g)[dir].get(ref.i);
      if (!list) continue;
      for (const k of list) {
        const provenance = this.provOf(g, k);
        if (opts.provenance && provenance !== opts.provenance) continue;
        const n: Neighbor = { ref: { type: other, i: g.pairs[2 * k + (dir === 'out' ? 1 : 0)] }, edge, provenance };
        if (g.weight) n.weight = g.weight[k];
        res.push(n);
      }
    }
    return res;
  }

  // ---------------------------------------------------------------- convenience
  get busMatrix(): BusMatrix { return this.core.busMatrix; }

  /** Subject-area indexes that reach a physical column through presentation columns (needs 'columns'). */
  subjectAreasOfColumn(physicalColumn: number): number[] {
    const sas = new Set<number>();
    for (const pc of this.neighbors({ type: 'physicalColumn', i: physicalColumn }, 'mapsTo', 'in')) {
      const pt = this.get('presentationColumn', pc.ref.i).pt;
      sas.add(this.get('presentationTable', pt).sa);
    }
    return [...sas].sort((a, b) => a - b);
  }
}

export async function loadOntology(opts: { baseUrl?: string; fetchJson?: FetchJson } = {}): Promise<Ontology> {
  const baseUrl = opts.baseUrl ?? '/ontology/';
  const fetchJson = opts.fetchJson ?? defaultFetch;
  const core = (await fetchJson(baseUrl + 'core.json')) as CoreJson;
  return new Ontology(core, { baseUrl, fetchJson });
}
