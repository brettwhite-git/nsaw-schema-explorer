// One subject area. Top: the flow (level 2 of 4): the facts Oracle's 26R4 data model draws for this area and the
// tables their diagrams relate them to, as a bipartite flow (default) or a mini bus matrix (?view=grid). Picking a
// fact or table (?sel=fact:NAME | dim:NAME) shows it in the inspector on the right. Below: the fact tables the bus
// matrix lists, the NetSuite fields behind them, shared dimensions, report folders, and "Compare with…". Every section
// renders only with data. A click on a fact or table opens it (/table/:name?area=); hovering previews it.
// Route: /area/:slug   ?view=grid   ?sel=
import { useCallback, useState } from 'react';
import { useExplorer } from '../useExplorer';
import { usePage } from '../usePage';
import { Link, setQuery, useLocation } from '../router';
import { fieldPath, matrixPath, parseQuery, tablePath } from '../routes';
import {
  areaFields, areaFlow, areaGrainSentence, areaSummary, findTable, fmt, plural, unslug, type AreaFlow, type AreaSummary,
} from '../../explorer/data';
import { NotFound } from './NotFound';
import { AreaFacts } from '../components/area/AreaFacts';
import { AreaDims } from '../components/area/AreaDims';
import { AreaCompare } from '../components/area/AreaCompare';
import { AreaFlowFigure } from '../components/area/AreaFlow';
import { AreaGridFigure } from '../components/area/AreaGrid';
import { Inspector, InspectorLayout } from '../components/Inspector';
import { inspectArea, inspectDimension, inspectFact } from '../components/inspector/builders';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number) => WORDS[n] ?? fmt(n);

/** "Sales Order lists 11 fact tables. Oracle’s 26R4 data model draws four of them and relates them to 33 tables; …" */
function flowSentence(a: AreaSummary, f: AreaFlow): string {
  const n = f.listed, d = f.facts.length, sh = f.shared;
  const drawn = d === n ? `Oracle’s 26R4 data model draws ${d === 1 ? 'it' : `all ${word(d)}`}` : `Oracle’s 26R4 data model draws ${word(d)} of them`;
  return `${a.label} lists ${plural(n, 'fact table')}. ${drawn} and relates ${d === 1 ? 'it' : 'them'} to ${plural(f.tables.length, 'table')}` +
    (sh ? `; ${fmt(sh)} ${sh === 1 ? 'is' : 'are'} shared by two or more of those facts.` : '.');
}

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

function Legend({ grid }: { grid: boolean }) {
  return (
    <div className="af-legend" aria-hidden="true">
      <span><i className="lg-line" />related in Oracle’s 26R4 data model</span>
      {grid && <span><i className="lg-dot" />the fact’s diagram draws this table</span>}
      <span><i className="lg-line sel" />selected</span>
    </div>
  );
}

export function Area({ slug }: { slug: string }) {
  const { core: m, columns: cm } = useExplorer({ columns: true });
  const [preview, setPreview] = useState<string | null>(null);
  const q = parseQuery(useLocation());
  const [figReady, setFigReady] = useState(false);
  const onReady = useCallback(() => setFigReady(true), []);
  const sa = m ? unslug(m, slug) : undefined;
  const a = m && sa !== undefined ? areaSummary(m, null, sa) : null;
  const flow = m && sa !== undefined ? areaFlow(m, sa) : null;
  usePage({ title: a?.label ?? (m ? 'Not found' : ''), ready: !!m && !!cm && (!flow?.facts.length || figReady) });

  if (!m) return <section className="page-h" aria-busy="true"><p className="note">Loading…</p></section>;
  if (!a || !flow || sa === undefined) return <NotFound path={`/area/${slug}`} />;

  const grid = q.view === 'grid';
  const tableOf = (x: string | null | undefined) => (x && /^(fact|dim):/.test(x) ? findTable(m, x.slice(x.indexOf(':') + 1)) : undefined);
  const selT = tableOf(q.sel);
  const sel = selT !== undefined ? q.sel! : null;
  // the inspector shows the hovered node, else the ?sel= one, else the area
  const showT = tableOf(preview) ?? selT;
  const showKey = tableOf(preview) !== undefined ? preview! : sel;
  const insp = showT === undefined ? inspectArea(m, sa)
    : showKey!.startsWith('fact:') ? inspectFact(m, cm, showT, sa) : inspectDimension(m, showT, sa);
  const fields = cm ? areaFields(m, cm, sa, 12) : [];
  const clear = () => setQuery({ sel: null }, { replace: true });
  const lead = flow.facts.length ? flowSentence(a, flow) : leadSentence(a);
  const grainLine = areaGrainSentence(m, sa);
  const hasRow = a.dimensions.length > 0;

  const head = (
    <header className="page-h ar-head">
      <p className="eyebrow">
        <span className="tag">subject area</span>
        {a.faName && <Link to={matrixPath({ a: hasRow ? a.slug : null })} className="ar-fa">{a.faName}</Link>}
      </p>
      <h1 className="title">{a.label}</h1>
      {a.name !== a.label && <p className="mono faint ar-sm">{a.name}</p>}
      {lead && <p className="lead">{lead}</p>}
    </header>
  );

  return (
    <article className="area">
      <InspectorLayout
        head={head}
        inspector={<Inspector {...insp} onClose={sel && !preview ? clear : undefined} closeLabel={`Back to ${a.label}`} />}
      >
        {flow.facts.length > 0 && (
          <section className="af-sec" aria-labelledby="af-h">
            <div className="af-h">
              <div className="af-hl">
                <h2 id="af-h">{grid ? 'Facts by related table' : 'Facts and the tables they relate to'}</h2>
                <div className="af-view" role="group" aria-label="View">
                  <button type="button" className="btn" aria-pressed={!grid} onClick={() => setQuery({ view: null }, { replace: true })}>Flow</button>
                  <button type="button" className="btn" aria-pressed={grid} onClick={() => setQuery({ view: 'grid' }, { replace: true })}>Grid</button>
                </div>
              </div>
              <Legend grid={grid} />
            </div>
            <p className="sec-p af-p">
              Each line is a relation one of the area’s fact diagrams draws. Click a fact or a table to open it; hover to
              preview it in the inspector.
            </p>
            {grid
              ? <AreaGridFigure key={`g${sa}`} m={m} flow={flow} sel={sel} onPreview={setPreview} onReady={onReady} />
              : <AreaFlowFigure key={`f${sa}`} m={m} flow={flow} sel={sel} onPreview={setPreview} onReady={onReady} />}
            {flow.others.length > 0 && (
              <p className="af-also">
                <i>Also listed in this area</i>{' '}
                {flow.others.map((t, k) => (
                  <span key={t}>
                    {k > 0 && <span className="faint" aria-hidden="true"> · </span>}
                    <Link to={tablePath(m.tables[t].name, a.slug)} className="mono">{m.tables[t].name}</Link>
                  </span>
                ))}
              </p>
            )}
          </section>
        )}

        {a.facts.length > 0 && (
          <section aria-labelledby="ar-facts-h" className="ar-sec">
            <div className="sec-h"><h2 id="ar-facts-h">Fact tables</h2><span className="faint num">{fmt(a.facts.length)}</span></div>
            <p className="sec-p">
              The bus matrix lists these facts for {a.label}.{grainLine ? ` ${grainLine}` : ''}
            </p>
            <AreaFacts m={m} facts={a.facts} area={a.slug} />
          </section>
        )}

        {fields.length > 0 && (
          <section aria-labelledby="ar-flds-h" className="ar-sec">
            <div className="sec-h"><h2 id="ar-flds-h">NetSuite fields behind this area</h2><span className="faint num">{fmt(fields.length)}</span></div>
            <p className="sec-p">
              The NetSuite fields loaded into {a.label}’s fact tables, by the number of its report columns that read them.
              Pick one to trace it across every subject area.
            </p>
            <ol className="ar-fields">
              {fields.map((f) => (
                <li key={f.field}>
                  <Link to={fieldPath(f.record, f.name.toLowerCase(), a.slug)} className="mono link">{f.record}.{f.name.toLowerCase()}</Link>
                  <span className="faint num">{plural(f.n, 'report column')}</span>
                </li>
              ))}
            </ol>
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
            <AreaDims m={m} dims={a.dimensions} area={a.slug} />
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

        {hasRow && (
          <section aria-labelledby="ar-cmp-h" className="ar-sec ar-cmp">
            <div className="sec-h"><h2 id="ar-cmp-h">Compare with…</h2></div>
            <AreaCompare m={m} sa={sa} />
          </section>
        )}
      </InspectorLayout>
    </article>
  );
}
