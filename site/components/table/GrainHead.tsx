// Table page head: eyebrow (role, name, secured tag), the grain headline from Oracle's Entity Key List with its key
// tags, further key-list entries as quiet lines, and the stats strip (positive counts only).
import { keyOrder, type CoreModel, type TableSummary, type LedgerSummary, fmt } from '../../../explorer/data';

const ROLE_LABEL: Record<string, string> = { enhanced: 'enhanced fact', calculated: 'calculated table', global: 'global table', prediction: 'prediction table', security: 'security table', unknown: 'table' };

export function KeyTags({ cols, hot }: { cols: string[]; hot?: boolean }) {
  return (
    <>
      {keyOrder(cols).map((c, i) => (
        <span key={c}>{i > 0 && <span className="tp-plus">+</span>}<span className={hot ? 'ktag hot' : 'ktag'}>{c}</span></span>
      ))}
    </>
  );
}

export function GrainHead({ s, ledger }: { m: CoreModel; s: TableSummary; ledger: LedgerSummary | null }) {
  const g0 = s.grain[0];
  const stats: { n: number; t: string }[] = [
    { n: s.columns, t: s.columns === 1 ? 'column' : 'columns' },
    { n: ledger?.withSource ?? 0, t: 'with a NetSuite source in the lineage' },
    { n: s.records.length, t: s.records.length === 1 ? 'NetSuite record it is loaded from' : 'NetSuite records it is loaded from' },
    { n: s.dimension?.reach ?? 0, t: 'subject areas list it in the bus matrix' },
    { n: ledger?.subjectAreas ?? 0, t: ledger?.subjectAreas === 1 ? 'subject area reads it' : 'subject areas read it' },
    { n: ledger?.reportColumns ?? 0, t: ledger?.reportColumns === 1 ? 'report column reads it' : 'report columns read it' },
  ].filter((x) => x.n > 0);

  return (
    <section className="tp-head" aria-labelledby="tp-h1">
      <div className="eyebrow">
        <span className="tag">{ROLE_LABEL[s.role] ?? s.role}</span>
        <h1 id="tp-h1" className="tp-name mono">{s.name}</h1>
        {s.secured && <span className="badge tp-secured">secured</span>}
      </div>
      <p className="tp-grain">{s.grainSentence ?? s.pretty}</p>
      {g0 && (
        <div className="tp-keyline">
          <span className="tp-klbl">Key</span>
          <KeyTags cols={g0.cols} hot />
          <span className="tp-src"><span className="tp-mark" aria-hidden="true" />stated in Oracle’s Entity Key List as <i>{g0.entity}</i></span>
        </div>
      )}
      {s.grain.slice(1).map((g) => (
        <p key={g.entity} className="tp-also">
          <span className="tp-klbl">Also in the key list</span> <i>{g.entity}</i> keys it by <KeyTags cols={g.cols} />.
        </p>
      ))}
      {stats.length > 0 && (
        <div className="stats tp-stats">
          {stats.map((x) => <div key={x.t} className="stat"><b>{fmt(x.n)}</b><span>{x.t}</span></div>)}
        </div>
      )}
    </section>
  );
}
