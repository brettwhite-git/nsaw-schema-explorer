// The breadcrumb under the header on every page: where you are and the way back, nothing ahead.
//   Matrix › Sales Order › Sales Order Lines › transactions.tranid
// Only the segments the current page has. Earlier segments are links; the last one is plain text. It reads the
// route and two context parameters only, never a selection inside the page, so hovering or picking things on a
// page leaves it as it is:
//   ?area=<slug>   the subject area the reader came through (table and field pages); omitted when absent
//   ?from=<TABLE>  the table a field page was opened from (the ledger's field links carry it)
// On a subject-area page a quiet line on the right steps to the neighbouring subject areas in its functional area.
import { Link, useLocation } from '../router';
import { areaPath, matchRoute, matrixPath, parseQuery, tablePath } from '../routes';
import { useExplorer } from '../useExplorer';
import { areaNeighbours, findField, findTable, prettyTable, unslug, type ColumnModel, type CoreModel } from '../../explorer/data';

export interface Crumb { label: string; to?: string; mono?: boolean }

/** The crumbs for a location (pure apart from the models). The last crumb is the current page and has no link. */
export function crumbsFor(m: CoreModel, cm: ColumnModel | null, loc: string): Crumb[] {
  const route = matchRoute(loc);
  const q = parseQuery(loc);
  const out: Crumb[] = [{ label: 'Matrix', to: matrixPath() }];
  const areaCrumb = (slug: string | undefined): string | null => {
    const sa = slug ? unslug(m, slug) : undefined;
    if (sa === undefined) return null;
    out.push({ label: m.subjectAreas[sa].label, to: areaPath(m.subjectAreas[sa].slug) });
    return m.subjectAreas[sa].label;
  };
  const tableCrumb = (name: string, areaLabel: string | null, slug: string | null) => {
    const t = findTable(m, name);
    if (t === undefined) return false;
    const n = m.tables[t].name;
    const pretty = prettyTable(m, n);
    const mono = !pretty || pretty.toLowerCase() === areaLabel?.toLowerCase();
    out.push({ label: mono ? n : pretty, to: tablePath(n, slug), mono });
    return true;
  };
  switch (route.name) {
    case 'area': {
      const sa = unslug(m, route.slug);
      if (sa !== undefined) out.push({ label: m.subjectAreas[sa].label });
      break;
    }
    case 'compare': {
      const a = unslug(m, route.a), b = unslug(m, route.b);
      if (a !== undefined && b !== undefined) out.push({ label: `${m.subjectAreas[a].label} and ${m.subjectAreas[b].label}` });
      break;
    }
    case 'table': {
      const al = areaCrumb(q.area);
      if (!tableCrumb(route.table, al, q.area && al ? q.area : null)) out.push({ label: route.table, mono: true });
      break;
    }
    case 'field': {
      const al = areaCrumb(q.area);
      if (q.from) tableCrumb(q.from, al, q.area && al ? q.area : null);
      const f = cm ? findField(cm, `${route.record}.${route.field}`) : undefined;
      out.push({ label: cm && f !== undefined ? `${cm.core.recordKey[cm.nfRecord[f]]}.${cm.nfName[f].toLowerCase()}` : `${route.record}.${route.field}`, mono: true });
      break;
    }
    case 'search':
      out.push({ label: 'Search' });
      break;
    default:
      break;
  }
  const last = out[out.length - 1];
  delete last.to;
  return out;
}

export function Breadcrumb() {
  const loc = useLocation();
  const { core: m, columns: cm } = useExplorer();
  if (!m) return <nav className="lv" aria-label="Breadcrumb"><div className="lv-in" /></nav>;
  const route = matchRoute(loc);
  const crumbs = crumbsFor(m, cm, loc);
  const sa = route.name === 'area' ? unslug(m, route.slug) : undefined;
  const nb = sa !== undefined ? areaNeighbours(m, sa) : { prev: null, next: null };
  const fa = sa !== undefined && m.subjectAreas[sa].fa >= 0 ? m.functionalAreas[m.subjectAreas[sa].fa].name : '';
  const view = route.name === 'area' ? parseQuery(loc).view : undefined;
  return (
    <nav className="lv" aria-label="Breadcrumb">
      <div className="lv-in">
        <ol className="lv-crumbs">
          {crumbs.map((c, i) => (
            <li key={i}>
              {c.to
                ? <Link to={c.to} className={c.mono ? 'lv-c mono' : 'lv-c'}>{c.label}</Link>
                : <span className={c.mono ? 'lv-c here mono' : 'lv-c here'} aria-current="page">{c.label}</span>}
            </li>
          ))}
        </ol>
        {(nb.prev !== null || nb.next !== null) && (
          <p className="lv-ctx">
            <span className="lv-ctx-k">Neighbouring subject areas{fa ? ` in ${fa}` : ''}</span>
            {nb.prev !== null && <Link to={areaPath(m.subjectAreas[nb.prev].slug, { view })} rel="prev" aria-label={`Previous subject area: ${m.subjectAreas[nb.prev].label}`}>‹ {m.subjectAreas[nb.prev].label}</Link>}
            {nb.next !== null && <Link to={areaPath(m.subjectAreas[nb.next].slug, { view })} rel="next" aria-label={`Next subject area: ${m.subjectAreas[nb.next].label}`}>{m.subjectAreas[nb.next].label} ›</Link>}
          </p>
        )}
      </div>
    </nav>
  );
}
