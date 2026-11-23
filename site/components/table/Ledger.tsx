// The column ledger: NetSuite source field -> warehouse column -> report column names, one row per column, with
// solid wires in the two gutters (stated links only). The selected row (?col=) lights its path in the accent; the
// page's inspector shows that column (its sources, report names and the subject areas that read it).
// Rows are buttons (aria-pressed). Wires are aria-hidden. Phone: each row stacks, no wires.
import { useMemo, useRef } from 'react';
import { Link, setQuery, useQuery } from '../../router';
import { fieldPath } from '../../routes';
import { Wires, type Wire } from '../Wires';
import { plural, type ColumnModel, type CoreModel, type Ledger as LedgerData, type LedgerRow } from '../../../explorer/data';

function Row({ r, hasSrc, hasRep, sel, any, onPick, table, area }: { r: LedgerRow; hasSrc: boolean; hasRep: boolean; sel: boolean; any: boolean; onPick: (r: LedgerRow) => void; table: string; area: string | null }) {
  const top = r.reports[0];
  const cls = ['lg-row', sel ? 'sel' : any ? 'cool' : ''].filter(Boolean).join(' ');
  // The row is not one button: its NetSuite fields are links (to their trace) and the warehouse column is the button
  // that selects the row. A click anywhere else in the row selects it too.
  return (
    <div className={cls} onClick={(e) => { if (!(e.target as HTMLElement).closest('a, button')) onPick(r); }}>
      {hasSrc && (
        <span className="lg-cell lg-src">
          {r.sources.map((s, i) => (
            <Link key={s.field} to={fieldPath(s.record, s.key.slice(s.record.length + 1), { from: table }, area)} className="lg-s lg-fl mono" data-wire={`S${r.col}-${i}`}
              title={`Trace ${s.label} across every subject area`}>
              <span className="lg-rec">{s.record}.</span>{s.label.slice(s.record.length + 1)}
            </Link>
          ))}
        </span>
      )}
      {hasSrc && <span className="lg-gap" aria-hidden="true" />}
      <span className="lg-cell lg-col">
        <button type="button" className="lg-c mono" data-wire={`C${r.col}`} aria-pressed={sel} onClick={() => onPick(r)}>{r.name}</button>
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

  const area = useQuery().area || null;
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
        {hasSrc && <p className="lg-lead">Pick a NetSuite field to trace it across every subject area.</p>}
        <p className="sec-p">
          Pick a warehouse column to see it in the inspector. Every column of this table{hasSrc ? ', from the NetSuite field the lineage names' : ''}{hasRep ? ' to the report columns that read it' : ''}.
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
              {rows.map((r) => <Row key={r.col} r={r} hasSrc={hasSrc} hasRep={hasRep} sel={sel?.col === r.col} any={any} onPick={pick} table={m.tables[ledger.table].name} area={area} />)}
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
    </section>
  );
}
