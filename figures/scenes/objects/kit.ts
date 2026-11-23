// Lab drawing kit for the style comparison. Lab only: nothing here is used by the live site.
// Same hand as the rest of the project (rough.js at plotter roughness, fixed seeds, hairline hatching, paper-filled
// faces, one amber accent) but organised around THREE LINE TIERS so a drawing has a visible hierarchy:
//   subject 2.0 px, support 1.1 px, ghost 0.6 px and dimmed.
import { roughPath } from '../../../ink/rough';
import { hatchSegments } from '../../../ink/hatch';
import { el, mulberry32, uid } from '../../../ink/svg';

export type Pt = [number, number];
export type Tier = 'subject' | 'support' | 'ghost';
export type Tone = 'ink' | 'accent';
export const WEIGHT: Record<Tier, number> = { subject: 2, support: 1.1, ghost: 0.6 };
export const GHOST_OPACITY = 0.5;
export const STAGE = { w: 1200, h: 780 };

export const fmt = (n: number): string => n.toFixed(1);
export const ptsD = (p: Pt[], close = true): string => `M${p.map((q) => `${fmt(q[0])} ${fmt(q[1])}`).join('L')}${close ? 'Z' : ''}`;
export const rectPts = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export const bbox = (p: Pt[]): { x0: number; y0: number; x1: number; y1: number } => ({
  x0: Math.min(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), x1: Math.max(...p.map((q) => q[0])), y1: Math.max(...p.map((q) => q[1])),
});

/** a rectangle with chamfered or rounded corners, as points (the rough pass hand-runs it) */
export function roundPts(x: number, y: number, w: number, h: number, r: number, steps = 4): Pt[] {
  const out: Pt[] = [];
  const arc = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= steps; i++) { const a = a0 + (Math.PI / 2) * (i / steps); out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return out;
}

/** a torn edge from a to b: a zigzag with a little seeded irregularity, bulging toward `side` (+1 or -1 of the left normal) */
export function tornPts(a: Pt, b: Pt, tooth: number, amp: number, seed: number, side: 1 | -1 = 1): Pt[] {
  const rnd = mulberry32(seed);
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const n = Math.max(2, Math.round(len / tooth));
  const nx = (-dy / len) * side, ny = (dx / len) * side;
  const out: Pt[] = [a];
  for (let i = 1; i < n; i++) {
    const t = i / n, off = (i % 2 ? amp : 0) * (0.7 + rnd() * 0.6);
    out.push([a[0] + dx * t + nx * off, a[1] + dy * t + ny * off]);
  }
  out.push(b);
  return out;
}

export interface TextOpts {
  size: number; face?: 'serif' | 'mono'; weight?: number; anchor?: 'start' | 'middle' | 'end'; fill?: string;
  italic?: boolean; track?: number; op?: number; rotate?: number;
}

/** the pen: draws into one SVG with a seed counter, so the same code always makes the same drawing */
export class Pen {
  readonly defs: SVGDefsElement;
  private n = 0;
  nss = false;
  /** skip hatching (very small renders) */
  hatchOn = true;

  constructor(readonly svg: SVGSVGElement, readonly base: number, defs?: SVGDefsElement) {
    this.defs = defs ?? (svg.querySelector('defs') as SVGDefsElement) ?? el('defs', {}, svg);
  }

  seed(): number { this.n += 1; return this.base + this.n * 13; }
  g(parent: Element, attrs: Record<string, string | number> = {}): SVGGElement { return el('g', attrs, parent); }
  /** a ghost group: dimmed, thin */
  ghost(parent: Element): SVGGElement { return el('g', { opacity: GHOST_OPACITY }, parent); }

  colour(tone: Tone): string { return tone === 'accent' ? 'var(--accent)' : 'var(--ink)'; }

  /** a hand-run stroke of a clean path */
  stroke(parent: Element, d: string, tier: Tier, tone: Tone = 'ink', o: { rough?: number; dash?: string; colour?: string; w?: number; op?: number } = {}): SVGPathElement {
    const rd = roughPath(d, this.seed(), { roughness: o.rough ?? 0.35 });
    const p = el('path', {
      d: rd, fill: 'none', stroke: o.colour ?? this.colour(tone), 'stroke-width': o.w ?? WEIGHT[tier],
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-r': o.dash ? 'f' : 's',
    }, parent);
    if (o.dash) p.setAttribute('stroke-dasharray', o.dash);
    if (o.op !== undefined) p.setAttribute('opacity', String(o.op));
    if (this.nss) p.setAttribute('vector-effect', 'non-scaling-stroke');
    return p;
  }

  /** a straight, un-roughened hairline (ticks, rules, hatch) */
  hair(parent: Element, d: string, o: { w?: number; colour?: string; op?: number; dash?: string } = {}): SVGPathElement {
    const p = el('path', { d, fill: 'none', stroke: o.colour ?? 'var(--ink)', 'stroke-width': o.w ?? WEIGHT.ghost, 'stroke-linecap': 'round', opacity: o.op ?? 0.7, 'data-r': o.dash ? 'f' : 's' }, parent);
    if (o.dash) p.setAttribute('stroke-dasharray', o.dash);
    if (this.nss) p.setAttribute('vector-effect', 'non-scaling-stroke');
    return p;
  }

  fill(parent: Element, d: string, colour = 'var(--paper-2)'): SVGPathElement {
    return el('path', { d, fill: colour, stroke: 'none', 'data-r': 'f' }, parent);
  }

  /** parallel hairlines clipped to a clean path: shade, never a fill */
  hatch(parent: Element, clipD: string, r: { x0: number; y0: number; x1: number; y1: number }, angle = 45, gap = 3.6, op = 0.65): void {
    if (!this.hatchOn) return;
    const id = uid('hc');
    const cp = el('clipPath', { id }, this.defs);
    el('path', { d: clipD }, cp);
    const g = el('g', { 'clip-path': `url(#${id})` }, parent);
    const d = hatchSegments(r, angle, gap).map((s) => `M${fmt(s[0])} ${fmt(s[1])}L${fmt(s[2])} ${fmt(s[3])}`).join('');
    this.hair(g, d, { op });
  }

  /**
   * A solid thing: its own thickness (a hatched offset face behind), paper-filled front, hand-run outline.
   * Returns the clean path of the front face.
   */
  solid(parent: Element, pts: Pt[], tier: Tier, tone: Tone = 'ink', o: { shade?: Pt | null; angle?: number; gap?: number; closed?: boolean } = {}): string {
    const d = ptsD(pts);
    const sh = o.shade === undefined ? ([5, 5] as Pt) : o.shade;
    const g = this.g(parent);
    if (sh) {
      const shg = this.g(g, { class: 'shade' });
      const sp = pts.map((q): Pt => [q[0] + sh[0], q[1] + sh[1]]);
      const sd = ptsD(sp);
      this.fill(shg, sd);
      this.hatch(shg, sd, bbox(sp), o.angle ?? 45, o.gap ?? 3.6);
      this.stroke(shg, sd, 'ghost', tone, { op: 0.9 });
    }
    this.fill(g, d);
    this.stroke(g, d, tier, tone);
    return d;
  }

  text(parent: Element, x: number, y: number, s: string, o: TextOpts): SVGTextElement {
    const t = el('text', { x: fmt(x), y: fmt(y), 'text-anchor': o.anchor ?? 'start' }, parent);
    t.textContent = s;
    const fam = (o.face ?? 'serif') === 'mono' ? 'var(--mono)' : 'var(--serif)';
    let style = `font-family:${fam};font-size:${o.size}px;font-weight:${o.weight ?? 400};fill:${o.fill ?? 'var(--ink)'};`;
    if (o.italic) style += 'font-style:italic;';
    if (o.track) style += `letter-spacing:${o.track}em;`;
    if (o.op !== undefined) style += `opacity:${o.op};`;
    t.setAttribute('style', style);
    t.setAttribute('data-r', 't');
    if (o.rotate) t.setAttribute('transform', `rotate(${o.rotate} ${fmt(x)} ${fmt(y)})`);
    return t;
  }

  /** a punched hole with a reinforcing ring (an eyelet). The page shows through it. */
  eyelet(parent: Element, cx: number, cy: number, tier: Tier = 'support', tone: Tone = 'ink', r = 7): Pt {
    const g = this.g(parent);
    el('circle', { cx: fmt(cx), cy: fmt(cy), r: fmt(r + 3.5), fill: 'var(--paper-2)', stroke: 'none', 'data-r': 'f' }, g);
    this.stroke(g, circD(cx, cy, r + 3.5), 'ghost', tone, { op: 0.9 });
    el('circle', { cx: fmt(cx), cy: fmt(cy), r: fmt(r), fill: 'var(--paper)', stroke: 'none', 'data-r': 'f' }, g);
    this.stroke(g, circD(cx, cy, r), tier === 'ghost' ? 'ghost' : 'support', tone, { rough: 0.2 });
    return [cx, cy];
  }

  /** an overhand knot: a small dark bead with two short tails */
  knot(parent: Element, x: number, y: number, tone: Tone = 'ink', ang = 0): void {
    const c = this.colour(tone);
    const g = this.g(parent, { transform: `rotate(${ang} ${fmt(x)} ${fmt(y)})` });
    el('circle', { cx: fmt(x), cy: fmt(y), r: 2.5, fill: c, stroke: 'none', 'data-r': 'f' }, g);
    this.hair(g, `M${fmt(x)} ${fmt(y)}q4 -2 9 3`, { w: 1.1, colour: c, op: 1 });
    this.hair(g, `M${fmt(x)} ${fmt(y)}q3 4 8 5`, { w: 1.1, colour: c, op: 1 });
  }

  /** a string tied between two eyelets: a sagging curve, a knot at each end */
  string(parent: Element, a: Pt, b: Pt, tier: Tier, tone: Tone = 'ink', sag = 24, w?: number): void {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2 + sag;
    const d = `M${fmt(a[0])} ${fmt(a[1])}Q${fmt(cx)} ${fmt(cy)} ${fmt(b[0])} ${fmt(b[1])}`;
    this.stroke(parent, d, tier, tone, { rough: 0.25, w });
    const ang = (Math.atan2(cy - a[1], cx - a[0]) * 180) / Math.PI;
    if (tier !== 'ghost') { this.knot(parent, a[0], a[1], tone, ang); this.knot(parent, b[0], b[1], tone, ang + 180); }
  }

  /** a simple person: head and shoulders (the customer glyph) */
  person(parent: Element, cx: number, cy: number, s: number, tier: Tier = 'support'): void {
    const head = circD(cx, cy - 0.5 * s, 0.32 * s);
    this.fill(parent, head);
    this.stroke(parent, head, tier);
    const sh = `M${fmt(cx - 0.62 * s)} ${fmt(cy + 0.95 * s)}C${fmt(cx - 0.62 * s)} ${fmt(cy + 0.2 * s)} ${fmt(cx - 0.3 * s)} ${fmt(cy + 0.05 * s)} ${fmt(cx)} ${fmt(cy + 0.05 * s)}C${fmt(cx + 0.3 * s)} ${fmt(cy + 0.05 * s)} ${fmt(cx + 0.62 * s)} ${fmt(cy + 0.2 * s)} ${fmt(cx + 0.62 * s)} ${fmt(cy + 0.95 * s)}Z`;
    this.fill(parent, sh);
    this.stroke(parent, sh, tier);
  }
}

export function circD(cx: number, cy: number, r: number): string {
  return `M${fmt(cx - r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}Z`;
}

/** monospace advance, for placing things next to mono text */
export const monoW = (s: string, size: number): number => s.length * size * 0.6;
