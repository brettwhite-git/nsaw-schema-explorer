// Impact trace: everything downstream of one NetSuite field. Route: /field/:record/:field  ?at=TABLE.COL  ?sa=slug
// Ported from renderTrace in lab/paper-lineage/main.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { findField, traceAreasSentence, traceField, traceProvenanceSentence, traceSentence } from '../../explorer/data';
import { Link, useQuery } from '../router';
import { fieldPath, searchPath } from '../routes';
import { useExplorer } from '../useExplorer';
import { usePage } from '../usePage';
import { TraceLedger } from '../components/field/TraceLedger';
import { TraceDrawer } from '../components/field/TraceDrawer';
import { SAMPLE_TRACES, resolveSelection } from '../components/field/select';

function Mark({ hot }: { hot?: boolean }) {
  return (
    <svg className={`mark${hot ? ' hot' : ''}`} width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
      <line x1="0" y1="4" x2="22" y2="4" />
    </svg>
  );
}

function CopyLink() {
  const [done, setDone] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const copy = () => {
    navigator.clipboard?.writeText(location.href).catch(() => {});
    setDone(true);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => setDone(false), 1800);
  };
  return (
    <>
      <button type="button" className="btn" onClick={copy}>Copy link</button>
      <span className="tr-copied" role="status">{done ? 'Link copied. It opens this exact view.' : ''}</span>
    </>
  );
}

export function Field({ record, field }: { record: string; field: string }) {
  const key = `${record}.${field}`;
  const { at, sa } = useQuery();
  const { core, columns, ready, error } = useExplorer({ columns: true });
  const trace = useMemo(() => (ready && core && columns ? traceField(core, columns, key) : null), [ready, core, columns, key]);
  const sel = useMemo(() => (trace && core && columns ? resolveSelection(core, columns, trace, at, sa) : null), [trace, core, columns, at, sa]);
  usePage({ title: trace ? `Trace ${trace.label}` : key, ready: ready || !!error });

  if (error) return <section className="page-h"><h1 className="title">The lineage files did not load.</h1><p className="sub">{error}</p></section>;
  if (!ready || !core || !columns) {
    return <section className="page-h"><div className="eyebrow"><span className="tag">impact trace</span></div><h1 className="title mono">{key}</h1></section>;
  }
  if (!trace || !sel) {
    return (
      <section className="page-h">
        <h1 className="title">Nothing here is called <span className="mono">{key}</span>.</h1>
        <p className="sub"><Link to={searchPath(field)}>Search for <span className="mono">{field}</span></Link></p>
      </section>
    );
  }

  const sentence = traceSentence(columns, trace.field);
  const rest = sentence && sentence.startsWith(trace.label) ? sentence.slice(trace.label.length) : null;
  const sub = [traceProvenanceSentence(columns, trace.field), traceAreasSentence(columns, trace.field)].filter(Boolean).join(' ');
  const samples = SAMPLE_TRACES.filter((k) => findField(columns, k) !== undefined);
  const hasLinks = trace.totals.warehouseColumns > 0;

  return (
    <div className="grid trace">
      <section className="tr-head">
        <div className="eyebrow"><span className="tag">impact trace</span><span className="prov"><Mark />field named in Oracle’s lineage</span></div>
        <h1 className="tr-title">
          <span className="mono">{trace.label}</span>{rest ?? (sentence ? ` ${sentence}` : '')}
        </h1>
        {sub && <p className="sub">{sub}</p>}
        <p className="tries">
          <i>Trace another</i>
          {samples.map((k) => {
            const [r, f] = [k.slice(0, k.indexOf('.')), k.slice(k.indexOf('.') + 1)];
            const on = k === trace.key;
            return <Link key={k} to={fieldPath(r, f)} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{k}</Link>;
          })}
        </p>
      </section>
      <aside className="tr-reading">
        <div className="r-h">Reading the fan</div>
        <p><Mark /><span>Each warehouse column the field feeds, then one bundle per functional area, splitting to its subject areas.</span></p>
        <p><Mark hot /><span><b>Selected.</b> Click a column or a subject area.</span></p>
        <div className="actions"><CopyLink /></div>
      </aside>
      <hr className="rule" />
      {hasLinks && (
        <>
          <section className="tr-ledp" aria-label="Impact trace">
            <TraceLedger core={core} cm={columns} trace={trace} sel={sel} />
          </section>
          <aside className={`tr-drawer${sel.any ? ' sel' : ''}`} aria-live="polite">
            <TraceDrawer core={core} cm={columns} trace={trace} sel={sel} />
          </aside>
          <p className="tr-foot">
            Every link on this page is stated in Oracle’s semantic model lineage: the NetSuite field each warehouse column is
            loaded from, and the report columns and subject areas that read it.
          </p>
        </>
      )}
    </div>
  );
}
