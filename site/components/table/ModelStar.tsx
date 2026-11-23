// The data-model star: the fact card in the centre (grain + key), its header partner above on the key-list line
// (1 .. many), related facts as cards below, and the dimensions on two arcs in alphabetical order, each with its reach.
// Every line is solid: Oracle's 26R4 data model diagram states the relation; the header line is the Entity Key List's.
// Ported from lab/star-proto (variant A). Layout is pure (layoutStar); the component measures text and width.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { navigate } from '../../router';
import { tablePath } from '../../routes';
import { carryArea } from '../area/carry';
import { keyOrder, type CoreModel, type ModelRelation } from '../../../explorer/data';

// ------------------------------------------------------------------ text measuring (same faces as the CSS)
const F = {
  ui13: '400 13px "Source Sans 3 Variable"',
  mono12: '400 12px "JetBrains Mono Variable"',
  mono13: '500 13px "JetBrains Mono Variable"',
  monoS: '400 10.5px "JetBrains Mono Variable"',
  it13: 'italic 400 13px "Source Serif 4 Variable"',
  serif17: '400 17px "Source Serif 4 Variable"',
};
let ctx: CanvasRenderingContext2D | null = null;
const measure = (s: string, font: string): number => {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return s.length * 7;
  ctx.font = font;
  return ctx.measureText(s).width;
};
function wrap(s: string, font: string, w: number): string[] {
  const out: string[] = []; let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, font) > w) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
/** Wrap, then narrow the measure while the line count holds, so the last line is not a lone word. */
function wrapBalanced(s: string, font: string, w: number): string[] {
  const base = wrap(s, font, w);
  let best = base;
  if (base.length > 1) for (let ww = w - 6; ww > w * 0.55; ww -= 6) { const t = wrap(s, font, ww); if (t.length !== base.length) break; best = t; }
  return best;
}

// ------------------------------------------------------------------ layout
export interface Box { x: number; y: number; w: number; h: number }
export interface StarFact { name: string; grain: string | null; keys: string[] }
export interface StarHeader { table: number; name: string; display: string; col: string; reach: number }
interface DimNode { r: ModelRelation; x: number; y: number; side: -1 | 1; port: [number, number]; box: Box }
interface CardNode { r: ModelRelation; box: Box; from: [number, number] }
export interface StarLayout {
  W: number; H: number;
  fact: Box; grainLines: string[]; ports: [number, number][];
  header?: { box: Box; lineX: number; y1: number; y2: number };
  facts: CardNode[]; dims: DimNode[];
}

const CARD_W = 372, HDR_H = 68, GAP = 64, STEP = 46, FACT_H = 46;
const cardW = (name: string) => Math.max(200, measure(name, F.mono12) + 28);

function factHeight(f: StarFact, lines: string[]) { return 18 + 14 + 20 + lines.length * 22 + (f.keys.length ? 30 : 6) + 12; }

export function layoutStar(W: number, f: StarFact, hd: StarHeader | undefined, rels: ModelRelation[]): StarLayout {
  const dims = rels.filter((r) => !r.isFact).sort((a, b) => a.display.localeCompare(b.display));
  const facts = rels.filter((r) => r.isFact);
  const nL = Math.ceil(dims.length / 2);
  const grainLines = f.grain ? wrapBalanced(f.grain, F.serif17, CARD_W - 36) : [];
  const fh = factHeight(f, grainLines);
  const clusterH = (hd ? HDR_H + GAP : 0) + fh + (facts.length ? 52 + FACT_H : 0);
  const span = Math.max((nL - 1) * STEP, clusterH + 40);
  const top = 30, cx = W / 2, cy = top + span / 2 + 10;
  const H = top + span + 60;
  const Rx = Math.min(W / 2 - 250, 540);

  const fy = cy - fh / 2;
  const fact: Box = { x: cx - CARD_W / 2, y: fy, w: CARD_W, h: fh };
  let header: StarLayout['header'];
  if (hd) {
    const w = cardW(hd.name);
    const hy = fy - GAP - HDR_H;
    header = { box: { x: cx - w / 2, y: hy, w, h: HDR_H }, lineX: cx, y1: hy + HDR_H, y2: fy };
  }
  const factNodes: CardNode[] = [];
  if (facts.length) {
    const tw = facts.reduce((a, r) => a + cardW(r.name), 0) + (facts.length - 1) * 20;
    let x = cx - tw / 2;
    const y = fy + fh + 52;
    for (const r of facts) {
      const w = cardW(r.name);
      factNodes.push({ r, box: { x, y, w, h: FACT_H }, from: [x + w / 2, fy + fh] });
      x += w + 20;
    }
  }
  const ports: [number, number][] = [[cx - CARD_W / 2, cy], [cx + CARD_W / 2, cy]];
  const dimNodes: DimNode[] = [];
  const place = (list: ModelRelation[], side: -1 | 1) => {
    const n = list.length;
    const sp = Math.max((n - 1) * STEP, Math.min(span, (n - 1) * 70));
    list.forEach((r, i) => {
      const y = cy - sp / 2 + (n === 1 ? sp / 2 : (i * sp) / (n - 1));
      const dy = (y - cy) / (sp / 2 + STEP * 1.4);
      const x = cx + side * (CARD_W / 2 + 70 + (Rx - CARD_W / 2 - 70) * Math.sqrt(Math.max(0, 1 - dy * dy)));
      const lw = Math.max(measure(r.display, F.ui13), 44 + 30);
      const box: Box = side < 0 ? { x: x - 10 - lw, y: y - 14, w: lw + 14, h: 30 } : { x: x - 4, y: y - 14, w: lw + 14, h: 30 };
      dimNodes.push({ r, x, y, side, port: side < 0 ? ports[0] : ports[1], box });
    });
  };
  place(dims.slice(0, nL), -1);
  place(dims.slice(nL), 1);
  return { W, H, fact, grainLines, ports, header, facts: factNodes, dims: dimNodes };
}

// ------------------------------------------------------------------ hooks
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
function useFontsReady(): boolean {
  const [ok, setOk] = useState(() => typeof document !== 'undefined' && document.fonts?.status === 'loaded');
  useEffect(() => {
    if (ok || !document.fonts) return;
    let live = true;
    Promise.all(Object.values(F).map((f) => document.fonts.load(f))).then(() => document.fonts.ready).then(() => { if (live) setOk(true); });
    return () => { live = false; };
  }, [ok]);
  return ok;
}

// ------------------------------------------------------------------ component
export interface StarProps {
  m: CoreModel;
  fact: StarFact;
  header?: StarHeader;
  rels: ModelRelation[];
  /** subject areas in the model (the reach denominator) */
  total: number;
  hot: number | null;
  setHot: (t: number | null) => void;
}

const SRC_DM = 'stated in Oracle’s 26R4 data model';
const SRC_KEY = 'stated in Oracle’s Entity Key List';
const reachLabel = (r: { reach: number; isFact?: boolean }, total: number) => (r.reach > 0 ? `${r.reach} of ${total} subject areas` : 'fact table');

export function ModelStar({ fact, header, rels, total, hot, setHot }: StarProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const fonts = useFontsReady();
  const W = Math.min(width, 1400);
  const L = useMemo(() => (fonts && W >= 700 ? layoutStar(W, fact, header, rels) : null), [fonts, W, fact, header, rels]);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const hotInfo = useMemo(() => {
    if (hot === null || !L) return null;
    if (header && header.table === hot) return { title: header.display, mono: header.name, detail: `header: id = ${header.col}, one header to many lines`, src: SRC_KEY, box: L.header!.box, dir: 0 };
    const d = L.dims.find((n) => n.r.table === hot);
    if (d) return { title: d.r.display, mono: d.r.name, detail: reachLabel(d.r, total), src: SRC_DM, box: d.box, dir: -d.side };
    const c = L.facts.find((n) => n.r.table === hot);
    if (c) return { title: c.r.display, mono: c.r.name, detail: reachLabel(c.r, total), src: SRC_DM, box: c.box, dir: 0 };
    return null;
  }, [hot, L, header, total]);

  // the label sits beside the node on the side towards the centre (over faded lines), or above a card
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip || !hotInfo || !L) { setTipPos(null); return; }
    const tw = tip.offsetWidth, th = tip.offsetHeight, b = hotInfo.box;
    const off = (width - L.W) / 2;
    let x = hotInfo.dir > 0 ? b.x + b.w + 12 : hotInfo.dir < 0 ? b.x - tw - 12 : b.x + b.w / 2 - tw / 2;
    const y = hotInfo.dir === 0 ? b.y - th - 8 : b.y + b.h / 2 - th / 2;
    x = Math.max(-off, Math.min(x, L.W + off - tw));
    setTipPos({ x: x + off, y });
  }, [hotInfo, L, width]);

  const go = (name: string) => (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(carryArea(tablePath(name)));
  };
  const nodeProps = (t: number, name: string, label: string) => ({
    href: carryArea(tablePath(name)),
    onClick: go(name),
    onMouseEnter: () => setHot(t), onMouseLeave: () => setHot(null),
    onFocus: () => setHot(t), onBlur: () => setHot(null),
    'aria-label': label,
    className: hot === t ? 'ms-node on' : 'ms-node',
  });

  return (
    <div className="ms" ref={ref}>
      {L && (
        <svg className={hot !== null ? 'ms-svg has-on' : 'ms-svg'} width={L.W} height={Math.ceil(L.H)} viewBox={`0 0 ${L.W} ${Math.ceil(L.H)}`}
          role="group" aria-label={`${fact.name} and the ${rels.length} tables Oracle’s data model relates it to`}>
          <g aria-hidden="true">
            {L.header && (
              <g className={hot === header!.table ? 'ms-lnk ms-key on' : 'ms-lnk ms-key'}>
                <line x1={L.header.lineX} x2={L.header.lineX} y1={L.header.y1} y2={L.header.y2 - 1} />
                <line x1={L.header.lineX - 5} x2={L.header.lineX + 5} y1={L.header.y1 + 8} y2={L.header.y1 + 8} />
                <path d={`M${L.header.lineX - 5} ${L.header.y2 - 9} L${L.header.lineX} ${L.header.y2 - 1} L${L.header.lineX + 5} ${L.header.y2 - 9}`} />
                <text x={L.header.lineX + 12} y={L.header.y1 + 13} className="ms-s">1</text>
                <text x={L.header.lineX + 12} y={(L.header.y1 + L.header.y2) / 2 + 4} className="ms-keytx">id = {header!.col}</text>
                <text x={L.header.lineX + 12} y={L.header.y2 - 5} className="ms-s">many</text>
              </g>
            )}
            {L.facts.map((n) => (
              <line key={n.r.table} className={hot === n.r.table ? 'ms-lnk on' : 'ms-lnk'} x1={n.from[0]} x2={n.from[0]} y1={n.from[1]} y2={n.box.y} />
            ))}
            {L.dims.map((n) => (
              <line key={n.r.table} className={hot === n.r.table ? 'ms-lnk on' : 'ms-lnk'} x1={n.port[0]} y1={n.port[1]} x2={n.x} y2={n.y} />
            ))}
          </g>

          {/* the fact card */}
          <g className="ms-fact">
            <rect x={L.fact.x} y={L.fact.y} width={L.fact.w} height={L.fact.h} className="ms-card here" />
            <text x={L.fact.x + 18} y={L.fact.y + 28} className="ms-it">fact</text>
            <text x={L.fact.x + L.fact.w - 18} y={L.fact.y + 28} className="ms-it faint" textAnchor="end">this table</text>
            <text x={L.fact.x + 18} y={L.fact.y + 49} className="ms-name">{fact.name}</text>
            {L.grainLines.map((l, i) => <text key={i} x={L.fact.x + 18} y={L.fact.y + 77 + i * 22} className="ms-grain">{l}</text>)}
            {fact.keys.length > 0 && <FactKeys x={L.fact.x + 18} y={L.fact.y + 77 + (L.grainLines.length - 1) * 22 + 25 + (L.grainLines.length ? 0 : -22)} keys={fact.keys} />}
          </g>
          {L.ports.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.2} className="ms-port" aria-hidden="true" />)}

          {L.header && (
            <a {...nodeProps(header!.table, header!.name, `Header ${header!.name}, id = ${header!.col}, one header to many lines, ${SRC_KEY}`)}>
              <rect x={L.header.box.x} y={L.header.box.y} width={L.header.box.w} height={L.header.box.h} className="ms-card" />
              <text x={L.header.box.x + 14} y={L.header.box.y + 21} className="ms-it">header</text>
              <text x={L.header.box.x + 14} y={L.header.box.y + 41} className="ms-mono">{header!.name}</text>
              <text x={L.header.box.x + 14} y={L.header.box.y + 58} className="ms-s">key id</text>
            </a>
          )}
          {L.facts.map((n) => (
            <a key={n.r.table} {...nodeProps(n.r.table, n.r.name, `${n.r.name}, fact table, ${SRC_DM}`)}>
              <rect x={n.box.x} y={n.box.y} width={n.box.w} height={n.box.h} className="ms-card" />
              <text x={n.box.x + 14} y={n.box.y + 18} className="ms-it">fact</text>
              <text x={n.box.x + 14} y={n.box.y + 36} className="ms-mono">{n.r.name}</text>
            </a>
          ))}
          {L.dims.map((n) => {
            const tx = n.x + n.side * 10, an = n.side < 0 ? 'end' : 'start';
            const bw = 44, bx = n.side < 0 ? tx - bw : tx;
            return (
              <a key={n.r.table} {...nodeProps(n.r.table, n.r.name, `${n.r.display}, ${reachLabel(n.r, total)}, ${SRC_DM}`)}>
                <rect x={n.box.x - 4} y={n.box.y} width={n.box.w + 8} height={n.box.h} className="ms-hit" />
                <circle cx={n.x} cy={n.y} r={2.6} className="ms-dot" />
                <text x={tx} y={n.y - 1} textAnchor={an} className="ms-dim">{n.r.display}</text>
                {n.r.reach > 0 && (
                  <>
                    <rect x={bx} y={n.y + 8} width={bw} height={2.5} className="ms-track" />
                    <rect x={bx} y={n.y + 8} width={Math.max(1.5, (bw * n.r.reach) / total)} height={2.5} className="ms-fill" />
                    <text x={n.side < 0 ? bx - 6 : bx + bw + 6} y={n.y + 12} textAnchor={an} className="ms-s">{n.r.reach}</text>
                  </>
                )}
              </a>
            );
          })}
        </svg>
      )}
      {hotInfo && (
        <div ref={tipRef} className="ms-tip" aria-hidden="true" style={{ transform: tipPos ? `translate(${Math.round(tipPos.x)}px, ${Math.round(tipPos.y)}px)` : undefined, visibility: tipPos ? 'visible' : 'hidden' }}>
          <b>{hotInfo.title}</b><span className="sep">·</span><span className="mono">{hotInfo.mono}</span><span className="sep">·</span>{hotInfo.detail}<span className="sep">·</span><i>{hotInfo.src}</i>
        </div>
      )}
    </div>
  );
}

function FactKeys({ x, y, keys }: { x: number; y: number; keys: string[] }) {
  let xx = x;
  const parts: ReactNode[] = [<text key="k" x={xx} y={y} className="ms-it faint">key</text>];
  xx += measure('key', F.it13) + 10;
  keyOrder(keys).forEach((k, i) => {
    if (i) { parts.push(<text key={`p${i}`} x={xx + 2} y={y} className="ms-plus">+</text>); xx += 16; }
    const kw = measure(k, F.mono13);
    parts.push(<text key={k} x={xx} y={y} className="ms-keytx">{k}</text>);
    parts.push(<line key={`u${k}`} x1={xx} x2={xx + kw} y1={y + 4} y2={y + 4} className="ms-kul" />);
    xx += kw + 4;
  });
  return <g>{parts}</g>;
}
