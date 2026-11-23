// Oracle's 26R4 data model diagrams, as lists.
//   ModelSection   a fact's star (ModelStar) and, beneath it, the same tables ranked by reach; hover links the two.
//   ModelList      the ranked list: "In most subject areas", "In fewer subject areas", "Fact tables".
//   ModelFactsOf   for any table some diagram draws: the facts whose diagram draws it, grouped by diagram area.
import { useMemo, useState } from 'react';
import { Link } from '../../router';
import { matrixPath, tablePath } from '../../routes';
import { carryArea } from '../area/carry';
import {
  fmt, grainOf, grainSentence, keyOrder, modelArea, modelFactsOf, modelRelations, plural, prettyTable,
  type CoreModel, type ModelRelation, type TableSummary,
} from '../../../explorer/data';
import { ModelStar, type StarFact, type StarHeader } from './ModelStar';

const SRC_DM = 'stated in Oracle’s 26R4 data model';

function Bar({ v, of }: { v: number; of: number }) {
  return <span className="tn-bar ml-bar" aria-hidden="true"><i style={{ width: `${of ? (v / of) * 100 : 0}%` }} /></span>;
}

interface ListProps { rels: ModelRelation[]; total: number; hot: number | null; setHot: (t: number | null) => void; header?: StarHeader }

export function ModelList({ rels, total, hot, setHot, header }: ListProps) {
  const half = total / 2;
  const groups: [string, ModelRelation[]][] = ([
    ['In most subject areas', rels.filter((r) => !r.isFact && r.reach >= half)],
    ['In fewer subject areas', rels.filter((r) => !r.isFact && r.reach < half)],
    ['Fact tables', rels.filter((r) => r.isFact)],
  ] as [string, ModelRelation[]][]).filter(([, rs]) => rs.length > 0);
  // two columns: the first group, then the rest stacked
  const cols = groups.length > 1 && rels.length > 14 ? [groups.slice(0, 1), groups.slice(1)] : [groups];
  return (
    <div className={cols.length > 1 ? 'ml two' : 'ml'}>
      {header && (
        // phones only: the star (hidden there) draws the header partner
        <div className="ml-g ml-hdr">
          <div className="ml-gk"><span>Header partner</span><span className="num">1</span></div>
          <ul>
            <li className="ml-li">
              <Link to={carryArea(tablePath(header.name))} className="ml-row f">
                <span className="ml-nm">{header.display}</span>
                <span className="ml-key mono">id = {header.col}</span>
                <span className="ml-mono mono">one to many</span>
              </Link>
            </li>
          </ul>
          <p className="ml-hsrc">Stated in Oracle’s Entity Key List.</p>
        </div>
      )}
      {cols.map((col, ci) => (
        <div key={ci} className="ml-col">
          {col.map(([title, rs]) => (
            <div key={title} className="ml-g">
              <div className="ml-gk"><span>{title}</span><span className="num">{rs.length}</span></div>
              <ul>
                {rs.map((r) => (
                  <li key={r.table} className={hot === r.table ? 'ml-li on' : 'ml-li'} onMouseEnter={() => setHot(r.table)} onMouseLeave={() => setHot(null)}>
                    <Link to={carryArea(tablePath(r.name))} className={r.reach > 0 ? 'ml-row' : 'ml-row f'} onFocus={() => setHot(r.table)} onBlur={() => setHot(null)}
                      aria-label={`${r.display}, ${r.reach > 0 ? `${r.reach} of ${total} subject areas` : 'fact table'}, ${SRC_DM}`}>
                      <span className="ml-nm">{r.display}</span>
                      <span className="ml-src" aria-hidden="true">{SRC_DM}</span>
                      {r.reach > 0
                        ? <><Bar v={r.reach} of={total} /><span className="ml-n num">{r.reach} of {total}</span></>
                        : <span className="ml-mono mono">{r.name}</span>}
                    </Link>
                    {!r.isFact && <Link to={matrixPath({ dim: r.name })} className="tn-mx ml-mx" aria-label={`${r.display} in the bus matrix`}>matrix</Link>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A fact's data-model section: lede, legend, star, caption, ranked list. Renders nothing without a diagram. */
export function ModelSection({ m, s }: { m: CoreModel; s: TableSummary }) {
  const t = s.t;
  const rels = useMemo(() => modelRelations(m, t), [m, t]);
  const total = m.subjectAreas.length;
  const fact: StarFact = useMemo(() => ({ name: s.name, grain: s.grainSentence, keys: s.grain[0] ? keyOrder(s.grain[0].cols) : [] }), [s]);
  const header: StarHeader | undefined = useMemo(() => {
    const h = m.grain.header.get(t);
    if (!h) return undefined;
    const name = m.tables[h.table].name;
    return { table: h.table, name, display: prettyTable(m, name), col: h.col.toLowerCase(), reach: m.tables[h.table].saCount };
  }, [m, t]);
  const [hot, setHot] = useState<number | null>(null);
  if (!rels.length) return null;
  const area = modelArea(m, t);
  return (
    <section className="tp-band ms-band" aria-labelledby="ms-h">
      <div className="ms-wide">
        <div className="sec-h ms-h">
          <div>
            <h2 id="ms-h">In Oracle’s data model</h2>
            <p className="sec-p">
              Oracle’s 26R4 data model diagram for this table{area ? <>, in <i>{area}</i>,</> : ''} relates it to {plural(rels.length, 'table')}.
              {header && <> Oracle’s Entity Key List gives its header partner and the key between them.</>}
            </p>
          </div>
          <div className="ms-legend" aria-hidden="true">
            <span><i className="ms-lg-line" />stated in the data model</span>
            {header && <span><i className="ms-lg-line key" />stated in the key list</span>}
            <span><i className="ms-lg-bar"><b /></i>subject areas listing it, of {total}</span>
          </div>
        </div>
        <ModelStar m={m} fact={fact} header={header} rels={rels} total={total} hot={hot} setHot={setHot} />
        <p className="ms-cap">Oracle’s data model diagram for this table states these relationships.</p>
        <ModelList rels={rels} total={total} hot={hot} setHot={setHot} header={header} />
      </div>
    </section>
  );
}

const CAP = 6;

/** Facts whose data-model diagram draws this table, grouped by the diagram's area, widest reach first. */
export function ModelFactsOf({ m, t }: { m: CoreModel; t: number }) {
  const facts = useMemo(() => modelFactsOf(m, t), [m, t]);
  const groups = useMemo(() => {
    const by = new Map<string, ModelRelation[]>();
    for (const f of facts) { const a = modelArea(m, f.table) || 'Other diagrams'; (by.get(a) ?? by.set(a, []).get(a)!).push(f); }
    return [...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [m, facts]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (!facts.length) return null;
  const total = m.subjectAreas.length;
  return (
    <section className="tp-band ms-band" aria-labelledby="mf-h">
      <div className="ms-wide">
        <div className="sec-h"><h2 id="mf-h">Facts that relate to it in Oracle’s data model</h2><span className="faint num">{fmt(facts.length)}</span></div>
        <p className="sec-p">
          Oracle’s 26R4 data model diagrams draw this table in the star of {plural(facts.length, 'fact table')}, across {plural(groups.length, 'diagram area')}.
          Within each area the facts listed in the most subject areas come first.
        </p>
        <div className="mf">
          {groups.map(([area, fs]) => {
            const all = open.has(area);
            const shown = all ? fs : fs.slice(0, CAP);
            return (
              <div key={area} className="ml-g mf-g">
                <div className="ml-gk"><span>{area}</span><span className="num">{fs.length}</span></div>
                <ul>
                  {shown.map((f) => {
                    const g = grainOf(m, f.table).length ? grainSentence(m, f.table) : null;
                    return (
                      <li key={f.table} className="mf-li">
                        <Link to={carryArea(tablePath(f.name))} className="mf-row">
                          <span className="mf-nm mono">{f.name}</span>
                          {f.reach > 0 && <span className="mf-n num faint">{f.reach} of {total}</span>}
                          {g && <span className="mf-grain">{g}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {fs.length > CAP && (
                  <button type="button" className="more mf-more" onClick={() => { const n = new Set(open); if (all) n.delete(area); else n.add(area); setOpen(n); }}>
                    {all ? 'Show fewer' : `Show all ${fmt(fs.length)}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
