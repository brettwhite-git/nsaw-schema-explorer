// Drawing kit for the "grand patisserie" homage sketches. Flat fills, one cocoa line weight, strings in, strings out.
import { LOOKS, POSES, solveFigure, paintFigure, type Pose } from '../../figures/scenes/figures';
import { el } from '../../ink/svg';

export const C = {
  pink: '#F2C4CE', rose: '#E3A0B4', deep: '#C45A7A', lav: '#BBA6D2', plum: '#5B3A7A', red: '#B3262B', must: '#D9A441',
  blue: '#A9CCE3', mint: '#BFDCCB', teal: '#2F6F73', cream: '#F6EBDD', cocoa: '#3B2A2A',
  roseD: '#CF7F99', creamD: '#E6D3BB', mustD: '#B98A2C', blueD: '#86B0CB', lavD: '#9F89BC', redD: '#8A1B20', tealD: '#245659',
  mintD: '#9FC7B0', paper: '#FFF8EE', ribbon: '#2F4FCB', ribbonD: '#2239A3', sky: '#D5E6EE', plumD: '#47295F',
};
export const SW = 2.5;
export const FONT = { sans: "'Jost','Josefin Sans','Futura','Century Gothic',sans-serif", serif: "'Playfair Display','Didot','Georgia',serif" };

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const n2 = (v: number): number => Math.round(v * 100) / 100;
export interface St { stroke?: string; sw?: number; op?: number; rx?: number; dash?: string; extra?: string }
const sty = (o: St): string => (o.stroke ? ` stroke="${o.stroke}"` : '') + (o.sw != null ? ` stroke-width="${o.sw}"` : '') + (o.op != null ? ` opacity="${o.op}"` : '') + (o.dash ? ` stroke-dasharray="${o.dash}"` : '') + (o.extra ?? '');

export const R = (x: number, y: number, w: number, h: number, fill: string, o: St = {}): string => `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}"${o.rx ? ` rx="${o.rx}"` : ''} fill="${fill}"${sty(o)}/>`;
export const P = (d: string, fill: string, o: St = {}): string => `<path d="${d}" fill="${fill}"${sty(o)}/>`;
export const Ci = (cx: number, cy: number, r: number, fill: string, o: St = {}): string => `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="${fill}"${sty(o)}/>`;
export const El = (cx: number, cy: number, rx: number, ry: number, fill: string, o: St & { rot?: number } = {}): string => `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(rx)}" ry="${n2(ry)}" fill="${fill}"${o.rot ? ` transform="rotate(${o.rot} ${n2(cx)} ${n2(cy)})"` : ''}${sty(o)}/>`;
export const Ln = (x1: number, y1: number, x2: number, y2: number, o: St = {}): string => `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" fill="none"${sty(o)}/>`;
export const H = (x: number, y: number, w: number, h: number): string => R(x, y, w, h, 'url(#hat)', { stroke: 'none' });

export interface Tx { anchor?: 'start' | 'middle' | 'end'; fill?: string; font?: 'sans' | 'serif'; weight?: number; track?: number; italic?: boolean; caps?: boolean; op?: number }
export const T = (x: number, y: number, s: string, size: number, o: Tx = {}): string => {
  const font = o.font ?? 'sans';
  const caps = o.caps ?? font === 'sans';
  const track = o.track ?? (caps ? 0.14 : 0);
  return `<text x="${n2(x)}" y="${n2(y)}" font-family="${FONT[font]}" font-size="${size}" font-weight="${o.weight ?? (font === 'sans' ? 500 : 400)}" ${o.italic ? 'font-style="italic" ' : ''}letter-spacing="${track}em" text-anchor="${o.anchor ?? 'middle'}" fill="${o.fill ?? C.cocoa}" stroke="none"${o.op != null ? ` opacity="${o.op}"` : ''}>${esc(caps ? s.toUpperCase() : s)}</text>`;
};

/** stage-level placement: scale s, line weight kept at sw stage units */
export const put = (x: number, y: number, s: number, inner: string, sw = SW): string => `<g transform="translate(${n2(x)} ${n2(y)}) scale(${n2(s)})" stroke-width="${n2(sw / s)}">${inner}</g>`;
/** draw inner, then its reflection about the vertical line x = cx (shapes only, not text) */
export const mirror = (inner: string, cx = 400): string => `${inner}<g transform="translate(${cx * 2} 0) scale(-1 1)">${inner}</g>`;

export const DEFS = `<defs><pattern id="hat" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${C.cocoa}" stroke-width="1.1" opacity=".3"/></pattern>
<linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9DFEA"/><stop offset=".7" stop-color="#EEF1EA"/><stop offset="1" stop-color="#F6EBDD"/></linearGradient></defs>`;

export const svgWrap = (inner: string, cls = 'stage'): string => `<svg class="${cls}" viewBox="0 0 1200 750" xmlns="http://www.w3.org/2000/svg" role="img">${DEFS}<g fill="none" stroke="${C.cocoa}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;

/** passe-partout: coloured mat, cream inner rule, cocoa rule; returns frame shapes drawn first and the picture rect */
export function mat(color: string, inner = ''): string {
  return R(0, 0, 1200, 750, C.cream, { stroke: 'none' }) + R(12, 12, 1176, 726, color, { sw: 2 }) + inner + R(24, 24, 1152, 702, 'none', { sw: 3 }) + R(30, 30, 1140, 690, 'none', { sw: 1, op: 0.6 });
}

// ---------- the pastry box (the one saturated accent) ----------
export function heroBox(x: number, y: number, w: number, mono = false): string {
  const bh = 0.6 * w, lh = 0.2 * w, bw = 0.15 * w, by = -bh - lh;
  let s = El(0, 2, w * 0.56, w * 0.05, C.cocoa, { stroke: 'none', op: 0.18 });
  s += R(-w / 2, -bh, w, bh, C.paper) + R(-w / 2 - w * 0.03, by, w * 1.06, lh, C.paper);
  s += R(-bw / 2, -bh, bw, bh, C.ribbon) + R(-bw / 2, by, bw, lh, C.ribbon);
  s += El(-w * 0.13, by - w * 0.06, w * 0.14, w * 0.065, C.ribbon, { rot: -22 }) + El(w * 0.13, by - w * 0.06, w * 0.14, w * 0.065, C.ribbon, { rot: 22 });
  s += Ci(0, by - w * 0.035, w * 0.05, C.ribbonD);
  const mx = -w * 0.3, my = -bh * 0.5;
  s += Ci(mx, my, w * 0.12, C.cream);
  if (mono) s += T(mx, my + w * 0.04, 'A&F', Math.max(9, w * 0.105), { font: 'serif', caps: false, weight: 700, track: 0 });
  else s += Ci(mx, my, w * 0.045, C.ribbon, { stroke: 'none' });
  return `<g transform="translate(${n2(x)} ${n2(y)})">${s}</g>`;
}
/** a plain shelf box with a muted band */
export function plainBox(x: number, y: number, w: number, band = C.blueD): string {
  const bh = 0.6 * w, lh = 0.2 * w;
  return `<g transform="translate(${n2(x)} ${n2(y)})">${R(-w / 2, -bh, w, bh, C.paper)}${R(-w / 2 - 1.5, -bh - lh, w + 3, lh, C.cream)}${R(-w * 0.34, -bh + bh * 0.3, w * 0.68, bh * 0.16, band, { stroke: 'none' })}</g>`;
}

// ---------- front-facing flat figure ----------
export interface Person { x: number; y: number; h: number; coat: string; detail?: 'apron' | 'gloves' | 'cap' | 'cravat' | 'buttons'; hat?: 'cap' | 'pill' | 'none'; hands?: [[number, number], [number, number]]; legs?: boolean; band?: string }
export function person(p: Person): string {
  const { x, y, h, coat } = p;
  const sw = h * 0.15, hw = h * 0.175, ty = y - 0.78 * h, by = y - 0.38 * h, r = 0.085 * h, hy = y - 0.855 * h;
  const lw = h * 0.085, aw = h * 0.056, line = Math.max(2, h * 0.012);
  let s = '';
  if (p.legs !== false) {
    s += R(x - lw - h * 0.01, by, lw, y - by - 0.02 * h, coat) + R(x + h * 0.01, by, lw, y - by - 0.02 * h, coat);
    s += El(x - lw / 2 - h * 0.01, y - 0.012 * h, lw * 0.75, h * 0.02, C.cocoa) + El(x + lw / 2 + h * 0.01, y - 0.012 * h, lw * 0.75, h * 0.02, C.cocoa);
  }
  s += P(`M${x - sw},${ty + 0.05 * h}Q${x - sw},${ty} ${x - sw + 0.04 * h},${ty}L${x + sw - 0.04 * h},${ty}Q${x + sw},${ty} ${x + sw},${ty + 0.05 * h}L${x + hw},${by}L${x - hw},${by}Z`, coat);
  const hands = p.hands ?? [[x - hw - 0.03 * h, y - 0.43 * h], [x + hw + 0.03 * h, y - 0.43 * h]];
  const handFill = p.detail === 'gloves' ? C.cream : coat;
  const arm = (side: -1 | 1, hd: [number, number]): string => {
    const sx = x + side * (sw - 0.02 * h), sy = ty + 0.045 * h;
    const cx = (sx + hd[0]) / 2 + side * 0.05 * h, cy = (sy + hd[1]) / 2 + 0.02 * h;
    const d = `M${n2(sx)},${n2(sy)}Q${n2(cx)},${n2(cy)} ${n2(hd[0])},${n2(hd[1])}`;
    return `<path d="${d}" fill="none" stroke="${C.cocoa}" stroke-width="${n2(aw + line * 2)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${coat}" stroke-width="${n2(aw)}" stroke-linecap="round"/>`;
  };
  if (p.detail === 'apron') s += P(`M${x - 0.1 * h},${ty + 0.1 * h}L${x + 0.1 * h},${ty + 0.1 * h}L${x + 0.14 * h},${by + 0.02 * h}L${x - 0.14 * h},${by + 0.02 * h}Z`, C.cream) + Ln(x - 0.1 * h, ty + 0.1 * h, x - sw * 0.7, ty + 0.02 * h) + Ln(x + 0.1 * h, ty + 0.1 * h, x + sw * 0.7, ty + 0.02 * h);
  if (p.detail === 'cravat') s += P(`M${x},${ty + 0.02 * h}L${x - 0.05 * h},${ty + 0.12 * h}L${x + 0.05 * h},${ty + 0.12 * h}Z`, C.cream);
  if (p.detail === 'buttons') for (const j of [0.12, 0.2, 0.28]) for (const dx of [-0.035, 0.035]) s += Ci(x + dx * h, ty + j * h, h * 0.011, C.must, { sw: 1 });
  s += arm(-1, hands[0]) + arm(1, hands[1]);
  if (p.detail === 'gloves') s += Ci(hands[0][0], hands[0][1], h * 0.04, C.cream) + Ci(hands[1][0], hands[1][1], h * 0.04, C.cream);
  else s += Ci(hands[0][0], hands[0][1], h * 0.036, handFill) + Ci(hands[1][0], hands[1][1], h * 0.036, handFill);
  s += Ci(x, hy, r, coat);
  const hat = p.hat ?? 'none';
  if (hat === 'cap') s += P(`M${x - r * 1.1},${hy - r * 0.15}Q${x},${hy - r * 1.9} ${x + r * 1.1},${hy - r * 0.15}Z`, coat) + R(x - r * 1.1, hy - r * 0.35, r * 2.2, r * 0.3, p.band ?? C.cream, { sw: 1.5 }) + R(x - r * 1.25, hy - r * 0.15, r * 2.5, r * 0.2, coat);
  if (hat === 'pill') s += R(x - r * 0.95, hy - r * 1.55, r * 1.9, r * 1.0, coat) + R(x - r * 0.95, hy - r * 0.95, r * 1.9, r * 0.22, p.band ?? C.cream, { sw: 1.5 });
  return s;
}

/** the silhouette system from figures/scenes, painted as one flat coloured shape with cocoa limb lines */
export function silhouette(look: keyof typeof LOOKS, pose: keyof typeof POSES | Pose, x: number, y: number, H: number, fill: string, flip = false): string {
  const s = solveFigure(LOOKS[look], typeof pose === 'string' ? POSES[pose] : pose, { x, y, H, flip });
  const g = el('g', { style: `--paper-2:${C.cocoa}` });
  paintFigure(g, s, H, fill);
  return g.outerHTML;
}

/** cards, torn along the top */
export function card(x: number, y: number, w: number, h: number, lines: string[], o: { torn?: boolean; tag?: string; size?: number } = {}): string {
  const z = o.size ?? 13;
  let top = `M${x},${y}`;
  if (o.torn) { const n = 9, dx = w / n; for (let i = 1; i <= n; i++) top += `L${n2(x + dx * (i - 0.5))},${y + (i % 2 ? -5 : 3)}L${n2(x + dx * i)},${y}`; } else top += `L${x + w},${y}`;
  let s = P(`${top}L${x + w},${y + h}L${x},${y + h}Z`, C.paper);
  lines.forEach((l, i) => { s += T(x + w / 2, y + 22 + i * (z + 6), l, z, { caps: i === 0, track: i === 0 ? 0.1 : 0, font: i === 0 ? 'sans' : 'sans', weight: i === 0 ? 600 : 500 }); });
  if (o.tag) s += R(x + w - 14, y - 2, 10, h * 0.6, o.tag, { stroke: 'none' }) + Ln(x + w - 9, y - 2, x + w - 9, y + h * 0.6 - 2, { sw: 1 });
  return s;
}

export function plate(x: number, y: number, w: number, h: number, text: string, size = 13, fill = C.cream, tfill = C.cocoa): string {
  return R(x - w / 2, y - h / 2, w, h, fill, { rx: 3 }) + R(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 'none', { sw: 1, op: 0.7 }) + T(x, y + size * 0.35, text, size, { fill: tfill, weight: 600 });
}
