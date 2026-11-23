// Subject-area flow, variant B (mini bus matrix, "Grid"): one row per fact drawn in Oracle's 26R4 data model, one
// column per table their diagrams relate them to (most facts first, names slanted 60° up and to the right), a dot
// where the fact's diagram draws the table. The shared columns sit on a light wash; the count under each column says
// how many of the facts relate to it. The grid scrolls sideways in its own box when it is wider than the page.
// Hover lights a row or a column; click or Enter picks it (same ?sel= as the flow). Under 640px: the flow's lists.
// Ported from lab/area-proto (?v=b).
import { useEffect, useMemo, useState } from 'react';
import { plural } from '../../../explorer/data';
import { dimSel, factSel, FlowLists, FlowTip, keyPick, selIndex, type FlowFigureProps } from './AreaFlow';
import { FONT, fit, r1, useWidth } from './measure';

type Hover = { k: 'f' | 'd'; i: number; x: number; y: number } | null;

export function AreaGridFigure({ m, flow, sel, onPick, onReady }: FlowFigureProps) {
  const [ref, width, fonts] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover>(null);
  const wide = width >= 640;
  const ready = width > 0 && fonts;
  useEffect(() => { if (ready) onReady?.(); }, [ready, onReady]);
  const si = selIndex(flow, sel);
  const nF = flow.facts.length, nD = flow.tables.length;

  const L = useMemo(() => {
    if (!wide || !fonts) return null;
    // Columns as on the home matrix: 60° names, at least lineHeight / sin 60° wide (15px at 12px type). When that
    // would not fit, the names drop to 10.5px and the columns to 12px (the matrix's long-tail size), with a shorter
    // overhang on the right; only if even that is too wide does the grid scroll in its own box.
    const rowHW = Math.min(300, Math.max(220, width * 0.24)), rowH = 40;
    const fitW = (pad: number) => (width - rowHW - pad) / Math.max(1, nD);
    const dense = fitW(84) < 15;
    const pad = dense ? 64 : 84;
    const colW = Math.max(dense ? 12 : 15, Math.min(24, fitW(pad)));
    const label = dense ? 120 : 160;
    const headH = Math.round(label * Math.sin(Math.PI / 3)) + 14;
    const gridW = rowHW + nD * colW;
    return { rowHW, rowH, headH, colW, gridW, dense, label, W: Math.ceil(gridW + pad), H: headH + nF * rowH + (dense ? 52 : 40) };
  }, [wide, fonts, width, nD, nF]);

  const cell = new Set(flow.facts.flatMap((f) => f.rels.map((r) => `${f.i}:${flow.tables.findIndex((d) => d.table === r.table)}`)));
  const act = hover ?? (si.f >= 0 ? { k: 'f' as const, i: si.f } : si.d >= 0 ? { k: 'd' as const, i: si.d } : null);
  const litCell = (f: number, d: number) => !!act && (act.k === 'f' ? act.i === f : act.i === d);
  const at = (k: 'f' | 'd', i: number, el: Element) => {
    const box = ref.current!.getBoundingClientRect();
    const b = (el.querySelector('.hit') ?? el).getBoundingClientRect();
    if (k === 'f') setHover({ k, i, x: Math.max(0, b.left - box.left) + (L?.rowHW ?? 0) / 2, y: b.top - box.top });
    else setHover({ k, i, x: b.left - box.left + b.width / 2, y: b.top - box.top });
  };
  const node = (k: 'f' | 'd', i: number, name: string) => ({
    tabIndex: 0,
    role: 'button',
    'aria-pressed': k === 'f' ? si.f === i : si.d === i,
    onClick: () => onPick(k === 'f' ? factSel(name) : dimSel(name)),
    onKeyDown: keyPick(() => onPick(k === 'f' ? factSel(name) : dimSel(name))),
    onMouseEnter: (e: { currentTarget: Element }) => at(k, i, e.currentTarget),
    onMouseLeave: () => setHover(null),
    onFocus: (e: { currentTarget: Element }) => at(k, i, e.currentTarget),
    onBlur: () => setHover(null),
  });
  const nShared = flow.shared;

  return (
    <div className="af ag" ref={ref}>
      {ready && !wide && <FlowLists m={m} flow={flow} sel={sel} onPick={onPick} />}
      {L && (
        <>
          <div className="ag-scroll" tabIndex={L.W > width ? 0 : undefined} aria-label={L.W > width ? 'Scroll the grid sideways' : undefined} role={L.W > width ? 'region' : undefined}>
            <svg className={`af-svg${act ? (hover ? ' hov' : ' picked') : ''}`} width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} role="group"
              aria-label={`${m.subjectAreas[flow.sa].label}: facts by the tables Oracle’s data model relates them to`}>
              {nShared > 0 && <rect x={L.rowHW} y={L.headH - 4} width={r1(nShared * L.colW)} height={nF * L.rowH + 8} className="band" aria-hidden="true" />}
              {Array.from({ length: nF + 1 }, (_, r) => (
                <line key={r} x1="0" x2={r1(L.gridW)} y1={L.headH + r * L.rowH} y2={L.headH + r * L.rowH} className={r === 0 ? 'rule-ink' : 'rule'} aria-hidden="true" />
              ))}
              {flow.tables.map((d) => {
                const x = L.rowHW + d.i * L.colW + L.colW / 2;
                const cls = ['nd', 'col', si.d === d.i && 'sel', act?.k === 'd' && act.i === d.i && 'on'].filter(Boolean).join(' ');
                return (
                  <g key={d.table} className={cls} {...node('d', d.i, d.name)} aria-label={`${d.display}, related to ${d.facts.length} of ${nF} facts in this area`}>
                    <rect x={r1(x - L.colW / 2)} y={L.headH - 4} width={r1(L.colW)} height={nF * L.rowH + 30} className="hit colhit" />
                    <text transform={`translate(${r1(x + 3)} ${L.headH - 8}) rotate(-60)`} className={L.dense ? 't-ch sm' : 't-ch'}>{fit(d.display, L.dense ? FONT.ui105 : FONT.ui12, L.label)}</text>
                    <text x={r1(x)} y={L.headH + nF * L.rowH + 20 + (L.dense && d.i % 2 ? 12 : 0)} className={`${d.facts.length >= 2 ? 't-cnt' : 't-s'}${L.dense ? ' sm' : ''}`} textAnchor="middle">{d.facts.length}</text>
                  </g>
                );
              })}
              {flow.facts.map((f) => {
                const y = L.headH + f.i * L.rowH;
                const cls = ['nd', 'row', si.f === f.i && 'sel', act?.k === 'f' && act.i === f.i && 'on'].filter(Boolean).join(' ');
                return (
                  <g key={f.table} className={cls} {...node('f', f.i, f.name)} aria-label={`${f.name}${f.grain ? `, ${f.grain}` : ''}, relates to ${plural(f.rels.length, 'table')}`}>
                    <rect x="0" y={y} width={r1(L.gridW)} height={L.rowH} className="hit rowhit" />
                    <text x="4" y={y + 17} className="t-mono">{fit(f.name, FONT.mono12, L.rowHW - 50)}</text>
                    <text x={L.rowHW - 14} y={y + 17} className="t-s" textAnchor="end">{f.rels.length}</text>
                    {f.grain && <text x="4" y={y + 33} className="t-it">{fit(f.grain, FONT.it12, L.rowHW - 24)}</text>}
                  </g>
                );
              })}
              <g aria-hidden="true">
                {flow.facts.map((f) => flow.tables.map((d) => cell.has(`${f.i}:${d.i}`) && (
                  <circle key={`${f.i}:${d.i}`} className={litCell(f.i, d.i) ? 'cell on' : 'cell'} cx={r1(L.rowHW + d.i * L.colW + L.colW / 2)} cy={L.headH + f.i * L.rowH + L.rowH / 2} r={Math.min(4.2, L.colW / 4)} />
                )))}
              </g>
              <text x={L.rowHW - 14} y={L.headH - 10} className="t-s" textAnchor="end" aria-hidden="true">tables</text>
              <text x="4" y={L.headH + nF * L.rowH + 20} className="t-it" aria-hidden="true">facts relating to each</text>
            </svg>
          </div>
          <FlowTip m={m} flow={flow} hover={hover} place="above" />
        </>
      )}
    </div>
  );
}
