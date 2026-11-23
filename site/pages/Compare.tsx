// Route: /compare/:a/:b (subject-area slugs). Differences lead: the dimensions only one of the two areas lists,
// in the accent. The dimensions both list follow as a quiet count with a collapsed list.
import { Link } from '../router';
import { areaPath, matrixPath, tablePath } from '../routes';
import { usePage } from '../usePage';
import { useExplorer } from '../useExplorer';
import { compare, compareSentence, plural, prettyTable, reach, shortTable, unslug, type CoreModel } from '../../explorer/data';

export function Compare({ a, b }: { a: string; b: string }) {
  const { core: m, error } = useExplorer();
  const saA = m ? unslug(m, a) : undefined;
  const saB = m ? unslug(m, b) : undefined;
  const ok = !!m && saA !== undefined && saB !== undefined;
  usePage({ title: ok ? `${m!.subjectAreas[saA!].label} and ${m!.subjectAreas[saB!].label}` : 'Compare', ready: !!m });
  if (!m) return (
    <section className="page-h">
      <h1 className="title">Compare</h1>
      <p className="note">{error ? `The ontology did not load: ${error}` : 'Loading…'}</p>
    </section>
  );
  if (!ok) return (
    <section className="page-h">
      <h1 className="title">Compare two subject areas</h1>
      <p className="lead">Pick two rows on the <Link to={matrixPath()}>bus matrix</Link> to compare the dimensions they list.</p>
    </section>
  );
  return <CompareBody m={m} saA={saA!} saB={saB!} />;
}

function DimRows({ m, cols, hot }: { m: CoreModel; cols: number[]; hot?: boolean }) {
  return (
    <ul className={`cmp-list${hot ? ' hot' : ''}`}>
      {cols.map((c) => {
        const name = m.tables[m.bus.columns[c]].name;
        return (
          <li key={c}>
            <Link className="nm" to={tablePath(name)}>{prettyTable(m, name)}</Link>
            <span className="mono t">{shortTable(name)}</span>
            <span className="n" title={`listed under ${reach(m, c)} subject areas`}>{reach(m, c)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Excerpt({ m, saA, saB, cols, diff }: { m: CoreModel; saA: number; saB: number; cols: number[]; diff: Set<number> }) {
  const rows = [{ sa: saA, k: 'A' }, { sa: saB, k: 'B' }];
  return (
    <div className="cmp-x-wrap">
      <table className="cmp-x" aria-label="The two rows of the bus matrix, over the dimensions either lists">
        <thead>
          <tr>
            <td />
            {cols.map((c) => (
              <th key={c} scope="col" className={diff.has(c) ? 'hot' : ''} title={m.tables[m.bus.columns[c]].name}>
                <span>{prettyTable(m, m.tables[m.bus.columns[c]].name)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sa, k }) => {
            const set = m.rowSets[m.subjectAreas[sa].row];
            const label = m.subjectAreas[sa].label;
            return (
              <tr key={k}>
                <th scope="row"><b>{k}</b>{label}</th>
                {cols.map((c) => {
                  const on = set.has(c);
                  const nm = prettyTable(m, m.tables[m.bus.columns[c]].name);
                  return (
                    <td key={c} className={on ? (diff.has(c) ? 'on hot' : 'on') : ''} aria-label={on ? `${label} lists ${nm}` : `${label}, ${nm}`}>
                      {on && <i />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompareBody({ m, saA, saB }: { m: CoreModel; saA: number; saB: number }) {
  const A = m.subjectAreas[saA], B = m.subjectAreas[saB];
  const c = compare(m, saA, saB);
  const lead = compareSentence(m, saA, saB);
  const diff = new Set([...c.onlyA, ...c.onlyB]);
  const cols = [...c.onlyA, ...c.onlyB, ...c.both].sort((x, y) => reach(m, y) - reach(m, x) || x - y);
  const faOf = (s: typeof A) => (s.fa >= 0 ? m.functionalAreas[s.fa].name : '');

  return (
    <>
      <section className="page-h cmp-h">
        <p className="eyebrow">
          <Link className="tag" to={matrixPath()}>Bus matrix</Link>
          <span className="tag">/</span>
          <span className="tag">Comparing two subject areas</span>
        </p>
        <h1 className="title cmp-title">
          <span><i>A</i><Link className="plain" to={areaPath(A.slug)}>{A.label}</Link></span>
          <span className="and">and</span>
          <span><i>B</i><Link className="plain" to={areaPath(B.slug)}>{B.label}</Link></span>
        </h1>
        <p className="cmp-meta">
          <span>{faOf(A)}{faOf(A) && ' · '}<span className="mono">{A.name}</span></span>
          <span>{faOf(B)}{faOf(B) && ' · '}<span className="mono">{B.name}</span></span>
        </p>
        {lead && <p className="lead cmp-lead">{lead}</p>}
        <div className="cmp-trio">
          <div className="hot"><b>{c.onlyA.length}</b><span>only in A, {A.label}</span></div>
          <div className="hot"><b>{c.onlyB.length}</b><span>only in B, {B.label}</span></div>
          <div className="quiet"><b>{c.both.length}</b><span>listed under both</span></div>
        </div>
      </section>

      {(c.onlyA.length > 0 || c.onlyB.length > 0) && (
        <section className="cmp-diff">
          {c.onlyA.length > 0 && (
            <div>
              <h2 className="sec-t"><i>A</i>Only in {A.label} <span className="n">reach</span></h2>
              <DimRows m={m} cols={c.onlyA} hot />
            </div>
          )}
          {c.onlyB.length > 0 && (
            <div>
              <h2 className="sec-t"><i>B</i>Only in {B.label} <span className="n">reach</span></h2>
              <DimRows m={m} cols={c.onlyB} hot />
            </div>
          )}
        </section>
      )}

      {cols.length > 0 && (
        <section className="cmp-sec">
          <h2 className="sec-t">The two rows of the matrix</h2>
          <p className="note">Each column is a dimension either area lists, most shared first. Differences are filled in the accent; dimensions listed under both are drawn hollow.</p>
          <Excerpt m={m} saA={saA} saB={saB} cols={cols} diff={diff} />
        </section>
      )}

      {c.both.length > 0 && (
        <section className="cmp-sec">
          <details className="cmp-both">
            <summary>{plural(c.both.length, 'dimension')} listed under both</summary>
            <DimRows m={m} cols={c.both} />
          </details>
        </section>
      )}

      <p className="cmp-links">
        <Link className="linkbtn" to={matrixPath({ a: A.slug, b: B.slug })}>See both rows on the matrix</Link>
        <Link className="linkbtn" to={areaPath(A.slug)}>Open {A.label}</Link>
        <Link className="linkbtn" to={areaPath(B.slug)}>Open {B.label}</Link>
      </p>
    </>
  );
}
