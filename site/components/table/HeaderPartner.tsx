// Header partner: the key list gives one key to `id` in a header table and to a link column in its line table.
// Drawn as two boxes joined by one solid line, 1 at the header, many at the lines. Each partner links to its page.
import { Link } from '../../router';
import { tablePath } from '../../routes';
import { grainOf, keyOrder, fmt, plural, type ColumnModel, type CoreModel } from '../../../explorer/data';

interface BoxProps { m: CoreModel; cm: ColumnModel; t: number; kick: string; here?: boolean; keyText?: string }

function Box({ m, cm, t, kick, here, keyText }: BoxProps) {
  const name = m.tables[t].name;
  const g = grainOf(m, t)[0];
  const key = keyText ?? (g ? keyOrder(g.cols).join(' + ') : '');
  const cols = cm.tableCols[t].length;
  const sas = cm.tableSas[t].length;
  const meta = [cols ? plural(cols, 'column') : '', sas ? plural(sas, 'subject area') : ''].filter(Boolean).join(' · ');
  return (
    <div className={here ? 'hp-box here' : 'hp-box'}>
      <span className="hp-kick">{kick}</span>
      {here ? <span className="hp-nm mono">{name}</span> : <Link to={tablePath(name)} className="hp-nm mono link">{name}</Link>}
      {key && <span className="hp-meta">key <span className="mono">{key}</span></span>}
      {meta && <span className="hp-meta">{meta}</span>}
    </div>
  );
}

function Join({ col, keyName }: { col: string; keyName: string }) {
  return (
    <div className="hp-join" aria-hidden="true">
      <span className="hp-one">1</span>
      <span className="hp-key mono">id = {col.toLowerCase()}</span>
      <span className="hp-many">many</span>
      <svg className="hp-line" preserveAspectRatio="none" viewBox="0 0 100 14">
        <line x1="0" y1="7" x2="100" y2="7" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="hp-tick" />
      <svg className="hp-arrow" viewBox="0 0 12 14"><path d="M0 0 L12 7 L0 14" /></svg>
      <span className="hp-kname mono">{keyName}</span>
    </div>
  );
}

/** One pair per row: header (left) to lines (right). `t` is the page's table. `skipHeader` when the data-model star draws it. */
export function HeaderPartner({ m, cm, t, skipHeader }: { m: CoreModel; cm: ColumnModel; t: number; skipHeader?: boolean }) {
  const h = skipHeader ? undefined : m.grain.header.get(t);
  const lines = m.grain.lines.get(t) ?? [];
  if (!h && !lines.length) return null;
  const linkCol = (lt: number) => m.grain.header.get(lt);
  return (
    <div className="hp">
      <div className="sec-h"><h2>Header partner</h2><span className="tp-prov"><span className="tp-mark" aria-hidden="true" />stated in the key list</span></div>
      {h && (
        <>
          <p className="sec-p">
            Oracle’s Entity Key List gives one key, <span className="mono">{h.key}</span> in <i>{h.entity}</i>, to <span className="mono">id</span> in
            the header and to <span className="mono">{h.col.toLowerCase()}</span> in this table.
          </p>
          <div className="hp-row" role="group" aria-label={`${m.tables[h.table].name} id joins ${m.tables[t].name} ${h.col.toLowerCase()}, one to many`}>
            <Box m={m} cm={cm} t={h.table} kick="Header" />
            <Join col={h.col} keyName={h.key} />
            <Box m={m} cm={cm} t={t} kick="This table" here />
          </div>
          {h.also.length > 0 && (
            <p className="sec-p small">The same key is also listed for {h.also.map((x, i) => (
              <span key={x}>{i > 0 && ', '}<Link to={tablePath(m.tables[x].name)} className="mono link">{m.tables[x].name}</Link></span>
            ))}.</p>
          )}
        </>
      )}
      {lines.length > 0 && (
        <>
          <p className="sec-p">
            {lines.length === 1 ? 'Its lines live in one table' : `Its lines live in ${fmt(lines.length)} tables`}. Oracle’s Entity Key List gives one key
            to <span className="mono">id</span> here and to the link column in the lines.
          </p>
          {lines.map((lt) => {
            const lh = linkCol(lt);
            if (!lh) return null;
            return (
              <div key={lt} className="hp-row" role="group" aria-label={`${m.tables[t].name} id joins ${m.tables[lt].name} ${lh.col.toLowerCase()}, one to many`}>
                <Box m={m} cm={cm} t={t} kick="This table" here />
                <Join col={lh.col} keyName={lh.key} />
                <Box m={m} cm={cm} t={lt} kick="Lines" />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
