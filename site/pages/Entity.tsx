// /atlas/:type/:key: one node of the ontology, its key facts, and its neighbours by edge type.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { FigureFrame } from '../../figures/FigureFrame';
import '../../figures/index';
import type { Ontology } from '../../ontology/load';
import type { EdgeType, NodeRef, NodeType, Neighbor } from '../../ontology/types';
import { Link } from '../router';
import { atlasPath } from '../routes';
import { LayerTag, ProvenanceMark } from '../ui';
import { useOntology } from '../useOntology';
import type { Layer } from '../../ink/tags';
import type { Provenance } from '../../content/types';

const NODE_TYPES: NodeType[] = ['functionalArea', 'subjectArea', 'concept', 'presentationTable', 'presentationColumn', 'physicalTable', 'physicalColumn', 'netsuiteRecord', 'netsuiteField', 'entity', 'docGroup', 'sqlSource'];
const COLUMN_TYPES: NodeType[] = ['presentationColumn', 'physicalColumn', 'netsuiteField'];
const NEEDS_COLUMN_LINKS: NodeType[] = ['physicalTable', 'presentationTable', 'netsuiteRecord', 'sqlSource', 'entity'];

const TYPE_LABEL: Record<NodeType, string> = {
  functionalArea: 'FUNCTIONAL AREA', subjectArea: 'SUBJECT AREA', concept: 'CONCEPT', presentationTable: 'PRESENTATION TABLE',
  presentationColumn: 'PRESENTATION COLUMN', physicalTable: 'WAREHOUSE TABLE', physicalColumn: 'WAREHOUSE COLUMN', netsuiteRecord: 'NETSUITE RECORD',
  netsuiteField: 'NETSUITE FIELD', entity: 'ENTITY', docGroup: 'DOC GROUP', sqlSource: 'SQL SOURCE',
};

/** Which of the four layer tags a node type is drawn as (by form, never by colour). */
function layerOf(o: Ontology, ref: NodeRef): Layer {
  switch (ref.type) {
    case 'netsuiteRecord': case 'netsuiteField': case 'sqlSource': return 'source';
    case 'physicalTable': return o.get('physicalTable', ref.i).derived ? 'derived' : 'warehouse';
    case 'physicalColumn': return o.get('physicalColumn', ref.i).derived ? 'derived' : 'warehouse';
    default: return 'semantic';
  }
}

const NEIGHBOUR_WORD: Record<EdgeType, [string, string]> = {
  contains: ['contains', 'part of'],
  instanceOf: ['is an instance of', 'instances'],
  mapsTo: ['maps to', 'mapped from'],
  sourcedFrom: ['sourced from', 'is the source of'],
  securedVariantOf: ['is the secured variant of', 'secured variants'],
  keyedBy: ['keyed by', 'keys'],
  inDocGroup: ['in doc group', 'tables in this group'],
  inFunctionalArea: ['in functional area', 'subject areas'],
  usedWith: ['used with', 'used with'],
  loadedFrom: ['loaded from', 'loads into'],
  entityOf: ['entity of', 'entities'],
  readsFrom: ['reads from', 'read by'],
};

/** curated is a rule written in this repo, not in the data: drawn as a thread, named as curated. */
const lineKind = (p: Neighbor['provenance']): Provenance => (p === 'explicit' ? 'explicit' : 'inferred');

function nameOf(o: Ontology, ref: NodeRef): string {
  switch (ref.type) {
    case 'presentationTable': {
      const n = o.get('presentationTable', ref.i);
      return `${n.name}  (${o.get('subjectArea', n.sa).label})`;
    }
    case 'presentationColumn': {
      const n = o.get('presentationColumn', ref.i);
      const pt = o.get('presentationTable', n.pt);
      return `${n.name}  (${pt.name}, ${o.get('subjectArea', pt.sa).label})`;
    }
    case 'netsuiteField': {
      const n = o.get('netsuiteField', ref.i);
      return `${o.get('netsuiteRecord', n.record).name}.${n.name}`;
    }
    case 'sqlSource': return o.get('sqlSource', ref.i).label;
    case 'physicalColumn': return o.key('physicalColumn', ref.i);
    default: return o.key(ref.type, ref.i);
  }
}

/** The text on the tag: the node's own short name (long names say so and are written in full beneath). */
function tagLabel(o: Ontology, ref: NodeRef): string {
  let s: string;
  switch (ref.type) {
    case 'presentationTable': s = o.get('presentationTable', ref.i).name; break;
    case 'presentationColumn': s = o.get('presentationColumn', ref.i).name; break;
    case 'physicalColumn': s = o.get('physicalColumn', ref.i).name; break;
    case 'netsuiteField': s = o.get('netsuiteField', ref.i).name; break;
    case 'netsuiteRecord': s = o.get('netsuiteRecord', ref.i).name; break;
    case 'sqlSource': s = o.get('sqlSource', ref.i).label; break;
    default: s = o.key(ref.type, ref.i);
  }
  return s.length > 30 ? `${s.slice(0, 29)}…` : s;
}

function roleLine(o: Ontology, ref: NodeRef): string {
  switch (ref.type) {
    case 'physicalTable': {
      const t = o.get('physicalTable', ref.i);
      return `${t.role} table${t.isSecured ? ', secured variant' : ''}${t.derived ? ', NSAW-derived' : ''}`;
    }
    case 'physicalColumn': { const c = o.get('physicalColumn', ref.i); return c.derived ? 'column flagged as NSAW-derived' : 'column'; }
    case 'netsuiteRecord': { const r = o.get('netsuiteRecord', ref.i); return `${r.recordType ?? 'record'}${r.explicit ? ', explicit in the lineage file' : ', inferred'}`; }
    case 'subjectArea': return 'subject area of the semantic model';
    case 'concept': return 'a presentation table shared by name across subject areas';
    default: return TYPE_LABEL[ref.type].toLowerCase();
  }
}

type Fact = [string, string | number];
const n = (v: number): string => v.toLocaleString('en-US');

/** Facts whose value the build did not emit (e.g. concept counts in a stated-only build) are left out. */
function factsOf(o: Ontology, ref: NodeRef): Fact[] {
  return factsOfAll(o, ref).filter((f) => f[1] !== undefined);
}

function factsOfAll(o: Ontology, ref: NodeRef): Fact[] {
  switch (ref.type) {
    case 'subjectArea': {
      const s = o.get('subjectArea', ref.i);
      return [['presentation tables', n(s.presentationTables)], ['presentation columns', n(s.presentationColumns)], ['warehouse tables', n(s.physicalTables)], ['of which facts', s.facts], ['of which dimensions', s.dimensions], ['SQL sources', s.sqlSources]];
    }
    case 'physicalTable': {
      const t = o.get('physicalTable', ref.i);
      return [['used in', `${t.saCount} subject area${t.saCount === 1 ? '' : 's'}`], ['presentation tables', n(t.presentationTables)], ['concepts', t.conceptCount], ['columns', `${t.columns} (${t.mappedColumns} mapped)`], ['lineage rows', n(t.lineageRows)]];
    }
    case 'physicalColumn': {
      const c = o.get('physicalColumn', ref.i);
      return [['used in', `${c.saCount} subject area${c.saCount === 1 ? '' : 's'}`], ['concepts', c.conceptCount]];
    }
    case 'netsuiteRecord': {
      const r = o.get('netsuiteRecord', ref.i);
      return [['fields', n(r.fieldCount)], ['warehouse tables', r.tableCount], ['warehouse columns', r.columnCount], ['reaches', `${r.saReach} subject areas`], ['concepts reached', r.conceptReach]];
    }
    case 'concept': {
      const c = o.get('concept', ref.i);
      return [['subject areas', c.saCount], ['presentation tables', c.tableCount], ['column names', c.columnNames], ['warehouse tables', c.physicalTables]];
    }
    case 'presentationTable': {
      const t = o.get('presentationTable', ref.i);
      return [['columns', t.columns], ['warehouse tables', t.physicalTables]];
    }
    case 'functionalArea': return [['subject areas', o.get('functionalArea', ref.i).subjectAreaCount]];
    case 'docGroup': return [['tables', o.get('docGroup', ref.i).tableCount]];
    case 'entity': { const e = o.get('entity', ref.i); return [['domain code', e.domainCode], ['keys resolved', `${e.resolvedKeys} of ${e.keys.length}`]]; }
    case 'sqlSource': { const s = o.get('sqlSource', ref.i); return [['kind', s.kind], ['subject areas', s.saCount], ['columns', s.columns]]; }
    default: return [];
  }
}

interface NbList { id: string; edge: EdgeType; dir: 'out' | 'in'; prov: Neighbor['provenance']; items: Neighbor[] }

function neighbourLists(o: Ontology, ref: NodeRef): NbList[] {
  const lists: NbList[] = [];
  const pairs = new Set<string>();
  for (const g of o.edgeGroups()) {
    if (g.from === ref.type) pairs.add(`${g.type}|out`);
    if (g.to === ref.type) pairs.add(`${g.type}|in`);
  }
  for (const p of pairs) {
    const [edge, dir] = p.split('|') as [EdgeType, 'out' | 'in'];
    if (edge === 'usedWith' && dir === 'in') continue;   // symmetric: shown once, from the 'out' side plus 'in'
    const items = o.neighbors(ref, edge, dir);
    if (edge === 'usedWith') items.push(...o.neighbors(ref, edge, 'in'));
    const by = new Map<Neighbor['provenance'], Neighbor[]>();
    for (const it of items) (by.get(it.provenance) ?? by.set(it.provenance, []).get(it.provenance)!).push(it);
    for (const [prov, list] of by) {
      list.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || nameOf(o, a.ref).localeCompare(nameOf(o, b.ref)));
      lists.push({ id: `${edge}-${dir}-${prov}`, edge, dir, prov, items: list });
    }
  }
  return lists;
}

const CAP = 12;

function NeighbourList({ o, list }: { o: Ontology; list: NbList }) {
  const [all, setAll] = useState(false);
  const shown = all ? list.items : list.items.slice(0, CAP);
  const word = NEIGHBOUR_WORD[list.edge][list.dir === 'out' ? 0 : 1];
  return (
    <section className="nb" aria-labelledby={`${list.id}-h`}>
      <h3 id={`${list.id}-h`} className="nb-h">
        <ProvenanceMark kind={lineKind(list.prov)} word={false} />
        <span className="mono-cap">{word.toUpperCase()}</span>
        <span className="nb-count">{n(list.items.length)}</span>
        <span className="prov-word">{list.prov}</span>
      </h3>
      <ul className="nb-list">
        {shown.map((it, k) => (
          <li key={`${it.ref.type}${it.ref.i}${k}`}>
            <Link to={atlasPath(it.ref.type, o.key(it.ref.type, it.ref.i))}>{nameOf(o, it.ref)}</Link>
            {it.weight !== undefined && <span className="faint mono-cap"> in {it.weight} subject area{it.weight === 1 ? '' : 's'}</span>}
          </li>
        ))}
      </ul>
      {list.items.length > CAP && (
        <button type="button" className="btn" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? `show fewer` : `show all ${n(list.items.length)}`}
        </button>
      )}
    </section>
  );
}

export function EntityPage({ type, entityKey }: { type: string; entityKey: string }) {
  const { ontology: o, error } = useOntology();
  const [version, setVersion] = useState(0);   // bumps when a lazy file lands
  const [loading, setLoading] = useState<'columns' | 'usedwith' | null>(null);
  const validType = NODE_TYPES.includes(type as NodeType);
  const nt = type as NodeType;

  // lazy files: a page that needs them asks for them, nothing else does
  useEffect(() => {
    if (!o || !validType) return;
    const wanted: ('columns' | 'usedwith')[] = [];
    if ((COLUMN_TYPES.includes(nt) || nt === 'subjectArea') && !o.has('columns')) wanted.push('columns');
    if (nt === 'physicalTable' && !o.has('usedwith')) wanted.push('usedwith');
    if (!wanted.length) return;
    let live = true;
    setLoading(wanted[0]);
    Promise.all(wanted.map((f) => o.ensure(f))).then(() => { if (live) { setVersion((v) => v + 1); setLoading(null); } }, () => live && setLoading(null));
    return () => { live = false; };
  }, [o, nt, validType, entityKey]);

  const ref = useMemo<NodeRef | undefined>(() => {
    if (!o || !validType || !o.available(nt)) return undefined;
    const i = o.find(nt, entityKey);
    return i === undefined ? undefined : { type: nt, i };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, nt, entityKey, validType, version]);

  const title = ref && o ? tagLabel(o, ref) : entityKey;
  useEffect(() => { document.title = `${title} - The Warehouse, Drawn`; }, [title]);

  if (error) return <Sheet label="ERROR" head="The ontology did not load" body={error} />;
  if (!validType) return <Sheet label="NOT FOUND" head="There is no such kind of page" body={`"${type}" is not a kind of Atlas page.`} />;
  if (!o || loading) return <p className="mono-cap faint" aria-busy="true">loading the ontology...</p>;
  if (!ref) return <Sheet label="NOT FOUND" head="Nothing here by that name" body={`No ${TYPE_LABEL[nt].toLowerCase()} is called "${entityKey}".`} />;

  const lists = neighbourLists(o, ref);
  const full = nameOf(o, ref);
  const wantColumns = NEEDS_COLUMN_LINKS.includes(nt) && !o.has('columns');
  const layer = layerOf(o, ref);
  return (
    <article className="entity">
      <header className="page-head">
        <p className="label-row">{TYPE_LABEL[nt]} <i /> {roleLine(o, ref).toUpperCase()}</p>
        <h1 className="entity-name"><LayerTag layer={layer} label={tagLabel(o, ref)} seed={7} /></h1>
        {full !== tagLabel(o, ref) && <p className="entity-full">{full}</p>}
      </header>

      <section className="band" aria-labelledby="facts-h">
        <div className="seam" aria-hidden="true" />
        <h2 id="facts-h" className="h-label">KEY FACTS</h2>
        <dl className="facts">
          {factsOf(o, ref).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      </section>

      {nt === 'subjectArea' && (
        <section className="band" aria-labelledby="star-h">
          <div className="seam" aria-hidden="true" />
          <h2 id="star-h" className="h-label">THE STAR</h2>
          <FigureFrame
            figure="sewn-star" ontology={o} props={{ subjectArea: o.get('subjectArea', ref.i).name, ranked: o.has('columns') }} number={1} title="A star, sewn"
            caption="Stitched thread = inferred: a dimension is drawn with the fact because both appear in this subject area. It is not a verified join. Dimensions are ranked by how many of this subject area's columns they feed; the ones nearly every subject area uses are one tag. Names are shown without DW_NS_."
          />
        </section>
      )}

      <section className="band" aria-labelledby="nb-h">
        <div className="seam" aria-hidden="true" />
        <h2 id="nb-h" className="h-label">NEIGHBOURS <span className="h-aside">grouped by how they connect</span></h2>
        {lists.length === 0 && <p className="faint">No links from here are in the ontology.</p>}
        {lists.map((l) => <Fragment key={l.id}><NeighbourList o={o} list={l} /></Fragment>)}
        {wantColumns && (
          <div className="nb">
            <p>The links to this page&apos;s columns live in the column-level file (about 1.9 MB), loaded only when asked.</p>
            <button type="button" className="btn" disabled={loading !== null} onClick={() => { setLoading('columns'); o.ensure('columns').then(() => { setVersion((v) => v + 1); setLoading(null); }, () => setLoading(null)); }}>
              load the column links
            </button>
          </div>
        )}
        <div className="legend">
          <p className="mono-cap">HOW A LINE WAS DRAWN</p>
          <p><ProvenanceMark kind="explicit" /> in the data &nbsp; <ProvenanceMark kind="inferred" /> by a rule, or a curated rule &nbsp; </p>
        </div>
      </section>
      <p className="back"><Link to="/atlas">The Atlas</Link></p>
    </article>
  );
}

function Sheet({ label, head, body }: { label: string; head: string; body: string }) {
  return (
    <article className="entity">
      <header className="page-head">
        <p className="label-row">{label}</p>
        <h1 className="title">{head}</h1>
        <p className="dek">{body}</p>
      </header>
      <p><Link to="/atlas">Back to the Atlas</Link></p>
    </article>
  );
}
