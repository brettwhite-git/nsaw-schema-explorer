// The three-column impact trace: NetSuite field -> warehouse columns (by role) -> subject areas (by functional area),
// with a comb from the field to its columns and a fan bundled per functional area into the subject areas.
// On phones (<760px) the gutters are hidden by CSS and the columns stack as lists.
import { useMemo, useRef } from 'react';
import { plural, type ColumnModel, type CoreModel, type Trace } from '../../../explorer/data';
import { setQuery } from '../../router';
import { Wires } from '../Wires';
import { FanWires } from './FanWires';
import { ROLE_HEAD, atValue, fanBundles, namesOf, type Selection } from './select';

interface Props { core: CoreModel; cm: ColumnModel; trace: Trace; sel: Selection }

const cellCls = (hot: boolean, any: boolean) => `cell${hot ? ' hot' : any ? ' cool' : ''}`;

export function TraceLedger({ core, cm, trace, sel }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const { pairs, groups } = useMemo(() => fanBundles(trace), [trace]);
  const cols = useMemo(() => trace.groups.flatMap((g) => g.columns), [trace]);
  const comb = useMemo(
    () => cols.map((c) => ({ a: 'src', b: `c${c.col}`, selected: sel.hotCols.has(c.col), cool: sel.any })),
    [cols, sel],
  );
  const single = cols.length === 1 ? cols[0] : null;
  const singleNames = useMemo(() => (single ? namesOf(cm, cm.physPres[single.col]) : []), [cm, single]);
  const { totals } = trace;

  const pickCol = (col: number, v: string) => setQuery({ at: sel.at === col ? null : v, sa: null }, { replace: true });
  const pickSa = (sa: number) => setQuery({ sa: sel.sa === sa ? null : core.subjectAreas[sa].slug, at: null }, { replace: true });

  return (
    <div className="ledger trace-ledger" ref={scope}>
      <div className="lhead" aria-hidden="true">
        <div>NetSuite field</div>
        <div />
        <div>Warehouse columns <span className="cnt">{totals.warehouseColumns}</span><span className="r">report cols</span></div>
        <div />
        <div>Subject areas <span className="cnt">{totals.subjectAreas}</span><span className="r">report cols</span></div>
      </div>
      <div className="lbody">
        <div className="lcol tr-src">
          <h2 className="tr-colh">NetSuite field</h2>
          <div className="srcnode" data-wire="src">
            <div className="mono">{trace.label}</div>
            <p>NetSuite record <span className="mono">{trace.record}</span></p>
            <p>{plural(totals.warehouseColumns, 'stated link')}</p>
          </div>
        </div>

        <Wires scope={scope} source="src" wires={comb} className="tr-gut" />

        <div className={`lcol tr-mid${single ? ' one' : ''}`}>
          <h2 className="tr-colh">Warehouse columns <span className="cnt">{totals.warehouseColumns}</span></h2>
          {trace.groups.map((g) => (
            <div key={g.role} className="tr-group">
              <div className="grp"><span>{ROLE_HEAD[g.role]}</span><span>{plural(g.columns.length, 'column')}</span></div>
              <ul>
                {g.columns.map((c) => {
                  const hot = sel.hotCols.has(c.col);
                  return (
                    <li key={c.col}>
                      <button type="button" className={cellCls(hot, sel.any)} data-wire={`c${c.col}`} aria-pressed={sel.at === c.col}
                        onClick={() => pickCol(c.col, atValue(c.tableName, c.column))}>
                        <span className="lab mono">{c.tableName}{c.tableName ? <span className="rec">.{c.column}</span> : c.column}</span>
                        <span className="n">{c.reportColumns || ''}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {single && singleNames.length > 0 && (
            <div className="tr-under">
              <p className="tr-under-h">Read in reports as</p>
              <ul>
                {singleNames.map((n) => (
                  <li key={n.name}><span>{n.name}</span><small>{plural(n.areas, 'area')}</small></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <FanWires scope={scope} pairs={pairs} groups={groups} hotCols={sel.hotCols} hotSas={sel.hotSas} at={sel.at} sa={sel.sa} />

        <div className="lcol tr-areas">
          <h2 className="tr-colh">Subject areas <span className="cnt">{totals.subjectAreas}</span></h2>
          {trace.functionalAreas.map((g) => (
            <div key={g.fa} className="tr-group">
              <div className="grp" data-wire={`fa${g.fa}`}><span>{g.name || 'Other'}</span><span>{plural(g.areas.length, 'area')}</span></div>
              <ul>
                {g.areas.map((a) => {
                  const hot = sel.hotSas.has(a.sa);
                  return (
                    <li key={a.sa}>
                      <button type="button" className={cellCls(hot, sel.any)} data-wire={`sa${a.sa}`} aria-pressed={sel.sa === a.sa}
                        onClick={() => pickSa(a.sa)}>
                        <span className="lab">{a.label}</span>
                        <span className="n">{a.reportColumns || ''}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
