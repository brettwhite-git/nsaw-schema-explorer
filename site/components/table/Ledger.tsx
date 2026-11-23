// The column ledger: NetSuite source field -> warehouse column -> report column names, one row per column, with
// solid wires in the two gutters (stated links only). The selected row (?col=) lights its path in the accent; the
// side card shows that column's source and the report columns and subject areas that read it.
// Rows are buttons (aria-pressed). Wires are aria-hidden. Phone: each row stacks, no wires.
import { useMemo, useRef } from 'react';
import { Link, setQuery } from '../../router';
import { areaPath, fieldPath } from '../../routes';
import { Wires, type Wire } from '../Wires';
import { columnReadSentence, plural, type ColumnModel, type CoreModel, type Ledger as LedgerData, type LedgerRow } from '../../../explorer/data';

const fieldOf = (key: string, record: string) => key.slice(record.length + 1);

function Row({ r, hasSrc, hasRep, sel, any, onPick }: { r: LedgerRow; hasSrc: boolean; hasRep: boolean; sel: boolean; any: boolean; onPick: (r: LedgerRow) => void }) {
  const top = r.reports[0];
  const cls = ['lg-row', sel ? 'sel' : any ? 'cool' : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} aria-pressed={sel} onClick={() => onPick(r)}>
      {hasSrc && (
        <span className="lg-cell lg-src">
          {r.sources.map((s, i) => (
            <span key={s.field} className="lg-s mono" data-wire={`S${r.col}-${i}`}>
              <span className="lg-rec">{s.record}.</span>{s.label.slice(s.record.length + 1)}
            </span>
          ))}
        </span>
      )}
      {hasSrc && <span className="lg-gap" aria-hidden="true" />}
      <span className="lg-cell lg-col">
        <span className="lg-c mono" data-wire={`C${r.col}`}>{r.name}</span>
        {r.isKey && <span className="badge key">key</span>}
        {r.toHeader && <span className="badge">to header</span>}
      </span>
      {hasRep && <span className="lg-gap" aria-hidden="true" />}
      {hasRep && (
        <span className="lg-cell lg-rep">
          {top && (
            <>
              <span className="lg-r" data-wire={`R${r.col}`}>{top.name}</span>
              {r.reports.length > 1 && <span className="lg-more">+ {r.reports.length - 1} more</span>}
              <span className="lg-areas num">{plural(r.areas, 'area')}</span>
            </>
          )}
        </span>
      )}
    </button>
  );
}

function SideCard({ m, cm, r, hasSrc }: { m: CoreModel; cm: ColumnModel; r: LedgerRow | undefined; hasSrc: boolean }) {
  if (!r) {
    return (
      <div className="lg-card">
        <div className="sec-h"><h2>Pick a column</h2></div>
        <p className="sec-p">Pick a warehouse column to light its path {hasSrc ? 'from NetSuite to the reports' : 'to the reports'}. The address bar keeps the choice, so the link opens this exact view.</p>
      </div>
    );
  }
  const byArea = new Map<number, Set<string>>();
  for (const p of cm.physPres[r.col]) (byArea.get(cm.prcSa[p]) ?? byArea.set(cm.prcSa[p], new Set()).get(cm.prcSa[p])!).add(cm.prcName[p]);
  const areas = [...byArea].sort((a, b) => m.subjectAreas[a[0]].label.localeCompare(m.subjectAreas[b[0]].label));
  const many = r.reports.length > 1;
  const read = columnReadSentence(cm, r.col);
  return (
    <div className="lg-card" aria-live="polite">
      <div className="sec-h"><h2>Selected column</h2></div>
      <p className="lg-cname mono">{r.name}</p>
      {r.sources.map((s) => (
        <p key={s.field} className="lg-from">
          <span className="faint">from</span>
          <Link to={fieldPath(s.record, fieldOf(s.key, s.record))} className="mono link">{s.label}</Link>
          <span className="tp-prov"><span className="tp-mark" aria-hidden="true" />stated</span>
        </p>
      ))}
      {read && <p className="lg-sum">{read}</p>}
      {many && (
        <ul className="lg-names">
          {r.reports.map((n) => <li key={n.name}><span>{n.name}</span><span className="faint num">{plural(n.areas, 'area')}</span></li>)}
        </ul>
      )}
      {areas.length > 0 && (
        <ul className="lg-areas-list">
          {areas.map(([sa, names]) => (
            <li key={sa}>
              <Link to={areaPath(m.subjectAreas[sa].slug)} className="link">{m.subjectAreas[sa].label}</Link>
              {many && <small>{[...names].join(' · ')}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Ledger({ m, cm, ledger, col }: { m: CoreModel; cm: ColumnModel; ledger: LedgerData; col: string | undefined }) {
  // The scope is the rows list, where every data-wire id lives (the wire gutters sit beside it).
  const scope = useRef<HTMLDivElement>(null);
  const rows = ledger.rows;
  const sel = col ? rows.find((r) => r.name.toLowerCase() === col.toLowerCase()) : undefined;
  const hasSrc = ledger.summary.withSource > 0;
  const hasRep = ledger.summary.reachingReport > 0;
  const any = !!sel;

  const [w1, w2] = useMemo(() => {
    const a: Wire[] = [], b: Wire[] = [];
    for (const r of rows) {
      const hot = sel?.col === r.col;
      r.sources.forEach((_, i) => a.push({ a: `S${r.col}-${i}`, b: `C${r.col}`, selected: hot, cool: any }));
      if (r.reports.length) b.push({ a: `C${r.col}`, b: `R${r.col}`, selected: hot, cool: any });
    }
    return [a, b];
  }, [rows, sel, any]);

  const pick = (r: LedgerRow) => setQuery({ col: sel?.col === r.col ? null : r.name }, { replace: true });
  const shape = `lg-shape${hasSrc ? ' s' : ''}${hasRep ? ' r' : ''}`;

  return (
    <section className="lg-band" aria-labelledby="lg-h">
      <div className="lg-main">
        <div className="sec-h">
          <h2 id="lg-h">Column ledger</h2>
          <span className="tp-prov"><span className="tp-mark" aria-hidden="true" />stated</span>
          <span className="tp-prov"><span className="tp-mark hot" aria-hidden="true" />selected</span>
        </div>
        <p className="sec-p">
          Every column of this table{hasSrc ? ', from the NetSuite field the lineage names' : ''}{hasRep ? ' to the report columns that read it' : ''}.
          {rows.some((r) => r.isKey) ? ' Key columns come first.' : ''}
        </p>
        <div className={`ledger ${shape}`}>
          <div className="lg-head" aria-hidden="true">
            {hasSrc && <span>NetSuite source field</span>}
            {hasSrc && <span />}
            <span>Warehouse column</span>
            {hasRep && <span />}
            {hasRep && <span>Report column, by name</span>}
          </div>
          <div className="lg-body">
            <div className="lg-rows" ref={scope}>
              {rows.map((r) => <Row key={r.col} r={r} hasSrc={hasSrc} hasRep={hasRep} sel={sel?.col === r.col} any={any} onPick={pick} />)}
            </div>
            <div className="lg-wires" aria-hidden="true">
              {hasSrc && <span />}
              {hasSrc && <Wires scope={scope} wires={w1} />}
              <span />
              {hasRep && <Wires scope={scope} wires={w2} />}
              {hasRep && <span />}
            </div>
          </div>
        </div>
      </div>
      <aside className="lg-side">
        <SideCard m={m} cm={cm} r={sel} hasSrc={hasSrc} />
      </aside>
    </section>
  );
}
