// The fact tables the bus matrix lists for one subject area. A table and its _SEC namesake sit in one entry
// (a visual grouping only). Entries with a grain stated in the key list come first.
import { Link } from '../../router';
import { tablePath } from '../../routes';
import { prettyTable, unsecuredName, type AreaFact, type CoreModel } from '../../../explorer/data';

interface Group { key: string; members: AreaFact[]; lead: AreaFact }

export function groupFacts(facts: AreaFact[]): Group[] {
  const by = new Map<string, AreaFact[]>();
  for (const f of facts) {
    const k = unsecuredName(f.name);
    const g = by.get(k);
    if (g) g.push(f); else by.set(k, [f]);
  }
  const groups = [...by].map(([key, members]): Group => {
    members.sort((a, b) => Number(a.name !== key) - Number(b.name !== key) || a.name.localeCompare(b.name));
    return { key, members, lead: members.find((f) => f.grain) ?? members[0] };
  });
  return groups.sort((a, b) => Number(!a.lead.grain) - Number(!b.lead.grain) || a.key.localeCompare(b.key));
}

export function AreaFacts({ m, facts, area }: { m: CoreModel; facts: AreaFact[]; area?: string }) {
  const groups = groupFacts(facts);
  return (
    <ol className="ar-facts">
      {groups.map((g) => (
        <li key={g.key} className="ar-fact">
          <p className={g.lead.grain ? 'ar-grain' : 'ar-grain ar-plain'}>{g.lead.grain ?? prettyTable(m, g.key)}</p>
          {g.lead.key.length > 0 && (
            <p className="ar-key">
              <span className="tag">key</span>{' '}
              {g.lead.key.map((k, i) => (
                <span key={k}>{i > 0 && <span className="faint"> + </span>}<span className="ktag">{k}</span></span>
              ))}
            </p>
          )}
          <ul className="ar-names">
            {g.members.map((f) => (
              <li key={f.table}>
                <Link to={tablePath(f.name, area)} className="ar-tname mono">{f.name}</Link>
                {f.secured && <span className="badge">secured</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
