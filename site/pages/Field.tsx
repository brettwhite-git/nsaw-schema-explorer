// Impact trace: everything downstream of one NetSuite field. Route: /field/:record/:field  ?at=TABLE.COL  ?sa=slug
// ?area=slug (the subject area the reader came from). The inspector shows the field, or with ?at= the picked
// warehouse column, or with ?sa= the picked subject area and its report columns that read the field.
// Ported from renderTrace in lab/paper-lineage/main.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { findField, traceAreasSentence, traceField, traceProvenanceSentence, traceSentence, unslug } from '../../explorer/data';
import { Link, setQuery, useQuery } from '../router';
import { fieldPath, searchPath } from '../routes';
import { useExplorer } from '../useExplorer';
import { usePage } from '../usePage';
import { TraceLedger } from '../components/field/TraceLedger';
import { SAMPLE_TRACES, areaReportColumns, resolveSelection } from '../components/field/select';
import { Inspector, InspectorLayout } from '../components/Inspector';
import { inspectArea, inspectColumn, inspectField } from '../components/inspector/builders';
import { AreaColumnsDetails, ColumnDetails, NameList } from '../components/inspector/details';

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
  const { at, sa, area } = useQuery();
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
  const home = area ? unslug(core, area) : undefined;
  const here = `/field/${encodeURIComponent(record)}/${encodeURIComponent(field)}`;
  let insp, details;
  if (sel.at !== undefined) {
    insp = inspectColumn(core, columns, sel.at, home);
    details = <ColumnDetails m={core} cm={columns} c={sel.at} />;
  } else if (sel.sa !== undefined) {
    const ta = trace.functionalAreas.flatMap((g) => g.areas).find((x) => x.sa === sel.sa)!;
    insp = inspectArea(core, sel.sa);
    insp.lead = `${ta.label} reads ${ta.columns.length === 1 ? 'one' : ta.columns.length} of the warehouse columns this field feeds.`;
    details = <AreaColumnsDetails rows={areaReportColumns(columns, sel.sa, ta.columns)} limit={24} title={`Report columns reading ${trace.label}`} />;
  } else {
    insp = inspectField(core, trace, home);
    details = <NameList rows={trace.reportNames.map((r) => ({ name: r.name, areas: r.areas }))} limit={22} title="Report columns, by name" />;
  }
  insp.actions = insp.actions?.filter((x) => x.to.split('?')[0] !== here);

  const head = (
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
          return <Link key={k} to={fieldPath(r, f, area)} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{k}</Link>;
        })}
      </p>
      <div className="tr-reading">
        <p><Mark /><span>Each warehouse column the field feeds, then one bundle per functional area, splitting to its subject areas.</span></p>
        <p><Mark hot /><span><b>Selected.</b> Click a column or a subject area to see it in the inspector.</span></p>
        <div className="actions"><CopyLink /></div>
      </div>
    </section>
  );

  return (
    <div className="trace">
      <InspectorLayout
        head={head}
        inspector={(
          <Inspector {...insp} onClose={sel.any ? () => setQuery({ at: null, sa: null }, { replace: true }) : undefined} closeLabel={`Back to ${trace.label}`}>
            {details}
          </Inspector>
        )}
      >
        {hasLinks && (
          <>
            <section className="tr-ledp" aria-label="Impact trace">
              <TraceLedger core={core} cm={columns} trace={trace} sel={sel} />
            </section>
            <p className="tr-foot">
              Every link on this page is stated in Oracle’s semantic model lineage: the NetSuite field each warehouse column is
              loaded from, and the report columns and subject areas that read it.
            </p>
          </>
        )}
      </InspectorLayout>
    </div>
  );
}
