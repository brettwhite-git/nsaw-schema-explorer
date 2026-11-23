// What sits around a table in the bus matrix and the semantic model.
//   Facts:  dimension tables in the same subject areas (ranked, with the report folders reading each there).
//   Others: reach by functional area, report folders that read from the table, facts in the same subject areas.
//   All:    subject areas, grouped by functional area.
import { useMemo, useState } from 'react';
import { Link } from '../../router';
import { areaPath, matrixPath, tablePath } from '../../routes';
import { reportFoldersReading, shortTable, fmt, plural, type ColumnModel, type CoreModel, type FolderCount, type TableSummary } from '../../../explorer/data';

const TOP = 16;

function Folders({ fs, max = 3 }: { fs: FolderCount[]; max?: number }) {
  if (!fs.length) return null;
  const shown = fs.slice(0, max).map((f) => f.name).join(' · ');
  return <>{shown}{fs.length > max && <small> +{fs.length - max}</small>}</>;
}

function Bar({ v, of }: { v: number; of: number }) {
  return <span className="tn-bar" aria-hidden="true"><i style={{ width: `${of ? (v / of) * 100 : 0}%` }} /></span>;
}

/** Facts: dimension tables the bus matrix lists in this fact's subject areas. */
export function DimensionsWithFact({ m, cm, s }: { m: CoreModel; cm: ColumnModel; s: TableSummary }) {
  const [all, setAll] = useState(false);
  const f = s.fact!;
  const n = f.areas.length;
  const dims = useMemo(() => f.dimensions.map((d) => ({ ...d, folders: reportFoldersReading(m, cm, d.table, f.areas) })), [m, cm, f]);
  if (!dims.length) return null;
  const shown = all ? dims : dims.slice(0, TOP);
  return (
    <div className="tn-panel tn-dims">
      <div className="sec-h"><h2>Listed with it in subject areas</h2><span className="faint num">{fmt(dims.length)}</span></div>
      <p className="sec-p">
        From the bus matrix: the dimension tables listed under the {plural(n, 'subject area')} where this table is a fact table, ranked by
        how many of those areas list them. Next to each are the report folders that read from it there.
      </p>
      <table className="tbl tn-tbl">
        <thead>
          <tr><th className="n" scope="col"><span className="visually-hidden">Rank</span></th><th scope="col">Dimension table</th><th scope="col" className="tn-fold">Report folders that read from it</th><th scope="col">Subject areas</th><th scope="col"><span className="visually-hidden">Bus matrix</span></th></tr>
        </thead>
        <tbody>
          {shown.map((d, i) => {
            const name = m.tables[d.table].name;
            return (
              <tr key={d.col}>
                <td className="n faint">{i + 1}</td>
                <td><Link to={tablePath(name)} className="mono link" title={name}>{shortTable(name)}</Link></td>
                <td className="tn-fold" title={d.folders.map((x) => x.name).join(' · ')}><Folders fs={d.folders} /></td>
                <td className="tn-cnt"><Bar v={d.areas} of={n} /><span className="num">{d.areas} of {n}</span></td>
                <td><Link to={matrixPath({ dim: name })} className="tn-mx" aria-label={`${shortTable(name)} in the bus matrix`}>matrix</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {dims.length > TOP && <button type="button" className="btn tn-more" onClick={() => setAll(!all)}>{all ? `Show the top ${TOP}` : `Show all ${fmt(dims.length)}`}</button>}
    </div>
  );
}

/** Dimensions (and other non-fact tables): reach, folders, facts. */
export function DimensionContext({ m, cm, s }: { m: CoreModel; cm: ColumnModel; s: TableSummary }) {
  const [all, setAll] = useState(false);
  const { reach, readIn, folders, facts } = useMemo(() => {
    const d = s.dimension;
    const readSas = cm.tableSas[s.t];
    const reachRows = d
      ? d.byArea.filter((x) => x.has > 0).map((x) => ({ name: x.name, has: x.has, total: x.total }))
      : m.functionalAreas.map((fa) => ({ name: fa.name, has: fa.subjectAreas.filter((sa) => readSas.includes(sa)).length, total: fa.subjectAreas.length })).filter((x) => x.has > 0);
    let factRows = d?.facts ?? [];
    if (!d) {
      const cnt = new Map<number, number>();
      for (const sa of readSas) for (const t of m.factsOfSa[sa]) cnt.set(t, (cnt.get(t) ?? 0) + 1);
      factRows = [...cnt].map(([table, areas]) => ({ table, areas })).sort((a, b) => b.areas - a.areas || m.tables[a.table].name.localeCompare(m.tables[b.table].name));
    }
    return { reach: reachRows, readIn: !d, folders: d?.folders.length ? d.folders : reportFoldersReading(m, cm, s.t), facts: factRows };
  }, [m, cm, s]);
  const nAreas = s.dimension ? s.dimension.reach : cm.tableSas[s.t].length;
  const shownFacts = all ? facts : facts.slice(0, TOP);
  if (!reach.length && !folders.length && !facts.length) return null;
  return (
    <div className="tn-ctx">
      {reach.length > 0 && (
        <div className="tn-panel">
          <div className="sec-h"><h2>Reach by functional area</h2>
            {s.dimension && <Link to={matrixPath({ dim: s.name })} className="linkbtn tn-mxlink">Open in the bus matrix</Link>}
          </div>
          <p className="sec-p">
            {readIn
              ? `Subject areas whose report columns read this table, out of the subject areas in each functional area.`
              : `Subject areas that list this table in the bus matrix, out of the subject areas with a matrix row in each functional area.`}
          </p>
          <ul className="tn-reach">
            {reach.map((x) => (
              <li key={x.name}><span>{x.name}</span><Bar v={x.has} of={x.total} /><span className="num faint">{x.has} of {x.total}</span></li>
            ))}
          </ul>
        </div>
      )}
      {folders.length > 0 && (
        <div className="tn-panel">
          <div className="sec-h"><h2>Report folders that read from this table</h2><span className="faint num">{fmt(folders.length)}</span></div>
          <p className="sec-p">Folders in the semantic model with a column that maps to one of its columns, most subject areas first.</p>
          <ul className="tn-folders">
            {folders.slice(0, 24).map((f) => (
              <li key={f.name}><span className="tn-fname">{f.name}</span><span className="num faint">{plural(f.areas, 'area')} · {plural(f.columns, 'column')}</span></li>
            ))}
          </ul>
          {folders.length > 24 && <p className="note">and {fmt(folders.length - 24)} more folders.</p>}
        </div>
      )}
      {facts.length > 0 && (
        <div className="tn-panel tn-facts">
          <div className="sec-h"><h2>Fact tables in the same subject areas</h2><span className="faint num">{fmt(facts.length)}</span></div>
          <p className="sec-p">
            Fact tables the bus matrix lists under the {plural(nAreas, 'subject area')} that {readIn ? 'read' : 'list'} this table, ranked by how many of those areas they share.
          </p>
          <table className="tbl tn-tbl">
            <thead><tr><th className="n" scope="col"><span className="visually-hidden">Rank</span></th><th scope="col">Fact table</th><th scope="col">Subject areas</th></tr></thead>
            <tbody>
              {shownFacts.map((f, i) => {
                const name = m.tables[f.table].name;
                return (
                  <tr key={f.table}>
                    <td className="n faint">{i + 1}</td>
                    <td><Link to={tablePath(name)} className="mono link">{shortTable(name)}</Link></td>
                    <td className="tn-cnt"><Bar v={f.areas} of={nAreas} /><span className="num">{f.areas} of {nAreas}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {facts.length > TOP && <button type="button" className="btn tn-more" onClick={() => setAll(!all)}>{all ? `Show the top ${TOP}` : `Show all ${fmt(facts.length)}`}</button>}
        </div>
      )}
    </div>
  );
}

/** Subject areas that read the table (column level), grouped by functional area, each with its report-column count. */
export function SubjectAreas({ m, cm, s }: { m: CoreModel; cm: ColumnModel; s: TableSummary }) {
  const groups = s.readBy?.length ? s.readBy : s.listedIn;
  const viaRead = !!s.readBy?.length;
  const perSa = useMemo(() => {
    const n = new Map<number, number>();
    for (const c of cm.tableCols[s.t]) for (const p of cm.physPres[c]) n.set(cm.prcSa[p], (n.get(cm.prcSa[p]) ?? 0) + 1);
    return n;
  }, [cm, s.t]);
  const total = groups.reduce((a, g) => a + g.areas.length, 0);
  const [all, setAll] = useState(false);
  if (!total) return null;
  const cap = all || total <= 30 ? Infinity : 6;
  return (
    <div className="tn-panel tn-areas">
      <div className="sec-h"><h2>Subject areas</h2><span className="faint num">{fmt(total)}</span></div>
      <p className="sec-p">{viaRead ? 'Subject areas whose report columns read this table, grouped by functional area.' : 'Subject areas that list this table in the bus matrix, grouped by functional area.'}</p>
      {groups.map((g) => (
        <div key={g.fa} className="tn-g">
          <div className="tn-gk"><span>{g.name || 'Other'}</span><span className="num">{g.areas.length}</span></div>
          <ul>
            {g.areas.slice(0, cap).map((sa) => (
              <li key={sa}>
                <Link to={areaPath(m.subjectAreas[sa].slug)} className="link">{m.subjectAreas[sa].label}</Link>
                {perSa.get(sa) ? <span className="faint num">{plural(perSa.get(sa)!, 'report column')}</span> : null}
              </li>
            ))}
          </ul>
          {g.areas.length > cap && <p className="note tn-gmore">and {fmt(g.areas.length - cap)} more</p>}
        </div>
      ))}
      {cap !== Infinity || all ? (total > 30 && <button type="button" className="btn tn-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${fmt(total)}`}</button>) : null}
    </div>
  );
}
