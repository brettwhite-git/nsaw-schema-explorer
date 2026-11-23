// The fan between warehouse columns and subject areas on the impact trace, bundled per functional area:
// one curve per (warehouse column, functional area) into that area's group heading, then a spine down the
// group and a short tick to each subject area. Ported from renderTrace's draw() in lab/paper-lineage/main.ts.
//
//   <FanWires scope={ref} pairs={pairs} groups={groups} hotCols={…} hotSas={…} at={col} sa={sa} />
//
// Looks up `data-wire` ids inside `scope`: `c<col>` (warehouse column rows), `fa<fa>` (group headings),
// `sa<sa>` (subject area rows). Missing elements are skipped. Redrawn on resize and when fonts load.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface FanPair { c: number; fa: number; sas: number[] }
export interface FanGroup { fa: number; sas: number[] }

interface Props {
  scope: RefObject<HTMLElement | null>;
  pairs: FanPair[];
  groups: FanGroup[];
  hotCols: Set<number>;
  hotSas: Set<number>;
  /** the selected warehouse column, if any */
  at?: number;
  /** the selected subject area, if any */
  sa?: number;
}

interface Geom { d: string; cls: string }
interface Drawn { curves: Geom[]; spines: Geom[]; hot: Geom[]; nodes: { x: number; y: number }[] }
const EMPTY: Drawn = { curves: [], spines: [], hot: [], nodes: [] };
const f = (n: number) => n.toFixed(1);

export function FanWires({ scope, pairs, groups, hotCols, hotSas, at, sa }: Props) {
  const gut = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<Drawn>(EMPTY);

  useLayoutEffect(() => {
    const g = gut.current;
    // On first commit the parent's ref may not be attached yet: the gutter's parent holds every row too.
    const root = (scope.current ?? g?.parentElement) as HTMLElement | null;
    if (!g || !root) return;
    const find = (id: string) => root.querySelector<HTMLElement>(`[data-wire="${id}"]`);
    const any = at !== undefined || sa !== undefined;

    const measure = () => {
      const gr = g.getBoundingClientRect();
      if (!gr.width) { setDrawn(EMPTY); return; }
      const w = gr.width, sx = w - 18;
      const yOf = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 - gr.top; };
      const out: Drawn = { curves: [], spines: [], hot: [], nodes: [] };
      const entry = new Map<number, number>();
      const saY = new Map<number, number>();

      for (const grp of groups) {
        const head = find(`fa${grp.fa}`);
        if (!head) continue;
        const ey = head.getBoundingClientRect().bottom - 9 - gr.top;
        entry.set(grp.fa, ey);
        const ys: number[] = [];
        for (const a of grp.sas) {
          const el = find(`sa${a}`);
          if (!el) continue;
          const y = yOf(el);
          saY.set(a, y);
          ys.push(y);
          const hot = any && hotSas.has(a);
          (hot ? out.hot : out.spines).push({ cls: hot ? 'w hot' : any ? 'w cool' : 'w', d: `M${f(sx)},${f(y)} H${f(w - 2)}` });
        }
        const hi = ys.length ? Math.max(...ys) : ey;
        out.spines.unshift({ cls: `w spine${any ? ' cool' : ''}`, d: `M${f(sx)},${f(ey)} V${f(hi)} M${f(sx)},${f(ey)} H${f(w)}` });
        out.nodes.push({ x: sx, y: ey });
      }

      const few = pairs.length <= 16;
      for (const p of pairs) {
        const el = find(`c${p.c}`);
        const y2 = entry.get(p.fa);
        if (!el || y2 === undefined) continue;
        const y1 = yOf(el);
        const d = `M2,${f(y1)} C${f(sx * 0.55)},${f(y1)} ${f(sx * 0.45)},${f(y2)} ${f(sx)},${f(y2)}`;
        const hotHere = any ? p.sas.filter((a) => hotSas.has(a) && hotCols.has(p.c) && (sa === undefined || a === sa)) : [];
        const hot = hotHere.length > 0 && (at === undefined || p.c === at);
        if (!hot) { out.curves.push({ cls: `w fan${few ? ' few' : ''}${any ? ' cool' : ''}`, d }); continue; }
        out.hot.unshift({ cls: 'w hot', d });
        const ys = hotHere.map((a) => saY.get(a)).filter((y): y is number => y !== undefined);
        if (ys.length) out.hot.push({ cls: 'w hot', d: `M${f(sx)},${f(Math.min(y2, ...ys))} V${f(Math.max(y2, ...ys))}` });
      }
      setDrawn(out);
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
  }, [scope, pairs, groups, hotCols, hotSas, at, sa]);

  return (
    <div ref={gut} className="gut wires-host tr-gut" aria-hidden="true">
      <svg className="wires">
        {drawn.curves.map((p, i) => <path key={`c${i}`} className={p.cls} d={p.d} />)}
        {drawn.spines.map((p, i) => <path key={`s${i}`} className={p.cls} d={p.d} />)}
        {drawn.hot.map((p, i) => <path key={`h${i}`} className={p.cls} d={p.d} />)}
        {drawn.nodes.map((n, i) => <circle key={`n${i}`} className="node" cx={n.x} cy={n.y} r={2.4} />)}
      </svg>
    </div>
  );
}
