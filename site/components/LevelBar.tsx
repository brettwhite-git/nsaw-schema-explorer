// The level bar under the header on every page: four levels, one direction.
//   1 Matrix (all subject areas) › 2 Subject area › 3 Table › 4 Field
// It reads the route and the query only, so any link reopens the same view:
//   - the area comes from /area/:slug, else ?area=, else the field page's ?sa=, else the matrix's ?a=;
//   - the table from /table/:name, the area page's ?sel=fact:|dim:, or the field page's ?at=TABLE.COL;
//   - the field from /field/:record/:field, or the table page's ?col= (its first stated NetSuite source).
// A level above the current one links back up (keeping the area); a level below shows what to pick next.
// With no area in the URL, a table or field page offers a compact "pick a subject area" menu of the areas that
// list it. ‹ previous / next › step to the neighbouring subject areas in the same functional area.
import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from '../router';
import { areaPath, comparePath, fieldPath, matchRoute, matrixPath, parseQuery, tablePath, withArea } from '../routes';
import { useExplorer } from '../useExplorer';
import {
  areaNeighbours, areasOfTable, findColumn, findField, findTable, unslug, type ColumnModel, type CoreModel,
} from '../../explorer/data';

type State = 'past' | 'here' | 'next' | 'later';
interface MenuItem { to: string; label: string; pre: string }
interface Step { level: string; pre?: string; value: ReactNode; to?: string; state: State; mono?: boolean; menu?: MenuItem[] }

const LEVELS = ['Matrix', 'Subject area', 'Table', 'Field'];

function areaMenu(m: CoreModel, areas: number[], loc: string): MenuItem[] {
  return areas.map((sa) => {
    const s = m.subjectAreas[sa];
    return { to: withArea(loc, s.slug), label: s.label, pre: s.fa >= 0 ? m.functionalAreas[s.fa].name : '' };
  });
}

/** The table named by the area page's ?sel= (fact:NAME or dim:NAME). */
const selTable = (m: CoreModel, sel: string | undefined): number | undefined =>
  sel && /^(fact|dim):/.test(sel) ? findTable(m, sel.slice(sel.indexOf(':') + 1)) : undefined;

/** The first stated NetSuite source of a table column, as [record, field] for fieldPath. */
function sourceOf(cm: ColumnModel | null, t: number, col: string | undefined): [string, string, string] | null {
  if (!cm || !col) return null;
  const c = findColumn(cm, t, col);
  const f = c === undefined ? undefined : cm.colSrc[c]?.[0];
  if (f === undefined) return null;
  const rec = cm.core.recordKey[cm.nfRecord[f]];
  return [rec, cm.nfName[f].toLowerCase(), `${rec}.${cm.nfName[f]}`];
}

function buildSteps(m: CoreModel, cm: ColumnModel | null, loc: string): { steps: Step[]; sa: number | undefined } {
  const route = matchRoute(loc);
  const q = parseQuery(loc);
  const slugQ = route.name === 'area' ? route.slug : q.area || (route.name === 'field' ? q.sa : undefined) || (route.name === 'matrix' ? q.a : undefined);
  const sa = slugQ ? unslug(m, slugQ) : route.name === 'compare' ? unslug(m, route.a) : undefined;
  const s = sa !== undefined ? m.subjectAreas[sa] : null;
  const slug = s?.slug ?? null;
  const up1 = matrixPath({ a: s && s.row >= 0 ? s.slug : null });

  const st: Step[] = [
    { level: LEVELS[0], value: 'All subject areas', to: up1, state: route.name === 'matrix' ? 'here' : 'past' },
    { level: LEVELS[1], value: 'pick a subject area', state: 'later' },
    { level: LEVELS[2], value: 'pick a fact', state: 'later' },
    { level: LEVELS[3], value: 'pick a column', state: 'later' },
  ];
  const areaStep = (state: State, to?: string): Step => ({
    level: LEVELS[1], pre: s!.fa >= 0 ? m.functionalAreas[s!.fa].name : undefined, value: s!.label, to: to ?? areaPath(s!.slug), state,
  });

  switch (route.name) {
    case 'matrix':
      if (s) st[1] = areaStep('next');
      break;
    case 'area': {
      if (!s) break;
      st[1] = areaStep('here', loc);
      const t = selTable(m, q.sel);
      if (t !== undefined) st[2] = { level: LEVELS[2], value: m.tables[t].name, to: tablePath(m.tables[t].name, slug), state: 'next', mono: true };
      break;
    }
    case 'compare': {
      const b = unslug(m, route.b);
      if (s && b !== undefined) st[1] = { level: LEVELS[1], pre: 'compare', value: `${s.label} · ${m.subjectAreas[b].label}`, to: comparePath(route.a, route.b), state: 'here' };
      break;
    }
    case 'table': {
      const t = findTable(m, route.table);
      if (t === undefined) break;
      const kind = m.tables[t].role === 'fact' || m.tables[t].role === 'enhanced' ? 'fact' : 'dim';
      if (s) st[1] = areaStep('past', areaPath(s.slug, { sel: `${kind}:${m.tables[t].name}` }));
      else {
        const areas = areasOfTable(m, t);
        if (areas.length) st[1] = { level: LEVELS[1], value: 'pick a subject area', state: 'later', menu: areaMenu(m, areas, loc) };
      }
      st[2] = { level: LEVELS[2], value: m.tables[t].name, to: loc, state: 'here', mono: true };
      const src = sourceOf(cm, t, q.col);
      if (src) st[3] = { level: LEVELS[3], value: src[2], to: fieldPath(src[0], src[1], slug), state: 'next', mono: true };
      break;
    }
    case 'field': {
      const f = cm ? findField(cm, `${route.record}.${route.field}`) : undefined;
      if (s) st[1] = areaStep('past');
      else if (cm && f !== undefined && cm.fieldSas[f].length) st[1] = { level: LEVELS[1], value: 'pick a subject area', state: 'later', menu: areaMenu(m, cm.fieldSas[f], loc) };
      const [tn, cn] = (q.at ?? '').split('.');
      const t = tn ? findTable(m, tn) : undefined;
      st[2] = t !== undefined
        ? { level: LEVELS[2], value: m.tables[t].name, to: tablePath(m.tables[t].name, { col: cn || null }, slug), state: 'past', mono: true }
        : { level: LEVELS[2], value: 'pick a warehouse column', state: 'later' };
      const label = cm && f !== undefined ? `${cm.core.recordKey[cm.nfRecord[f]]}.${cm.nfName[f]}` : `${route.record}.${route.field}`;
      st[3] = { level: LEVELS[3], value: label, to: loc, state: 'here', mono: true };
      break;
    }
    default:
      break;
  }
  return { steps: st, sa };
}

function AreaMenu({ items }: { items: MenuItem[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        d.open = false;
        d.querySelector('summary')?.focus();
      } else if (!d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, []);
  return (
    <details ref={ref} className="lv-menu">
      <summary className="lv-v hint">pick a subject area <span className="lv-n-of">{items.length}</span></summary>
      <ul className="lv-list">
        {items.map((it) => (
          <li key={it.to}>
            <Link to={it.to} onClick={() => { if (ref.current) ref.current.open = false; }}>
              <span>{it.label}</span>{it.pre && <small>{it.pre}</small>}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function LevelBar() {
  const loc = useLocation();
  const { core: m, columns: cm } = useExplorer();
  if (!m) return <nav className="lv" aria-label="Where you are"><div className="lv-in" /></nav>;
  const route = matchRoute(loc);
  const { steps, sa } = buildSteps(m, cm, loc);
  const nb = sa !== undefined && route.name !== 'compare' ? areaNeighbours(m, sa) : { prev: null, next: null };
  const q = parseQuery(loc);
  const nbTo = (x: number) => {
    const s = m.subjectAreas[x];
    if (route.name === 'matrix') return s.row >= 0 ? matrixPath({ a: s.slug }) : areaPath(s.slug);
    return areaPath(s.slug, { view: route.name === 'area' ? q.view : null });
  };
  return (
    <nav className="lv" aria-label="Where you are">
      <div className="lv-in">
        <ol>
          {steps.map((s, i) => (
            <li key={s.level} className={`lv-s ${s.state}`} aria-current={s.state === 'here' ? 'location' : undefined}>
              <span className="lv-n" aria-hidden="true">{i + 1}</span>
              <span className="lv-b">
                <span className="lv-l">{s.level}{s.pre && <span className="lv-pre"> · {s.pre}</span>}</span>
                {s.menu ? <AreaMenu items={s.menu} />
                  : s.to ? <Link to={s.to} className={s.mono ? 'lv-v mono' : 'lv-v'} title={typeof s.value === 'string' ? s.value : undefined}>{s.value}</Link>
                  : <span className="lv-v hint">{s.value}</span>}
              </span>
            </li>
          ))}
        </ol>
        {(nb.prev !== null || nb.next !== null) && (
          <p className="lv-ctx">
            {nb.prev !== null && <Link to={nbTo(nb.prev)} rel="prev" aria-label={`Previous subject area: ${m.subjectAreas[nb.prev].label}`}>‹ {m.subjectAreas[nb.prev].label}</Link>}
            {nb.next !== null && <Link to={nbTo(nb.next)} rel="next" aria-label={`Next subject area: ${m.subjectAreas[nb.next].label}`}>{m.subjectAreas[nb.next].label} ›</Link>}
          </p>
        )}
      </div>
    </nav>
  );
}
