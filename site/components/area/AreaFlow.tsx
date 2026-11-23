// Subject-area flow, variant A (bipartite): the area's facts that Oracle's 26R4 data model draws, as cards on the
// left; every table their diagrams relate them to on the right, in two groups ("Shared by two or more facts",
// "Related to one fact"); one plain solid curve per stated relation (no direction, no cardinality).
// Hover or focus a node: its lines turn to the accent and the rest step back, with a one-line label. Click or
// Enter picks it (the page shows it in the inspector and keeps it in ?sel=). Under 640px wide: plain lists.
// Ported from lab/area-proto (?v=a).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react';
import { fmt, plural, prettyTable, type AreaFlow as Flow, type CoreModel } from '../../../explorer/data';
import { FONT, fit, r1, useWidth } from './measure';

export interface FlowFigureProps {
  m: CoreModel;
  flow: Flow;
  /** "fact:NAME" | "dim:NAME" | null */
  sel: string | null;
  onPick: (sel: string) => void;
  /** called once the figure has drawn at its measured width */
  onReady?: () => void;
}

type Hover = { k: 'f' | 'd'; i: number; x: number; y: number } | null;

export const factSel = (name: string) => `fact:${name}`;
export const dimSel = (name: string) => `dim:${name}`;

/** Which fact / table index the selection names, in this flow. */
export function selIndex(flow: Flow, sel: string | null): { f: number; d: number } {
  if (!sel) return { f: -1, d: -1 };
  const name = sel.slice(sel.indexOf(':') + 1).toUpperCase();
  if (sel.startsWith('fact:')) return { f: flow.facts.findIndex((x) => x.name.toUpperCase() === name), d: -1 };
  return { f: -1, d: flow.tables.findIndex((x) => x.name.toUpperCase() === name) };
}

export const keyPick = (go: () => void) => (e: RKeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
};

function tipText(m: CoreModel, flow: Flow, h: NonNullable<Hover>): string {
  const NSA = m.subjectAreas.length;
  if (h.k === 'f') {
    const f = flow.facts[h.i];
    const sh = f.rels.filter((r) => (flow.tables.find((d) => d.table === r.table)?.facts.length ?? 0) >= 2).length;
    return `${f.name} · relates to ${plural(f.rels.length, 'table')}${sh ? `, ${fmt(sh)} shared` : ''} · stated in Oracle’s 26R4 data model`;
  }
  const d = flow.tables[h.i];
  return `${d.display} · related to ${d.facts.length} of ${flow.facts.length} facts here · in ${fmt(d.reach)} of ${fmt(NSA)} subject areas · stated in Oracle’s 26R4 data model`;
}

export function FlowTip({ m, flow, hover, place }: { m: CoreModel; flow: Flow; hover: Hover; place: 'side' | 'above' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  useEffect(() => {
    const t = ref.current;
    if (!hover || !t) { setPos(null); return; }
    const fig = t.parentElement!.getBoundingClientRect();
    let x: number, y: number;
    if (place === 'side') {
      x = hover.k === 'd' ? hover.x - t.offsetWidth - 14 : hover.x + 14;
      y = hover.y - t.offsetHeight / 2;
    } else {
      x = hover.x - t.offsetWidth / 2;
      y = hover.y - t.offsetHeight - 10;
    }
    x = Math.max(0, Math.min(x, fig.width - t.offsetWidth));
    setPos([Math.round(x), Math.round(Math.max(0, y))]);
  }, [hover, place]);
  if (!hover) return null;
  const [name, ...rest] = tipText(m, flow, hover).split(' · ');
  return (
    <div ref={ref} className="af-tip" role="status" style={{ transform: pos ? `translate(${pos[0]}px, ${pos[1]}px)` : undefined, visibility: pos ? 'visible' : 'hidden' }}>
      <b className={hover.k === 'f' ? 'mono' : undefined}>{name}</b>
      {rest.map((s, i) => <span key={i}><span className="sep" aria-hidden="true">·</span>{i === rest.length - 1 ? <i>{s}</i> : s}</span>)}
    </div>
  );
}

/** Narrow screens: the same content as lists, each item a button that picks it. */
export function FlowLists({ m, flow, sel, onPick }: Omit<FlowFigureProps, 'onReady'>) {
  const si = selIndex(flow, sel);
  const nF = flow.facts.length;
  const groups = [
    { title: 'Shared by two or more facts', ds: flow.tables.filter((d) => d.facts.length >= 2) },
    { title: 'Related to one fact', ds: flow.tables.filter((d) => d.facts.length < 2) },
  ].filter((g) => g.ds.length);
  return (
    <div className="af-lists">
      <h3 className="af-gh">Facts drawn in the data model <span className="num faint">{nF}</span></h3>
      <ul className="af-facts">
        {flow.facts.map((f) => (
          <li key={f.table}>
            <button type="button" className={si.f === f.i ? 'af-card sel' : 'af-card'} aria-pressed={si.f === f.i} onClick={() => onPick(factSel(f.name))}>
              <span className="mono">{f.name}</span><span className="num faint">{f.rels.length}</span>
              <i>{f.grain ?? prettyTable(m, f.name)}</i>
            </button>
          </li>
        ))}
      </ul>
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className="af-gh">{g.title} <span className="num faint">{g.ds.length}</span></h3>
          <ul className="af-rows">
            {g.ds.map((d) => (
              <li key={d.table}>
                <button type="button" className={si.d === d.i ? 'sel' : undefined} aria-pressed={si.d === d.i} onClick={() => onPick(dimSel(d.name))}>
                  <span>{d.display}{d.isFact && <i> fact</i>}</span>
                  <span className="num faint">{d.facts.length >= 2 ? `${d.facts.length} of ${nF} facts` : '1'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface Layout {
  W: number; H: number; cardW: number; cardH: number; dimX: number; rowH: number;
  fy: number[]; dy: number[]; heads: { title: string; n: number; y: number }[];
}

function layout(flow: Flow, W: number): Layout {
  const nF = flow.facts.length;
  const shared = flow.tables.filter((d) => d.facts.length >= 2), single = flow.tables.filter((d) => d.facts.length < 2);
  const rowH = 24, gh = 40, cardH = 54;
  const cardW = Math.min(330, W * 0.34);
  const dimX = Math.max(cardW + 240, W - 330);
  const dy: number[] = new Array(flow.tables.length);
  const heads: Layout['heads'] = [];
  let y = 30;
  for (const [title, ds] of [['Shared by two or more facts', shared], ['Related to one fact', single]] as const) {
    if (!ds.length) continue;
    heads.push({ title, n: ds.length, y });
    y += gh - 6;
    for (const d of ds) { dy[d.i] = y; y += rowH; }
    y += 26;
  }
  const H = Math.max(y, nF * (cardH + 22) + 60);
  // facts spread over the shared block first (that is where most lines land)
  const lastShared = shared.length ? dy[shared[shared.length - 1].i] - 30 : H;
  const span = Math.max(nF * (cardH + 22), Math.min(H - 60, lastShared + 120));
  const fTop = 30 + Math.max(0, (Math.min(H, span + 60) - span) / 2);
  const fy = flow.facts.map((f) => fTop + (nF === 1 ? span / 2 - cardH / 2 : (f.i * (span - cardH)) / Math.max(1, nF - 1)));
  return { W, H: Math.ceil(H), cardW, cardH, dimX, rowH, fy, dy, heads };
}

export function AreaFlowFigure({ m, flow, sel, onPick, onReady }: FlowFigureProps) {
  const [ref, width, fonts] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover>(null);
  const W = Math.min(width, 1320);
  const wide = W >= 640;
  const L = useMemo(() => (wide && fonts ? layout(flow, W) : null), [flow, W, wide, fonts]);
  const si = selIndex(flow, sel);
  const nF = flow.facts.length;
  const ready = width > 0 && fonts;
  useEffect(() => { if (ready) onReady?.(); }, [ready, onReady]);

  const label = `${m.subjectAreas[flow.sa].label}: ${nF} facts and the ${flow.tables.length} tables Oracle’s data model relates them to`;
  const at = (k: 'f' | 'd', i: number, el: Element) => {
    const fig = ref.current!.getBoundingClientRect(), b = el.getBoundingClientRect();
    setHover({ k, i, x: k === 'd' ? b.left - fig.left : b.right - fig.left, y: b.top - fig.top + b.height / 2 });
  };
  // what the hover (or, without one, the selection) lights
  const lit = useMemo(() => {
    const src = hover ? { k: hover.k, i: hover.i } : si.f >= 0 ? { k: 'f' as const, i: si.f } : si.d >= 0 ? { k: 'd' as const, i: si.d } : null;
    if (!src) return null;
    const fs = new Set<number>(), ds = new Set<number>();
    if (src.k === 'f') { fs.add(src.i); for (const r of flow.facts[src.i].rels) ds.add(flow.tables.findIndex((d) => d.table === r.table)); }
    else { ds.add(src.i); for (const f of flow.tables[src.i].facts) fs.add(f); }
    return { src, fs, ds, hot: !!hover };
  }, [hover, si.f, si.d, flow]);

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

  return (
    <div className="af" ref={ref}>
      {ready && !wide && <FlowLists m={m} flow={flow} sel={sel} onPick={onPick} />}
      {L && (
        <>
          <svg className={`af-svg${lit ? (lit.hot ? ' hov' : ' picked') : ''}`} width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} role="group" aria-label={label}>
            <g className="af-lines" aria-hidden="true">
              {flow.facts.map((f) => {
                const x1 = L.cardW, y1 = L.fy[f.i] + L.cardH / 2;
                return f.rels.map((r) => {
                  const d = flow.tables.find((x) => x.table === r.table)!;
                  const x2 = L.dimX - 8, y2 = L.dy[d.i], mx = (x1 + x2) / 2;
                  const on = !!lit && (lit.src.k === 'f' ? lit.src.i === f.i : lit.src.i === d.i);
                  return <path key={`${f.i}-${d.i}`} className={`ln${d.facts.length >= 2 ? ' sh' : ''}${on ? ' on' : ''}`} d={`M${r1(x1)} ${r1(y1)} C${r1(mx)} ${r1(y1)} ${r1(mx)} ${r1(y2)} ${r1(x2)} ${r1(y2)}`} />;
                });
              })}
            </g>
            {L.heads.map((h) => (
              <g key={h.title} aria-hidden="true">
                <text x={L.dimX - 6} y={h.y + 4} className="t-gh">{h.title}</text>
                <text x={L.W} y={h.y + 4} className="t-s" textAnchor="end">{h.n}</text>
                <line x1={L.dimX - 6} x2={L.W} y1={h.y + 12} y2={h.y + 12} className="rule-ink" />
              </g>
            ))}
            {flow.facts.map((f) => {
              const y0 = L.fy[f.i];
              const cls = ['nd', 'fact', si.f === f.i && 'sel', lit?.fs.has(f.i) && 'on'].filter(Boolean).join(' ');
              return (
                <g key={f.table} className={cls} {...node('f', f.i, f.name)}
                  aria-label={`${f.name}${f.grain ? `, ${f.grain}` : ''}, relates to ${plural(f.rels.length, 'table')}`}>
                  <rect x="0" y={r1(y0)} width={r1(L.cardW)} height={L.cardH} className="card" />
                  <text x="14" y={r1(y0 + 21)} className="t-mono">{fit(f.name, FONT.mono12, L.cardW - 70)}</text>
                  <text x={r1(L.cardW - 12)} y={r1(y0 + 21)} className="t-s" textAnchor="end">{f.rels.length}</text>
                  <text x="14" y={r1(y0 + 40)} className="t-it">{fit(f.grain ?? prettyTable(m, f.name), FONT.it12, L.cardW - 28)}</text>
                  <circle cx={r1(L.cardW)} cy={r1(y0 + L.cardH / 2)} r="2.4" className="port" />
                </g>
              );
            })}
            {flow.tables.map((d) => {
              const y0 = L.dy[d.i];
              const cls = ['nd', 'dim', si.d === d.i && 'sel', lit?.ds.has(d.i) && 'on'].filter(Boolean).join(' ');
              const nameW = L.W - L.dimX - 110 - (d.isFact ? 30 : 0);
              return (
                <g key={d.table} className={cls} {...node('d', d.i, d.name)}
                  aria-label={`${d.display}, related to ${d.facts.length} of ${nF} facts in this area`}>
                  <rect x={L.dimX - 12} y={y0 - 12} width={L.W - L.dimX + 12} height={L.rowH} className="hit" />
                  <circle cx={L.dimX - 6} cy={y0} r="2.4" className="dot" />
                  <text x={L.dimX + 4} y={y0 + 4.5} className="t-ui">{fit(d.display, FONT.ui13, nameW)}{d.isFact && <tspan className="t-it"> fact</tspan>}</text>
                  <text x={L.W} y={y0 + 4} className={d.facts.length >= 2 ? 't-cnt' : 't-s'} textAnchor="end">{d.facts.length >= 2 ? `${d.facts.length} of ${nF} facts` : '1'}</text>
                </g>
              );
            })}
          </svg>
          <FlowTip m={m} flow={flow} hover={hover} place="side" />
        </>
      )}
    </div>
  );
}
