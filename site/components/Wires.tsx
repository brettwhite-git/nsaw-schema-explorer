// SVG connecting lines between measured elements, drawn inside a gutter that sits between two columns.
// Ported from drawWires / drawComb in lab/paper-lineage/main.ts.
//
//   <div className="ledger" ref={scope}>
//     <ul>{left.map((c) => <li data-wire={`L${c.id}`}>…</li>)}</ul>
//     <Wires scope={scope} wires={[{ a: 'L1', b: 'R4', selected: true }]} />          // one curve per pair
//     <ul>{right.map((c) => <li data-wire={`R${c.id}`}>…</li>)}</ul>
//   </div>
//   <Wires scope={scope} source="S0" wires={rows.map((r) => ({ a: 'S0', b: `R${r}` }))} />  // comb: one source fans out
//
// - `a` / `b` are `data-wire` ids looked up inside `scope` (default: the gutter's parent element).
//   `a` is on the left of the gutter, `b` on the right. Missing elements are skipped.
// - Every line is a stated link: a solid ink line. `selected` draws it in the accent (with end dots),
//   `cool` fades it (something else is selected). Selected lines draw last, on top.
// - Measured in useLayoutEffect, redrawn when the scope or gutter resizes (ResizeObserver), when fonts
//   finish loading, and whenever `wires` / `source` change. The gutter needs a width from its own layout.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface Wire {
  /** data-wire id of the element on the left of the gutter. */
  a: string;
  /** data-wire id of the element on the right of the gutter. */
  b: string;
  selected?: boolean;
  cool?: boolean;
}

export interface WiresProps {
  wires: Wire[];
  /** Comb mode: the one left-hand element every wire starts from (a stem, a spine, a tick per row). */
  source?: string;
  /** Where to look up data-wire ids. Default: the gutter's parent element. */
  scope?: RefObject<HTMLElement | null>;
  /** Extra class on the gutter element. */
  className?: string;
}

export interface WireGeom { d: string; cls: string }
export interface Drawn { paths: WireGeom[]; dots: { x: number; y: number }[]; nodes: { x: number; y: number }[] }

const f = (n: number) => n.toFixed(1);
const cls = (selected?: boolean, cool?: boolean) => ['w', selected ? 'hot' : '', cool && !selected ? 'cool' : ''].filter(Boolean).join(' ');

/** Pure geometry: one S-curve per pair. `ys` are [leftY, rightY] centres relative to the gutter, `w` its width. */
export function pairGeometry(ys: { y1: number; y2: number; selected?: boolean; cool?: boolean }[], w: number): Drawn {
  const out: Drawn = { paths: [], dots: [], nodes: [] };
  const mx = w / 2;
  for (const p of ys.slice().sort((x, y) => +!!x.selected - +!!y.selected)) {
    out.paths.push({ cls: cls(p.selected, p.cool), d: `M2,${f(p.y1)} C${f(mx)},${f(p.y1)} ${f(mx)},${f(p.y2)} ${f(w - 2)},${f(p.y2)}` });
    if (p.selected) out.dots.push({ x: 2, y: p.y1 }, { x: w - 2, y: p.y2 });
  }
  return out;
}

/** Pure geometry: one source at `yc` fanning to rows at `ys` — a stem, a spine at 40% width, then a tick per row. */
export function combGeometry(yc: number, rows: { y: number; selected?: boolean; cool?: boolean }[], w: number): Drawn {
  const out: Drawn = { paths: [], dots: [], nodes: [] };
  if (!rows.length) return out;
  const sx = Math.round(w * 0.4);
  const ys = rows.map((r) => r.y);
  const anyCool = rows.some((r) => r.cool || r.selected);
  const lo = Math.min(yc, ...ys), hi = Math.max(yc, ...ys);
  out.paths.push({ cls: cls(false, anyCool), d: `M0,${f(yc)} H${sx} M${sx},${f(lo)} V${f(hi)}` });
  const hy = rows.filter((r) => r.selected).map((r) => r.y);
  if (hy.length) out.paths.push({ cls: 'w hot', d: `M0,${f(yc)} H${sx} M${sx},${f(Math.min(yc, ...hy))} V${f(Math.max(yc, ...hy))}` });
  rows.map((_, i) => i).sort((a, b) => +!!rows[a].selected - +!!rows[b].selected).forEach((i) => {
    const y = rows[i].y, r = Math.min(6, Math.abs(y - yc));
    const d = Math.abs(y - yc) < 1
      ? `M${sx},${f(y)} H${f(w - 2)}`
      : `M${sx},${f(y - Math.sign(y - yc) * r)} Q${sx},${f(y)} ${sx + r},${f(y)} H${f(w - 2)}`;
    out.paths.push({ cls: cls(rows[i].selected, anyCool), d });
  });
  out.nodes.push({ x: sx, y: yc });
  return out;
}

const EMPTY: Drawn = { paths: [], dots: [], nodes: [] };

export function Wires({ wires, source, scope, className }: WiresProps) {
  const gut = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<Drawn>(EMPTY);

  useLayoutEffect(() => {
    const g = gut.current;
    if (!g) return;
    const root = (scope?.current ?? g.parentElement) as HTMLElement | null;
    if (!root) return;
    const find = (id: string) => root.querySelector<HTMLElement>(`[data-wire="${CSS.escape(id)}"]`);
    const mid = (el: HTMLElement, top: number) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 - top; };

    const measure = () => {
      const gr = g.getBoundingClientRect();
      if (source !== undefined) {
        const src = find(source);
        if (!src) { setDrawn(EMPTY); return; }
        const rs = src.getBoundingClientRect();
        const yc = Math.min(rs.top + 22, rs.top + rs.height / 2) - gr.top;
        const rows = wires.flatMap((w) => { const el = find(w.b); return el ? [{ y: mid(el, gr.top), selected: w.selected, cool: w.cool }] : []; });
        setDrawn(combGeometry(yc, rows, gr.width));
      } else {
        const ys = wires.flatMap((w) => {
          const a = find(w.a), b = find(w.b);
          return a && b ? [{ y1: mid(a, gr.top), y2: mid(b, gr.top), selected: w.selected, cool: w.cool }] : [];
        });
        setDrawn(pairGeometry(ys, gr.width));
      }
    };

    measure();
    let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    const ro = new ResizeObserver(later);
    ro.observe(root);
    ro.observe(g);
    let live = true;
    document.fonts?.ready.then(() => { if (live) later(); });
    return () => { live = false; ro.disconnect(); cancelAnimationFrame(raf); };
  }, [wires, source, scope]);

  return (
    <div ref={gut} className={['gut', 'wires-host', className].filter(Boolean).join(' ')} aria-hidden="true">
      <svg className="wires">
        {drawn.paths.map((p, i) => <path key={i} className={p.cls} d={p.d} />)}
        {drawn.dots.map((d, i) => <circle key={`d${i}`} className="hotdot" cx={d.x} cy={d.y} r={2.2} />)}
        {drawn.nodes.map((d, i) => <circle key={`n${i}`} className="node" cx={d.x} cy={d.y} r={2.6} />)}
      </svg>
    </div>
  );
}
