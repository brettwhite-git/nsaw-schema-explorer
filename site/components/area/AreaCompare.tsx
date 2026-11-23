// "Compare with…": the subject areas whose bus-matrix rows share the most dimensions with this one, plus a
// select to compare with any area. Each choice opens /compare/:a/:b.
import { Link, navigate } from '../../router';
import { comparePath } from '../../routes';
import { compare, rowOf } from '../../../explorer/data/matrix';
import { fmt } from '../../../explorer/data/names';
import type { CoreModel } from '../../../explorer/data/types';

export interface Similar { sa: number; shared: number; apart: number }

/** Other areas with a matrix row, most shared dimensions first, then fewest listed on one side only. */
export function similarAreas(m: CoreModel, sa: number, n = 5): Similar[] {
  const out: Similar[] = [];
  for (const o of m.bus.rows) {
    if (o === sa) continue;
    const c = compare(m, sa, o);
    if (c.both.length) out.push({ sa: o, shared: c.both.length, apart: c.onlyA.length + c.onlyB.length });
  }
  return out.sort((x, y) => y.shared - x.shared || x.apart - y.apart || m.subjectAreas[x.sa].label.localeCompare(m.subjectAreas[y.sa].label)).slice(0, n);
}

export function AreaCompare({ m, sa }: { m: CoreModel; sa: number }) {
  const me = m.subjectAreas[sa];
  const near = similarAreas(m, sa);
  const pick = (slug: string) => { if (slug) navigate(comparePath(me.slug, slug)); };
  return (
    <div className="ar-compare">
      {near.length > 0 && (
        <>
          <p className="note">Closest by shared dimensions</p>
          <ul className="rows ar-near">
            {near.map((s) => (
              <li key={s.sa}>
                <Link to={comparePath(me.slug, m.subjectAreas[s.sa].slug)} className="ar-nname">{m.subjectAreas[s.sa].label}</Link>
                <span className="ar-ncount num" title={`${fmt(s.shared)} dimensions listed under both, ${fmt(s.apart)} under one of the two`}>
                  {fmt(s.shared)} <span className="faint">shared</span>{s.apart > 0 && <> · {fmt(s.apart)} <span className="faint">apart</span></>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="ar-pick">
        <span className="note">Or pick any area</span>
        <select value="" onChange={(e) => pick(e.currentTarget.value)}>
          <option value="">Choose a subject area…</option>
          {m.functionalAreas.map((fa) => {
            const opts = fa.subjectAreas.filter((x) => x !== sa && rowOf(m, x) >= 0);
            return opts.length ? (
              <optgroup key={fa.i} label={fa.name}>
                {opts.map((x) => <option key={x} value={m.subjectAreas[x].slug}>{m.subjectAreas[x].label}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
    </div>
  );
}
