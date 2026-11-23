// Detail lists for the inspector (children of <Inspector>), shared by the table and field pages:
//   <ColumnDetails m cm c area? />     report names reading one warehouse column, and the subject areas that read it
//   <NameList rows limit title />      report column names with the number of subject areas using each
//   <AreaColumnsDetails rows limit />  report columns in one subject area (name, report folder)
import { Link } from '../../router';
import { areaPath } from '../../routes';
import { plural, type ColumnModel, type CoreModel } from '../../../explorer/data';
import { InspectorSection } from '../Inspector';

export interface NameRow { name: string; areas: number }

export function NameList({ rows, limit, title }: { rows: NameRow[]; limit: number; title: string }) {
  if (!rows.length) return null;
  return (
    <InspectorSection title={title} count="areas">
      <ul className="ins-rows">
        {rows.slice(0, limit).map((r) => <li key={r.name}><span>{r.name}</span><small>{r.areas}</small></li>)}
      </ul>
      {rows.length > limit && <p className="ins-more">and {plural(rows.length - limit, 'more name')}</p>}
    </InspectorSection>
  );
}

export function AreaColumnsDetails({ rows, limit, title }: { rows: { name: string; table: string }[]; limit: number; title: string }) {
  if (!rows.length) return null;
  return (
    <InspectorSection title={title} count={rows.length}>
      <ul className="ins-rows">
        {rows.slice(0, limit).map((r, i) => <li key={i} className="stack"><span>{r.name}</span><small>{r.table}</small></li>)}
      </ul>
      {rows.length > limit && <p className="ins-more">and {plural(rows.length - limit, 'more report column')}</p>}
    </InspectorSection>
  );
}

/** Report names reading one warehouse column, then the subject areas that read it (each with its names). */
export function ColumnDetails({ m, cm, c }: { m: CoreModel; cm: ColumnModel; c: number }) {
  const byName = new Map<string, Set<number>>();
  const byArea = new Map<number, Set<string>>();
  for (const p of cm.physPres[c]) {
    (byName.get(cm.prcName[p]) ?? byName.set(cm.prcName[p], new Set()).get(cm.prcName[p])!).add(cm.prcSa[p]);
    (byArea.get(cm.prcSa[p]) ?? byArea.set(cm.prcSa[p], new Set()).get(cm.prcSa[p])!).add(cm.prcName[p]);
  }
  const names = [...byName].map(([name, s]) => ({ name, areas: s.size })).sort((a, b) => b.areas - a.areas || a.name.localeCompare(b.name));
  const areas = [...byArea].sort((a, b) => m.subjectAreas[a[0]].label.localeCompare(m.subjectAreas[b[0]].label));
  const many = names.length > 1;
  return (
    <>
      {many && <NameList rows={names} limit={16} title="Report columns, by name" />}
      {areas.length > 0 && (
        <InspectorSection title="Subject areas that read it" count={areas.length}>
          <ul className="ins-rows">
            {areas.map(([sa, ns]) => (
              <li key={sa} className={many ? 'stack' : undefined}>
                <Link to={areaPath(m.subjectAreas[sa].slug)}>{m.subjectAreas[sa].label}</Link>
                {many && <small>{[...ns].join(' · ')}</small>}
              </li>
            ))}
          </ul>
        </InspectorSection>
      )}
    </>
  );
}
