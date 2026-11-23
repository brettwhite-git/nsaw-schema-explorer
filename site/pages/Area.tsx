// One subject area: its functional area, the fact tables and shared dimensions the bus matrix lists for it,
// its report folders, and the areas it is closest to. Every section renders only when it has data.
// Route: /area/:slug
import { useExplorer } from '../useExplorer';
import { usePage } from '../usePage';
import { Link } from '../router';
import { matrixPath } from '../routes';
import { areaSummary, type AreaSummary } from '../../explorer/data/area';
import { areaGrainSentence } from '../../explorer/data/copy';
import { fmt, plural, unslug } from '../../explorer/data/names';
import { NotFound } from './NotFound';
import { AreaFacts } from '../components/area/AreaFacts';
import { AreaDims } from '../components/area/AreaDims';
import { AreaCompare } from '../components/area/AreaCompare';

function leadSentence(a: AreaSummary): string {
  const parts: string[] = [];
  if (a.facts.length) parts.push(plural(a.facts.length, 'fact table'));
  if (a.dimensions.length) parts.push(plural(a.dimensions.length, 'shared dimension'));
  if (parts.length) {
    const through = a.reportColumns ? ` through ${plural(a.reportColumns, 'report column')}` : '';
    return `${a.label} reads ${parts.join(' and ')}${through}.`;
  }
  if (a.reportColumns) return `${a.label} has ${plural(a.reportColumns, 'report column')} in ${plural(a.folders.length, 'report folder')}.`;
  return '';
}

export function Area({ slug }: { slug: string }) {
  const { core: m } = useExplorer();
  const sa = m ? unslug(m, slug) : undefined;
  const a = m && sa !== undefined ? areaSummary(m, null, sa) : null;
  usePage({ title: a?.label ?? (m ? 'Not found' : ''), ready: !!m });

  if (!m) return <section className="page-h" aria-busy="true"><p className="note">Loading…</p></section>;
  if (!a || sa === undefined) return <NotFound path={`/area/${slug}`} />;

  const lead = leadSentence(a);
  const grainLine = areaGrainSentence(m, sa);
  const stats = [
    { n: a.facts.length, label: 'fact tables' },
    { n: a.dimensions.length, label: 'shared dimensions' },
    { n: a.folders.length, label: 'report folders' },
    { n: a.reportColumns, label: 'report columns' },
  ].filter((s) => s.n > 0);
  const hasRow = a.dimensions.length > 0;

  return (
    <article className="area">
      <header className="page-h ar-head">
        <p className="eyebrow">
          {a.faName && <Link to={matrixPath({ a: a.slug })} className="tag ar-fa">{a.faName}</Link>}
          <span className="tag faint">subject area</span>
        </p>
        <h1 className="title">{a.label}</h1>
        {a.name !== a.label && <p className="mono faint ar-sm">{a.name}</p>}
        {lead && <p className="lead">{lead}</p>}
        {stats.length > 0 && (
          <div className="stats">
            {stats.map((s) => <div key={s.label} className="stat"><b>{fmt(s.n)}</b><span>{s.label}</span></div>)}
          </div>
        )}
      </header>

      <div className="grid ar-grid">
        <div className="main ar-main">
          {a.facts.length > 0 && (
            <section aria-labelledby="ar-facts-h">
              <div className="sec-h"><h2 id="ar-facts-h">Fact tables</h2><span className="faint num">{fmt(a.facts.length)}</span></div>
              <p className="sec-p">
                The bus matrix lists these facts for {a.label}.{grainLine ? ` ${grainLine}` : ''}
              </p>
              <AreaFacts m={m} facts={a.facts} />
            </section>
          )}

          {hasRow && (
            <section aria-labelledby="ar-dims-h" className="ar-sec">
              <div className="sec-h">
                <h2 id="ar-dims-h">Shared dimensions</h2>
                <Link to={matrixPath({ a: a.slug })} className="more">its row in the bus matrix</Link>
              </div>
              <p className="sec-p">
                The columns of this area’s row in the bus matrix, most shared first. Each bar shows how many of
                the {fmt(m.subjectAreas.length)} subject areas list the dimension.
              </p>
              <AreaDims m={m} dims={a.dimensions} />
            </section>
          )}

          {a.folders.length > 0 && (
            <section aria-labelledby="ar-fold-h" className="ar-sec">
              <div className="sec-h"><h2 id="ar-fold-h">Report folders</h2><span className="faint num">{fmt(a.folders.length)}</span></div>
              <p className="sec-p">The presentation tables of {a.label} in the semantic model, with the report columns in each.</p>
              <ul className="ar-folders">
                {a.folders.map((f) => (
                  <li key={f.pt}><span>{f.name}</span>{f.columns > 0 && <span className="faint num">{fmt(f.columns)}</span>}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="side ar-side">
          {hasRow && (
            <section aria-labelledby="ar-cmp-h">
              <h2 id="ar-cmp-h" className="h3">Compare with…</h2>
              <AreaCompare m={m} sa={sa} />
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
