import { Link } from '../router';
import { atlasPath } from '../routes';
import { useOntology } from '../useOntology';

const STARTS: { label: string; type: string; key: string }[] = [
  { label: 'Sales Order, a subject area', type: 'subjectArea', key: 'NetSuite - Sales Order' },
  { label: 'DW_NS_CUSTOMER_D, a dimension table', type: 'physicalTable', key: 'DW_NS_CUSTOMER_D' },
  { label: 'DW_NS_SALES_ORDER_LINES_F, a fact table', type: 'physicalTable', key: 'DW_NS_SALES_ORDER_LINES_F' },
  { label: 'transactions, a NetSuite record', type: 'netsuiteRecord', key: 'transactions' },
];

export function AtlasHome() {
  const { ontology, error } = useOntology();
  const c = ontology?.core.meta.counts;
  return (
    <>
      <header className="page-head">
        <p className="label-row">THE ATLAS</p>
        <h1 className="title">Every table has a page</h1>
        <p className="dek">The home of the Atlas will be a sewn bus matrix, subject areas by shared dimensions. It is not drawn yet. Until then, start from any of these.</p>
      </header>
      <section className="band" aria-labelledby="start-h">
        <div className="seam" aria-hidden="true" />
        <h2 id="start-h" className="h-label">START SOMEWHERE</h2>
        <ul className="plain-list">
          {STARTS.map((s) => <li key={s.key}><Link to={atlasPath(s.type, s.key)}>{s.label}</Link></li>)}
        </ul>
        <p className="mono-cap faint">
          {error ? `could not load the ontology: ${error}` : c ? `${c.subjectAreas} subject areas, ${c.presentationTables.toLocaleString('en-US')} presentation tables, ${c.physicalTables} warehouse tables, ${c.netsuiteRecords} NetSuite records` : 'loading the ontology...'}
        </p>
      </section>
    </>
  );
}

export function IndexStub() {
  return (
    <>
      <header className="page-head">
        <p className="label-row">THE INDEX</p>
        <h1 className="title">Search is not drawn yet</h1>
        <p className="dek">The Index will answer like the back of a book: concepts first, then the tables and fields that carry them, and questions about how things relate.</p>
      </header>
      <section className="band">
        <div className="seam" aria-hidden="true" />
        <p>For now, <Link to="/atlas">browse the Atlas</Link>, or use <a href="/legacy.html">the old explorer</a>, which has a working search.</p>
      </section>
    </>
  );
}

export function NotFound({ path }: { path: string }) {
  return (
    <>
      <header className="page-head">
        <p className="label-row">NOT FOUND</p>
        <h1 className="title">There is no page here</h1>
        <p className="dek"><code>{path}</code> is not a page of this manual.</p>
      </header>
      <p><Link to="/">Back to the contents</Link></p>
    </>
  );
}
