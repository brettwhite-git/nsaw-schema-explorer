// Route: /   ?a=slug&b=slug (picked rows)  ?dim=TABLE (picked column)  ?open=0,2 (open long-tail bands)
// The bus matrix: a title block, a summary strip, the matrix and a side panel. At phone width the matrix becomes
// grouped lists (PhoneMatrix) and the panel sits above them.
import { useCallback, useMemo, useRef, useState } from 'react';
import { navigate, setQuery, useLocation } from '../router';
import { areaPath, parseQuery } from '../routes';
import { openPalette } from '../components/Palette';
import { usePage } from '../usePage';
import { useExplorer } from '../useExplorer';
import { BusMatrix } from '../components/BusMatrix';
import { SidePanel } from '../components/matrix/SidePanel';
import { PhoneMatrix } from '../components/matrix/PhoneMatrix';
import { matrixLayout, PHONE, pickRow, readSel, selQuery, useMedia, type Sel } from '../components/matrix/shared';
import { factsWithGrain, fmt, type CoreModel } from '../../explorer/data';

function Mark() {
  return <svg className="mx-mark" width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" /></svg>;
}

export function Matrix() {
  const loc = useLocation();
  const q = parseQuery(loc);
  const { core: m, columns: cm, ready, error } = useExplorer({ columns: q.dim !== undefined });
  usePage({ title: '', ready: !!m && ready });
  if (!m) return (
    <section className="page-h">
      <h1 className="title">The bus matrix</h1>
      <p className="note">{error ? `The ontology did not load: ${error}` : 'Loading the matrix…'}</p>
    </section>
  );
  return <MatrixBody m={m} cm={cm} loc={loc} />;
}

function MatrixBody({ m, cm, loc }: { m: CoreModel; cm: ReturnType<typeof useExplorer>['columns']; loc: string }) {
  const sel = useMemo(() => readSel(m, parseQuery(loc)), [m, loc]);
  const phone = useMedia(PHONE);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const write = useCallback((s: Sel) => setQuery(selQuery(m, s)), [m]);

  const [comparing, setComparing] = useState(false);
  const compare = comparing || sel.a !== null;
  const onPickRow = useCallback((r: number) => write(pickRow(sel, r)), [write, sel]);
  const onOpenRow = useCallback((r: number) => navigate(areaPath(m.subjectAreas[m.bus.rows[r]].slug)), [m]);
  const stopCompare = () => { setComparing(false); if (sel.a !== null) write({ ...sel, a: null, b: null }); };
  const onPickCol = useCallback((c: number) => {
    const { bandOf } = matrixLayout(m);
    const open = new Set(sel.open);
    if (bandOf[c] >= 0) open.add(bandOf[c]);
    write({ a: null, b: null, dim: sel.dim === c ? null : c, open });
  }, [m, sel, write]);
  const onToggleBand = useCallback((k: number) => {
    const open = new Set(sel.open);
    if (open.has(k)) open.delete(k); else open.add(k);
    const dim = sel.dim !== null && matrixLayout(m).bandOf[sel.dim] === k && !open.has(k) ? null : sel.dim;
    setQuery(selQuery(m, { ...sel, dim, open }), { replace: true });
  }, [m, sel]);
  const onPhonePick = useCallback((c: number) => {
    write({ ...sel, a: null, b: null, dim: c });
    requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'start' }));
  }, [sel, write]);

  const stats = useMemo(() => {
    const g = factsWithGrain(m);
    const counts = m.core.meta.counts;
    return [
      { n: m.subjectAreas.length, t: `subject areas in ${m.functionalAreas.length} functional areas` },
      { n: counts.physicalTablesInLineage, t: 'warehouse tables in the lineage' },
      { n: m.bus.columns.length, t: 'dimensions shared by two or more areas' },
      { n: g.has, t: 'fact tables with a grain in Oracle’s key list' },
      { n: counts.netsuiteRecords, t: 'NetSuite records named in the lineage' },
    ];
  }, [m]);
  const { head } = matrixLayout(m);
  const selected = sel.a !== null || sel.dim !== null;

  return (
    <>
      <section className="mx-intro">
        <div className="mx-intro-main">
          <h1 className="title">The bus matrix</h1>
          <p className="mx-lede">
            Each row is a subject area and each column a dimension table that Oracle’s lineage lists under two or more
            of them. Read across a row to see what an area can be sliced by. Read down a column to see how far a
            dimension reaches.
          </p>
          <p className="mx-start">
            Click a subject area to open it.{' '}
            <span>Or start from a NetSuite field: <button type="button" className="linkbtn" onClick={() => openPalette('fields')}>Trace a field</button></span>
          </p>
        </div>
        <p className="mx-intro-note"><Mark /><span>A mark means Oracle’s lineage lists this dimension table under this subject area.</span></p>
        <div className="stats mx-stats">
          {stats.map((s) => <div className="stat" key={s.t}><b>{fmt(s.n)}</b><span>{s.t}</span></div>)}
        </div>
      </section>

      {phone ? (
        <section className="mx-board phone">
          {selected && (
            <div className="mx-side" ref={panel}>
              <SidePanel m={m} cm={cm} sel={sel} hoverRow={null} onSel={write} />
            </div>
          )}
          <PhoneMatrix m={m} onPickCol={onPhonePick} dim={sel.dim} />
        </section>
      ) : (
        <section className="mx-board">
          <div className="mx-cmp" role="group" aria-label="Compare two subject areas">
            {compare ? (
              <>
                <span className="mx-cmp-t">
                  {sel.a === null ? 'Pick two rows to compare.' : sel.b === null ? 'Pick a second row to compare with the first.' : 'Comparing the two picked rows.'}
                </span>
                <button type="button" className="linkbtn" onClick={stopCompare}>Done comparing</button>
              </>
            ) : (
              <>
                <button type="button" className="btn" onClick={() => setComparing(true)}>Compare two areas</button>
                <span className="mx-cmp-t">or Shift-click two rows</span>
              </>
            )}
          </div>
          <BusMatrix m={m} sel={sel} onPickRow={onPickRow} onOpenRow={onOpenRow} compare={compare} onPickCol={onPickCol} onToggleBand={onToggleBand} onHoverRow={setHoverRow} />
          <SidePanel m={m} cm={cm} sel={sel} hoverRow={hoverRow} onSel={write} />
        </section>
      )}

      {!phone && (
        <p className="mx-foot">
          Columns are ordered by reach, the number of subject areas whose lineage lists them. The{' '}
          {m.bus.columns.length - head.length} least shared sit in bands at the right edge; open a band to see its columns.
        </p>
      )}
    </>
  );
}
