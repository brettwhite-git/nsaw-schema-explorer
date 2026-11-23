// Side column of the impact trace: report column names (nothing selected), or the selected warehouse column /
// subject area with a link to its own page.
import { plural, type ColumnModel, type CoreModel, type Trace } from '../../../explorer/data';
import { Link } from '../../router';
import { areaPath, tablePath } from '../../routes';
import { areaReportColumns, namesOf, type NameRow, type Selection } from './select';

interface Props { core: CoreModel; cm: ColumnModel; trace: Trace; sel: Selection }

function Names({ rows, limit }: { rows: NameRow[]; limit: number }) {
  return (
    <ul className="d-list">
      {rows.slice(0, limit).map((r) => <li key={r.name} className="d-sa row"><span>{r.name}</span><small>{r.areas}</small></li>)}
      {rows.length > limit && <li className="d-sa faint"><span>and {plural(rows.length - limit, 'more name')}</span></li>}
    </ul>
  );
}

export function TraceDrawer({ core, cm, trace, sel }: Props) {
  if (sel.at !== undefined) {
    const t = cm.pcTable[sel.at];
    const table = t >= 0 ? core.tables[t].name : '';
    const col = cm.pcName[sel.at];
    const pres = cm.physPres[sel.at];
    return (
      <>
        <h3>Selected column</h3>
        <div className="d-name">{table}{table && <br />}<span className="faint">{table ? '.' : ''}{col}</span></div>
        {pres.length > 0 && (
          <>
            <p className="d-sum">{plural(pres.length, 'report column')} in {plural(cm.colSas[sel.at].length, 'subject area')}. Names, with the number of subject areas using each:</p>
            <Names rows={namesOf(cm, pres)} limit={16} />
          </>
        )}
        {table && <Link className="linkbtn d-go" to={tablePath(table, { col })}>Open <span className="mono">{table}</span> →</Link>}
      </>
    );
  }
  if (sel.sa !== undefined) {
    const area = trace.functionalAreas.flatMap((g) => g.areas).find((a) => a.sa === sel.sa)!;
    const rows = areaReportColumns(cm, sel.sa, area.columns);
    return (
      <>
        <h3>Selected subject area</h3>
        <div className="d-name serif">{area.label}</div>
        <p className="d-sum">{plural(rows.length, 'report column')} read {plural(area.columns.length, 'warehouse column')} fed by this field.</p>
        <ul className="d-list">
          {rows.slice(0, 18).map((r, i) => <li key={i} className="d-sa"><span>{r.name}</span><small>{r.table}</small></li>)}
          {rows.length > 18 && <li className="d-sa faint"><span>and {plural(rows.length - 18, 'more report column')}</span></li>}
        </ul>
        <Link className="linkbtn d-go" to={areaPath(core.subjectAreas[sel.sa].slug)}>Open {area.label} →</Link>
      </>
    );
  }
  const rows = trace.reportNames.map((r) => ({ name: r.name, areas: r.areas }));
  if (!rows.length) return null;
  return (
    <>
      <h3>Report columns, by name</h3>
      <p className="d-sum">{plural(trace.totals.reportColumns, 'report column')} under {plural(rows.length, 'distinct name')}. The number is how many subject areas use each name.</p>
      <Names rows={rows} limit={22} />
      <p className="d-sum faint tr-hint">Pick a warehouse column or a subject area to light its path.</p>
    </>
  );
}
