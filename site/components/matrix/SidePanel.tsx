// The matrix page's side panel. It shows, in order of precedence: two picked rows (a pair to compare), one picked
// row, one picked dimension column, the hovered row, or a short guide. Sections render only when they have data.
import { Link } from '../../router';
import { areaPath, comparePath, matrixPath, tablePath } from '../../routes';
import { areaGrainSentence, areaSummary, compare, compareSentence, dimensionReach, factsInSameAreas, fmt, plural, prettyTable, reach, reportFoldersReading, shortTable, unsecuredName, unslug, type AreaFact, type ColumnModel, type CoreModel } from '../../../explorer/data';
import { matrixLayout, ordinal, type Sel } from './shared';

export interface SidePanelProps {
  m: CoreModel;
  cm: ColumnModel | null;
  sel: Sel;
  hoverRow: number | null;
  onSel: (s: Sel) => void;
}

export function SidePanel({ m, cm, sel, hoverRow, onSel }: SidePanelProps) {
  const pickDim = (c: number) => {
    const { bandOf } = matrixLayout(m);
    const open = new Set(sel.open);
    if (bandOf[c] >= 0) open.add(bandOf[c]);
    onSel({ a: null, b: null, dim: c, open });
  };
  const clear = () => onSel({ ...sel, a: null, b: null, dim: null });
  if (sel.a !== null && sel.b !== null) return <PairPanel m={m} a={sel.a} b={sel.b} pickDim={pickDim} clear={clear} />;
  if (sel.a !== null) return <RowPanel m={m} r={sel.a} picked clear={clear} />;
  if (sel.dim !== null) return <DimPanel m={m} cm={cm} c={sel.dim} clear={clear} />;
  if (hoverRow !== null) return <RowPanel m={m} r={hoverRow} picked={false} clear={clear} />;
  return <GuidePanel m={m} pickDim={pickDim} />;
}

function DimList({ m, cols, hot, pickDim }: { m: CoreModel; cols: number[]; hot?: boolean; pickDim: (c: number) => void }) {
  return (
    <ul className={`mx-dl${hot ? ' hot' : ''}`}>
      {cols.map((c) => (
        <li key={c}>
          <button type="button" onClick={() => pickDim(c)} title={m.tables[m.bus.columns[c]].name}>
            <span className="nm">{prettyTable(m, m.tables[m.bus.columns[c]].name)}</span>
            <span className="n">{reach(m, c)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ guide
function GuidePanel({ m, pickDim }: { m: CoreModel; pickDim: (c: number) => void }) {
  const top = [0, 1, 2, 3, 4, 5].filter((c) => c < m.bus.columns.length);
  const { bands } = matrixLayout(m);
  const so = unslug(m, 'sales-order'), ci = unslug(m, 'customer-invoice');
  const emp = m.tableByName.get('DW_NS_EMPLOYEE_D');
  return (
    <>
      <p className="mx-eyebrow">Reading the matrix</p>
      <h2 className="mx-h2">Rows, columns and marks</h2>
      <ol className="mx-howto">
        <li>Hover a row to see its facts and the grain of each.</li>
        <li>Click two rows to compare the dimensions they list.</li>
        <li>Click a column name to see where a dimension reaches and which report folders read from it.</li>
      </ol>
      <h3 className="mx-h3">Widest reach <span className="n">areas</span></h3>
      <DimList m={m} cols={top} pickDim={pickDim} />
      {top.length > 0 && (
        <p className="mx-note">
          {top.length} dimensions reach {reach(m, top[top.length - 1])} or more of the {m.subjectAreas.length} subject areas.
          {bands.length > 0 && ` ${bands[bands.length - 1].cols.length} reach ${bands[bands.length - 1].hi} or fewer.`}
        </p>
      )}
      {(so !== undefined && ci !== undefined) || emp !== undefined ? <h3 className="mx-h3">Try</h3> : null}
      {so !== undefined && ci !== undefined && (
        <Link className="mx-try" to={comparePath(m.subjectAreas[so].slug, m.subjectAreas[ci].slug)}>
          <span>{m.subjectAreas[so].label} and {m.subjectAreas[ci].label}</span>
          <small>Compare two Order to Cash areas</small>
        </Link>
      )}
      {emp !== undefined && m.tables[emp].col >= 0 && (
        <Link className="mx-try" to={matrixPath({ dim: m.tables[emp].name })}>
          <span>{prettyTable(m, m.tables[emp].name)}</span>
          <small>One dimension, many report folders</small>
        </Link>
      )}
    </>
  );
}

// ------------------------------------------------------------------ one row
interface FactGroup { main: AreaFact; sec: AreaFact | null }
function groupFacts(facts: AreaFact[]): FactGroup[] {
  const by = new Map<string, FactGroup>();
  for (const f of facts) {
    const k = unsecuredName(f.name);
    const g = by.get(k);
    if (!g) by.set(k, { main: f, sec: null });
    else if (!g.sec && g.main.secured !== f.secured) { if (f.secured) g.sec = f; else { g.sec = g.main; g.main = f; } }
    else by.set(`${k}#${f.table}`, { main: f, sec: null });
  }
  return [...by.values()];
}

export function FactBlock({ f, sec }: { f: AreaFact; sec?: AreaFact | null }) {
  return (
    <div className="mx-fact">
      <div className="f-name">
        <Link className="mono" to={tablePath(f.name)}>{f.name}</Link>
        {f.secured && <span className="badge">secured</span>}
      </div>
      {f.grain && <p className="f-grain">{f.grain}</p>}
      {f.key.length > 0 && (
        <p className="f-key">
          <span>key</span>
          {f.key.map((k, i) => (
            <span key={k}>{i > 0 && <span className="plus">+</span>}<span className="ktag">{k}</span></span>
          ))}
        </p>
      )}
      {sec && (
        <div className="f-sec">
          <Link className="mono" to={tablePath(sec.name)}>{sec.name}</Link>
          <span className="badge">secured</span>
        </div>
      )}
    </div>
  );
}

function RowPanel({ m, r, picked, clear }: { m: CoreModel; r: number; picked: boolean; clear: () => void }) {
  const sa = m.bus.rows[r];
  const s = m.subjectAreas[sa];
  const area = areaSummary(m, null, sa);
  const groups = groupFacts(area.facts);
  const note = areaGrainSentence(m, sa);
  return (
    <>
      {area.faName && <p className="mx-eyebrow">{area.faName}</p>}
      <h2 className="mx-h2"><Link className="plain" to={areaPath(s.slug)}>{s.label}</Link></h2>
      <p className="mx-sub mono">{s.name}</p>
      <dl className="mx-kv">
        <dt>Shared dimensions listed</dt><dd>{fmt(m.bus.cells[r].length)}</dd>
        <dt>Fact tables</dt><dd>{fmt(s.facts)}</dd>
        <dt>Dimension tables</dt><dd>{fmt(s.dimensions)}</dd>
        <dt>Report columns</dt><dd>{fmt(s.presentationColumns)}</dd>
      </dl>
      {groups.length > 0 && (
        <>
          <h3 className="mx-h3">Its facts and their grain</h3>
          {note && <p className="mx-note">{note}</p>}
          {groups.map((g) => <FactBlock key={g.main.table} f={g.main} sec={g.sec} />)}
        </>
      )}
      <p className="mx-links">
        <Link className="linkbtn" to={areaPath(s.slug)}>Open {s.label}</Link>
        {picked && <button type="button" className="linkbtn" onClick={clear}>Clear</button>}
      </p>
      <p className="mx-hint">{picked ? 'Click a second row to compare the two areas.' : 'Click the row to pick it.'}</p>
    </>
  );
}

// ------------------------------------------------------------------ two rows
function PairPanel({ m, a, b, pickDim, clear }: { m: CoreModel; a: number; b: number; pickDim: (c: number) => void; clear: () => void }) {
  const saA = m.bus.rows[a], saB = m.bus.rows[b];
  const A = m.subjectAreas[saA], B = m.subjectAreas[saB];
  const c = compare(m, saA, saB);
  const lead = compareSentence(m, saA, saB);
  return (
    <>
      <p className="mx-eyebrow">Two subject areas</p>
      <h2 className="mx-h2 pair">
        <span><i>A</i>{A.label}</span>
        <span><i>B</i>{B.label}</span>
      </h2>
      <div className="mx-trio">
        <div className="hot"><b>{c.onlyA.length}</b><span>only in A</span></div>
        <div className="hot"><b>{c.onlyB.length}</b><span>only in B</span></div>
        <div className="quiet"><b>{c.both.length}</b><span>in both</span></div>
      </div>
      {lead && <p className="mx-lead">{lead}</p>}
      <p className="mx-links">
        <Link className="btn on" to={comparePath(A.slug, B.slug)}>Compare {A.label} and {B.label}</Link>
        <button type="button" className="linkbtn" onClick={clear}>Clear</button>
      </p>
      {c.onlyA.length > 0 && (<><h3 className="mx-h3">Only in {A.label} <span className="n">reach</span></h3><DimList m={m} cols={c.onlyA} hot pickDim={pickDim} /></>)}
      {c.onlyB.length > 0 && (<><h3 className="mx-h3">Only in {B.label} <span className="n">reach</span></h3><DimList m={m} cols={c.onlyB} hot pickDim={pickDim} /></>)}
      {c.both.length > 0 && (
        <details className="mx-shared">
          <summary>{plural(c.both.length, 'dimension')} listed under both</summary>
          <p className="mx-quiet">{c.both.map((x) => prettyTable(m, m.tables[m.bus.columns[x]].name)).join(', ')}</p>
        </details>
      )}
    </>
  );
}

// ------------------------------------------------------------------ one dimension
const FOLDERS_SHOWN = 14, FACTS_SHOWN = 10;

function DimPanel({ m, cm, c, clear }: { m: CoreModel; cm: ColumnModel | null; c: number; clear: () => void }) {
  const t = m.bus.columns[c];
  const name = m.tables[t].name;
  const n = reach(m, c), N = m.subjectAreas.length;
  const perFa = dimensionReach(m, c).filter((x) => x.total > 0);
  const folders = cm ? reportFoldersReading(m, cm, t) : [];
  const facts = factsInSameAreas(m, c);
  const maxW = Math.max(1, ...facts.map((x) => x.areas));
  return (
    <>
      <p className="mx-eyebrow">Dimension, {ordinal(c + 1)} most shared of {m.bus.columns.length}</p>
      <h2 className="mx-h2">{prettyTable(m, name)}</h2>
      <p className="mx-sub"><Link className="mono" to={tablePath(name)}>{name}</Link></p>
      {m.bus.columnDerived[c] ? <p className="mx-note">Generated by NSAW.</p> : null}
      <div className="mx-big"><b>{n}</b><span>of {N} subject areas list it</span></div>
      <div className="mx-meter" aria-hidden="true"><i style={{ width: `${(n / N) * 100}%` }} /></div>

      {perFa.length > 0 && (
        <>
          <h3 className="mx-h3">Reach by functional area</h3>
          <ul className="mx-bars">
            {perFa.map((p) => (
              <li key={p.fa}>
                <span className="nm">{p.name}</span>
                <span className="m" aria-hidden="true"><i style={{ width: `${(p.has / p.total) * 100}%` }} /></span>
                <span className="n">{p.has} of {p.total}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {!cm && <p className="mx-note">Loading report folders…</p>}
      {folders.length > 0 && (
        <>
          <h3 className="mx-h3">Report folders that read from it <span className="n">areas</span></h3>
          <p className="mx-roles">
            {folders.slice(0, FOLDERS_SHOWN).map((f) => <span key={f.name}><em>{f.name}</em> <span className="n">{f.areas}</span></span>)}
          </p>
          <p className="mx-note">
            Report folders with a column that Oracle’s lineage maps to a column of {shortTable(name)}
            {folders.length > FOLDERS_SHOWN ? `, ${folders.length} in all.` : '.'}
          </p>
        </>
      )}

      {facts.length > 0 && (
        <>
          <h3 className="mx-h3">Facts in the same subject areas <span className="n">areas</span></h3>
          <p className="mx-note">Oracle’s lineage lists {plural(facts.length, 'fact table')} in the subject areas that list this dimension.</p>
          <ul className="mx-bars fx">
            {facts.slice(0, FACTS_SHOWN).map((x) => (
              <li key={x.table}>
                <Link className="mono nm" to={tablePath(m.tables[x.table].name)} title={m.tables[x.table].name}>{shortTable(m.tables[x.table].name)}</Link>
                <span className="m" aria-hidden="true"><i style={{ width: `${(x.areas / maxW) * 100}%` }} /></span>
                <span className="n">{x.areas}</span>
              </li>
            ))}
          </ul>
          {facts.length > FACTS_SHOWN && <p className="mx-note">And {facts.length - FACTS_SHOWN} more on the table page.</p>}
        </>
      )}
      <p className="mx-links">
        <Link className="linkbtn" to={tablePath(name)}>Open {shortTable(name)}</Link>
        <button type="button" className="linkbtn" onClick={clear}>Clear</button>
      </p>
    </>
  );
}
