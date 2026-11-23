// The pastry shop interior: flat-on, symmetrical. Shelves of ribboned boxes, a marble counter with a bell, one worker, and the followed box.
import { Rng, mix } from './rng';
import { Kit, PAL, Pt, Scene, arc, archPts, bays, lighten, shade, smooth } from './kit';

const W = 1200, H = 750, CX = 600;
const rot = (pts: Pt[], ox: number, oy: number, a: number): Pt[] => pts.map(([x, y]) => [ox + (x - ox) * Math.cos(a) - (y - oy) * Math.sin(a), oy + (x - ox) * Math.sin(a) + (y - oy) * Math.cos(a)]);

export function box(k: Kit, x: number, yb: number, w: number, h: number, a: number, ribbon: string, mono = false, big = false): void {
  const T = (p: Pt[]): Pt[] => rot(p.map(([px, py]): Pt => [x + px, yb + py]), x, yb, a);
  const cream = '#F5E7CF';
  k.poly(T([[-w / 2, 0], [w / 2, 0], [w / 2, -h], [-w / 2, -h]]), cream, 'box', { ink: 1, knock: 1 });
  k.glaze(T([[w * 0.2, 0], [w / 2, 0], [w / 2, -h], [w * 0.2, -h]]), '#9C86A6', 0.42);
  k.poly(T([[-w / 2 - 2, -h], [w / 2 + 2, -h], [w / 2 + 2, -h + 9], [-w / 2 - 2, -h + 9]]), lighten(cream, 0.4), 'box', { ink: 1, knock: 1 });
  k.glaze(T([[-w / 2, -h + 9], [w / 2, -h + 9], [w / 2, -h + 14], [-w / 2, -h + 14]]), '#8E7A98', 0.4);
  const rw = big ? 12 : 6.5;
  k.poly(T([[-rw / 2, 0], [rw / 2, 0], [rw / 2, -h], [-rw / 2, -h]]), ribbon, 'ribbon', { ink: big ? 1 : 0, knock: 1 });
  k.glaze(T([[rw * 0.15, 0], [rw / 2, 0], [rw / 2, -h], [rw * 0.15, -h]]), shade(ribbon, 0.6), 0.5);
  // bow: two loops, a knot and two tails
  const bs = big ? 2.1 : 1;
  const L = T([[0, -h - 1], [-9 * bs, -h - 7 * bs], [-12 * bs, -h - 1], [-9 * bs, -h + 3 * bs]]), R = T([[0, -h - 1], [9 * bs, -h - 7 * bs], [12 * bs, -h - 1], [9 * bs, -h + 3 * bs]]);
  k.poly(L, ribbon, 'ribbon', { ink: 1, knock: 1 }); k.poly(R, ribbon, 'ribbon', { ink: 1, knock: 1 });
  k.glaze(R, shade(ribbon, 0.6), 0.5);
  k.poly(T([[-2 * bs, -h - 4 * bs], [2 * bs, -h - 4 * bs], [2 * bs, -h + bs], [-2 * bs, -h + bs]]), shade(ribbon, 0.15), 'ribbon', { ink: 1, knock: 1 });
  if (big) { k.poly(T([[-3, -h + 6], [-8, -h + 20], [-3, -h + 18]]), ribbon, 'ribbon', { ink: 1, knock: 1 }); k.poly(T([[3, -h + 6], [8, -h + 22], [3, -h + 19]]), ribbon, 'ribbon', { ink: 1, knock: 1 }); }
  if (mono) k.poly(T(arc(-w * 0.28, -h * 0.4, 4.2, 4.2, 0, 2 * Math.PI, 8)), PAL.gold, 'gold', { ink: 1, knock: 1 });
}

function shelfUnit(k: Kit, rng: Rng, x0: number, x1: number): void {
  const wood = '#7A4A44', ys = [215, 315, 415, 515];
  k.rect(x0, 130, x1 - x0, 400, '#C98E9E', 'wall', { ink: 1, knock: 1 });
  k.glaze([[x0, 130], [x0 + 18, 130], [x0 + 18, 530], [x0, 530]], '#6B4B7A', 0.25);
  k.rect(x0 - 12, 120, x1 - x0 + 24, 14, wood, 'wood', { ink: 1, knock: 1 });
  k.rect(x0 - 12, 120, x1 - x0 + 24, 4, lighten(wood, 0.3), 'wood', { knock: 1 });
  for (const ux of [x0 - 12, x1]) { k.rect(ux, 120, 12, 424, wood, 'wood', { ink: 1, knock: 1 }); k.glaze([[ux + 8, 124], [ux + 12, 124], [ux + 12, 544], [ux + 8, 544]], '#3B2230', 0.4); }
  const ribbons = ['#D98A9C', '#8FA8C8', '#B7A2CC', '#E3A37E', '#9DB8A6'];
  ys.forEach((y, row) => {
    let x = x0 + 8 + rng.range(0, 10);
    while (x < x1 - 50) {
      const w = rng.range(40, 66), h = rng.range(30, 52);
      if (x + w > x1 - 6) break;
      const cx = x + w / 2;
      const tilt = rng.chance(0.12) ? rng.range(-0.16, 0.16) : rng.range(-0.012, 0.012);
      box(k, cx, y, w, h, tilt, rng.pick(ribbons), rng.chance(0.25));
      if (rng.chance(0.2) && h < 44) box(k, cx + rng.range(-5, 5), y - h, w * rng.range(0.7, 0.9), rng.range(22, 30), rng.range(-0.05, 0.05), rng.pick(ribbons));
      x += w + rng.range(1, 9);
    }
    k.rect(x0 - 2, y, x1 - x0 + 4, 9, wood, 'wood', { ink: 1, knock: 1 });
    k.rect(x0 - 2, y, x1 - x0 + 4, 3, lighten(wood, 0.35), 'wood', { knock: 1 });
    k.glaze([[x0, y + 9], [x1, y + 9], [x1, y + 20], [x0, y + 20]], '#4A2D3E', 0.4);
    void row;
  });
  // hand-placed accidents: one leaning against an upright, one fallen flat on a lower shelf, one box slipped half off the edge
  box(k, x1 - 36, ys[1], 44, 44, -0.3, '#D98A9C');
  box(k, x0 + 70, ys[2] - 10, 70, 22, 0.05, '#8FA8C8', true);
}

function window_(k: Kit): void {
  const cx = CX, yb = 450, w = 190, h = 360;
  k.poly(archPts(cx, yb, w + 26, h + 18, 22), '#6B3E3A', 'wood', { ink: 2, knock: 1 });
  const half = (y: number): number => { const r = w / 2, ys = yb - h + r; if (y >= ys) return r; const d = ys - y; return Math.sqrt(Math.max(0, r * r - d * d)); };
  const bands = ['#8A8DB8', '#9D96BC', '#B79DB6', '#CDA2B4', '#E1AEB2', '#EEB8AC', '#F3C3A6', '#F6CDB0'];
  const top = yb - h, step = h / bands.length;
  bands.forEach((c, i) => {
    const y0 = top + i * step - 6, y1 = top + (i + 1) * step + 6, pts: Pt[] = [];
    for (let y = Math.max(top, y0); y <= Math.min(yb, y1); y += 6) pts.push([cx - half(y), y]);
    for (let y = Math.min(yb, y1); y >= Math.max(top, y0); y -= 6) pts.push([cx + half(y), y]);
    k.poly(pts, c, 'sky', { knock: 1 });
  });
  // a glimpse of the hill: mountains, snow, one lit house
  k.poly([[cx - 95, 330], [cx - 60, 280], [cx - 30, 312], [cx + 10, 262], [cx + 52, 318], [cx + 95, 288], [cx + 95, 400], [cx - 95, 400]], '#8F88AD', 'far', { knock: 1 });
  k.poly([[cx - 10, 276], [cx + 10, 262], [cx + 24, 288], [cx + 6, 282]], '#EEE7EE', 'snow', { knock: 1 });
  k.poly([[cx - 95, 376], [cx - 40, 360], [cx + 30, 372], [cx + 95, 356], [cx + 95, 450], [cx - 95, 450]], '#E4DAEA', 'snow', { knock: 1 });
  [[-70, 380, 26], [-52, 386, 20], [64, 378, 24], [80, 384, 18], [-30, 396, 14]].forEach(([dx, y, hh]) => { const x = cx + dx; k.poly([[x, y - hh], [x - hh * 0.3, y], [x + hh * 0.3, y]], '#3F5C59', 'pine', { knock: 1 }); });
  k.poly(archPts(cx + 40, 395, 10, 14, 6), PAL.glassLit, 'glow', { ink: 1, knock: 1 });
  k.line(arc(cx, yb - h + w / 2, w / 2, w / 2, Math.PI, 2 * Math.PI, 24), '#6B3E3A', 4, 0.9);
  k.line([[cx, yb], [cx, yb - h]], '#6B3E3A', 5, 0.95); k.line([[cx - w / 2, yb - h * 0.55], [cx + w / 2, yb - h * 0.55]], '#6B3E3A', 5, 0.95);
  k.glaze([[cx + w / 2 - 20, top + 90], [cx + w / 2, top + 150], [cx + w / 2, yb], [cx + w / 2 - 20, yb]], '#4A3A68', 0.25);
  k.rect(cx - w / 2 - 20, yb, w + 40, 12, lighten('#6B3E3A', 0.2), 'wood', { ink: 1, knock: 1 });
  // monogram medallion
  k.poly(arc(cx, 88, 34, 34, 0, 2 * Math.PI, 24), PAL.plum, 'plum', { ink: 2, knock: 1 });
  k.line(arc(cx, 88, 29, 29, 0, 2 * Math.PI, 24), PAL.gold, 1.6, 0.95);
}

function lamp(k: Kit, x: number): void {
  k.poly(arc(x, 150, 60, 60, 0, 2 * Math.PI, 20), '#FFE0A8', 'mist', { alpha: 0.5, knock: 0 });
  k.poly(arc(x, 150, 34, 34, 0, 2 * Math.PI, 16), '#FFE7B8', 'mist', { alpha: 0.5, knock: 0 });
  k.line([[x, 0], [x, 108]], PAL.ink, 1.4, 0.8);
  k.poly([[x - 4, 106], [x + 4, 106], [x + 5, 112], [x - 5, 112]], PAL.gold, 'gold', { ink: 1, knock: 1 });
  k.poly([...arc(x, 150, 34, 38, Math.PI, 2 * Math.PI, 14), [x + 38, 156], [x - 38, 156]], PAL.plum, 'plum', { ink: 2, knock: 1 });
  k.glaze([[x + 12, 112], ...arc(x, 150, 34, 38, 1.65 * Math.PI, 2 * Math.PI, 5), [x + 38, 156], [x + 16, 156]], '#1F0F26', 0.35);
  k.poly([[x - 36, 156], [x + 36, 156], [x + 26, 172], [x - 26, 172]], '#FFD58A', 'glow', { ink: 1, knock: 1 });
  k.line([[x - 38, 156], [x + 38, 156]], PAL.gold, 2.2, 0.95);
}

function counter(k: Kit, rng: Rng): void {
  const x0 = 250, x1 = 950;
  // plum wood front with gold panel trim
  k.rect(x0, 522, x1 - x0, 126, '#6E3C5A', 'plum', { ink: 2, knock: 1 });
  for (let i = 0; i < 6; i++) { const px = x0 + 20 + i * ((x1 - x0 - 40) / 6) + 6, pw = (x1 - x0 - 40) / 6 - 12; k.rect(px, 540, pw, 90, '#7E4A68', 'plum', { ink: 1, knock: 1 }); k.line([[px + 4, 544], [px + pw - 4, 544], [px + pw - 4, 626], [px + 4, 626], [px + 4, 544]], PAL.gold, 1.1, 0.8); k.glaze([[px + pw * 0.7, 540], [px + pw, 540], [px + pw, 630], [px + pw * 0.7, 630]], '#2D1226', 0.28); }
  k.rect(x0, 640, x1 - x0, 10, '#4A2440', 'plum', { ink: 1, knock: 1 });
  k.glaze([[x0, 522], [x1, 522], [x1, 540], [x0, 540]], '#1F0F26', 0.35);
  // marble slab, veined
  k.poly([[x0 - 22, 504], [x1 + 22, 504], [x1 + 14, 524], [x0 - 14, 524]], '#EDE2E4', 'stone', { ink: 2, knock: 1 });
  k.poly([[x0 - 14, 524], [x1 + 14, 524], [x1 + 14, 528], [x0 - 14, 528]], '#BFAFB8', 'stone', { ink: 1, knock: 1 });
  k.glaze([[x0 - 22, 504], [x0 + 230, 504], [x0 + 220, 524], [x0 - 14, 524]], '#FFFFFF', 0.0);
  for (let i = 0; i < 18; i++) { const x = rng.range(x0, x1), y = 506 + rng.range(0, 14); k.line([[x, y], [x + rng.range(20, 60), y + rng.range(-3, 3)], [x + rng.range(60, 110), y + rng.range(-4, 4)]], i % 3 ? '#B8A0B4' : '#D6A8B0', 0.8, 0.5); }
  k.glaze([[x1 - 160, 504], [x1 + 22, 504], [x1 + 14, 524], [x1 - 170, 524]], '#9C86A6', 0.3);
  k.poly([[x0 - 14, 528], [x1 + 14, 528], [x1 + 14, 540], [x0 - 14, 540]], '#4A2440', 'plum', { alpha: 0.35, knock: 0 });
}

function bell(k: Kit, x: number): void {
  const y = 504;
  k.poly([[x - 26, y], [x + 26, y], [x + 22, y - 6], [x - 22, y - 6]], PAL.gold, 'gold', { ink: 1, knock: 1 });
  k.poly([[x - 20, y - 6], ...arc(x, y - 6, 20, 34, Math.PI, 2 * Math.PI, 14).slice(1, -1), [x + 20, y - 6]], '#E2B552', 'gold', { ink: 2, knock: 1 });
  k.glaze([[x + 6, y - 6], ...arc(x, y - 6, 20, 34, 1.6 * Math.PI, 2 * Math.PI, 6), [x + 20, y - 6]], '#8A5A1C', 0.5);
  k.poly([[x - 12, y - 30], [x - 6, y - 38], [x - 8, y - 24]], '#FFF1C8', 'gold', { alpha: 0.9, knock: 0 });
  k.poly(arc(x, y - 42, 4, 4, 0, 2 * Math.PI, 8), PAL.gold, 'gold', { ink: 1, knock: 1 });
  k.poly([[x - 4, y - 38], [x + 4, y - 38], [x + 3, y - 36], [x - 3, y - 36]], '#7A5A1C', 'gold', { knock: 1 });
}
function deskLamp(k: Kit, x: number): void {
  const y = 504;
  k.poly([[x - 16, y], [x + 16, y], [x + 12, y - 6], [x - 12, y - 6]], PAL.gold, 'gold', { ink: 1, knock: 1 });
  k.rect(x - 2, y - 44, 4, 38, PAL.gold, 'gold', { ink: 1, knock: 1 });
  k.poly(arc(x, y - 64, 52, 52, 0, 2 * Math.PI, 18), '#FFE0A8', 'mist', { alpha: 0.5, knock: 0 });
  k.poly([[x - 22, y - 42], [x + 22, y - 42], [x + 14, y - 72], [x - 14, y - 72]], '#F5D3DA', 'glow', { ink: 2, knock: 1 });
  k.glaze([[x + 8, y - 42], [x + 22, y - 42], [x + 14, y - 72], [x + 8, y - 72]], '#B88AA0', 0.45);
  k.poly([[x - 12, y - 74], [x + 12, y - 74], [x + 8, y - 78], [x - 8, y - 78]], PAL.gold, 'gold', { ink: 1, knock: 1 });
}

function worker(k: Kit, face: boolean): void {
  const skin = '#EBB99C', uni = '#6D4C7E', apron = '#F6EAD6', cx = CX;
  const sh = (p: Pt[], a = 0.4, c = '#4A3668'): void => k.glaze(p, c, a);
  // shoulders + torso (uniform), slightly rounded, narrower at waist
  const torso = smooth([[cx - 58, 322], [cx - 40, 312], [cx - 14, 308], [cx + 14, 308], [cx + 40, 312], [cx + 58, 322], [cx + 62, 380], [cx + 56, 440], [cx + 52, 500], [cx - 52, 500], [cx - 56, 440], [cx - 62, 380]], true, 6);
  // arms behind the torso edge go first so sleeves overlap the body
  const arm = (s: number): void => {
    const sx = cx + s * 56, up = smooth([[sx - s * 4, 316], [sx + s * 14, 330], [sx + s * 26, 372], [sx + s * 30, 410], [sx + s * 8, 416], [sx - s * 6, 372]], true, 6);
    k.poly(up, uni, 'cloth', { ink: 1, knock: 1 });
    const fore = smooth([[sx + s * 30, 408], [sx + s * 8, 414], [sx - s * 4, 440], [sx - s * 14, 470], [sx - s * 2, 478], [sx + s * 16, 468], [sx + s * 30, 440]], true, 6);
    k.poly(fore, uni, 'cloth', { ink: 1, knock: 1 });
    k.poly([[sx - s * 12, 462], [sx - s * 20, 470], [sx - s * 6, 482], [sx + s * 14, 472]].map(([x, y]): Pt => [x, y]), apron, 'cloth', { ink: 1, knock: 1 });
    const hand = smooth([[sx - s * 14, 470], [sx - s * 10, 482], [sx - s * 18, 497], [sx - s * 6, 503], [sx + s * 10, 500], [sx + s * 16, 488], [sx + s * 14, 474]], true, 5);
    k.poly(hand, skin, 'skin', { ink: 1, knock: 1 });
    for (let f = 0; f < 3; f++) k.line([[sx - s * (12 - f * 7), 490], [sx - s * (13 - f * 7), 500]], '#7A4A44', 0.6, 0.5);
    if (s > 0) sh(up, 0.35); sh(fore, s > 0 ? 0.35 : 0.1);
  };
  arm(-1); arm(1);
  k.poly(torso, uni, 'cloth', { ink: 1, knock: 1 });
  sh(smooth([[cx + 24, 312], [cx + 58, 322], [cx + 62, 380], [cx + 56, 440], [cx + 52, 500], [cx + 30, 500], [cx + 34, 440], [cx + 28, 380]], true, 5), 0.4);
  // apron bib with straps, pocket, piping
  k.poly([[cx - 30, 340], [cx - 22, 330], [cx + 22, 330], [cx + 30, 340], [cx + 36, 500], [cx - 36, 500]], apron, 'cloth', { ink: 1, knock: 1 });
  sh([[cx + 14, 332], [cx + 30, 340], [cx + 36, 500], [cx + 18, 500]], 0.32, '#9C86A6');
  k.line([[cx - 30, 340], [cx - 22, 330], [cx + 22, 330], [cx + 30, 340]], PAL.rasp, 1.6, 0.9);
  k.line([[cx - 22, 330], [cx - 14, 312]], apron, 4, 0.95); k.line([[cx + 22, 330], [cx + 14, 312]], apron, 4, 0.95);
  k.line([[cx - 31, 342], [cx - 36, 500]], PAL.rasp, 1.2, 0.8); k.line([[cx + 31, 342], [cx + 36, 500]], PAL.rasp, 1.2, 0.8);
  k.poly([[cx - 18, 392], [cx + 18, 392], [cx + 16, 420], [cx - 16, 420]], lighten(apron, 0.2), 'cloth', { ink: 1, knock: 1 });
  k.line([[cx - 6, 345], [cx - 9, 388]], '#7A6A82', 0.7, 0.4); k.line([[cx + 8, 350], [cx + 12, 390]], '#7A6A82', 0.7, 0.4);
  // collar and neck
  const neck = smooth([[cx - 11, 284], [cx + 11, 284], [cx + 13, 312], [cx + 4, 318], [cx - 4, 318], [cx - 13, 312]], true, 5);
  k.poly(neck, skin, 'skin', { ink: 1, knock: 1 }); sh(smooth([[cx + 2, 284], [cx + 11, 284], [cx + 13, 312], [cx + 4, 318], [cx + 2, 300]], true, 4), 0.3, '#A86A58');
  k.poly([[cx - 16, 310], [cx, 322], [cx + 16, 310], [cx + 22, 318], [cx, 334], [cx - 22, 318]], apron, 'cloth', { ink: 1, knock: 1 });
  // head: oval, slight jaw taper
  const head = smooth([[cx - 22, 250], [cx - 20, 232], [cx, 224], [cx + 20, 232], [cx + 22, 250], [cx + 18, 272], [cx + 8, 288], [cx, 292], [cx - 8, 288], [cx - 18, 272]], true, 6);
  k.poly(head, skin, 'skin', { ink: 1, knock: 1 });
  sh(smooth([[cx + 8, 232], [cx + 22, 250], [cx + 18, 272], [cx + 8, 288], [cx + 4, 292], [cx + 10, 262]], true, 5), 0.38, '#B0705C');
  if (face) {
    k.glaze(arc(cx - 12, 268, 6, 4, 0, 2 * Math.PI, 8), '#E87A86', 0.35); k.glaze(arc(cx + 12, 268, 6, 4, 0, 2 * Math.PI, 8), '#E87A86', 0.3);
    k.line([[cx - 4, 262], [cx - 6, 270], [cx - 2, 272]], '#9C6652', 0.8, 0.6);
    k.line([[cx - 14, 254], [cx - 7, 253]], '#4A2D3E', 1.1, 0.8); k.line([[cx + 7, 254], [cx + 14, 253]], '#4A2D3E', 1.1, 0.8);
    k.line([[cx - 16, 248], [cx - 6, 246]], '#5A3A38', 0.9, 0.55); k.line([[cx + 6, 246], [cx + 16, 248]], '#5A3A38', 0.9, 0.55);
  } else k.glaze(smooth([[cx - 14, 250], [cx + 14, 250], [cx + 12, 262], [cx - 12, 262]], true, 4), '#C98F78', 0.14);
  // hair at the sides, a neat bun, and a cream baker's cap with a raspberry band
  k.poly(smooth([[cx - 23, 240], [cx - 22, 256], [cx - 19, 262], [cx - 19, 242]], true, 4), '#5A3A38', 'wood', { knock: 1 });
  k.poly(smooth([[cx + 23, 240], [cx + 22, 256], [cx + 19, 262], [cx + 19, 242]], true, 4), '#4A2D30', 'wood', { knock: 1 });
  k.poly(smooth([[cx - 26, 238], [cx - 22, 214], [cx - 8, 200], [cx + 8, 200], [cx + 22, 214], [cx + 26, 238], [cx + 20, 232], [cx, 226], [cx - 20, 232]], true, 5), apron, 'cloth', { ink: 1, knock: 1 });
  sh(smooth([[cx + 8, 202], [cx + 22, 214], [cx + 26, 238], [cx + 20, 232], [cx + 12, 228]], true, 4), 0.35, '#9C86A6');
  k.line([[cx - 25, 234], [cx, 224], [cx + 25, 234]], PAL.rasp, 2.2, 0.9);
  k.poly(arc(cx, 194, 12, 8, 0, 2 * Math.PI, 10), apron, 'cloth', { ink: 1, knock: 1 });
}

export function buildInterior(seed: number, face = true): Scene {
  const rng = new Rng(seed * 4177 + 3), k = new Kit(rng);
  // back wall: a graded rose wash with a woven stripe
  k.poly([[-10, -10], [W + 10, -10], [W + 10, 610], [-10, 610]], '#EFBFC8', 'wall', { knock: 1, load: 0.9 });
  for (let x = 20; x < W; x += 60) k.poly([[x, 0], [x + 24, 0], [x + 24, 600], [x, 600]], '#E6AAB8', 'glaze', { alpha: 0.2, knock: 0 });
  for (let r = 0; r < 12; r++) for (let c = 0; c < 20; c++) { const x = 30 + c * 60 + (r % 2) * 30, y = 40 + r * 48; if (x < 1180) k.line(arc(x, y, 3.2, 3.2, 0, 2 * Math.PI, 7), '#FFF1E6', 1.4, 0.7); }
  // ceiling cornice
  k.rect(-10, 0, W + 20, 34, '#F6E6CD', 'trim', { ink: 1, knock: 1 });
  for (let x = 0; x < W; x += 10) k.rect(x, 34, 5, 7, '#D9BFAE', 'trim', { knock: 1 });
  k.glaze([[0, 42], [W, 42], [W, 60], [0, 60]], '#B07A90', 0.35);
  // wainscot
  k.rect(-10, 560, W + 20, 120, '#E3C9D2', 'wall', { ink: 1, knock: 1 });
  k.rect(-10, 552, W + 20, 10, '#F6E6CD', 'trim', { ink: 1, knock: 1 });
  for (let x = 20; x < W; x += 120) { k.rect(x, 574, 96, 70, '#EBD3DA', 'wall', { ink: 1, knock: 1 }); k.glaze([[x + 80, 574], [x + 96, 574], [x + 96, 644], [x + 80, 644]], '#8E7A98', 0.2); }
  // floor in perspective
  const rowsY = [600, 622, 650, 688, 736, 800];
  const s = (y: number): number => (y - 330) / 270;
  for (let j = 0; j < rowsY.length - 1; j++) for (let i = -14; i < 14; i++) {
    const y0 = rowsY[j], y1 = rowsY[j + 1];
    k.poly([[CX + i * 50 * s(y0), y0], [CX + (i + 1) * 50 * s(y0), y0], [CX + (i + 1) * 50 * s(y1), y1], [CX + i * 50 * s(y1), y1]], (i + j) % 2 ? '#CFA9B8' : '#F1E3D0', 'stone', { knock: 1, ink: 1 });
  }
  k.glaze([[0, 600], [W, 600], [W, 640], [0, 640]], '#5A3A68', 0.3);
  window_(k);
  k.next(); shelfUnit(k, rng, 70, 450); shelfUnit(k, rng, 750, 1130);
  k.next(); lamp(k, 262); lamp(k, 938);
  k.next(); worker(k, face);
  k.next(); counter(k, rng);
  bell(k, 380); deskLamp(k, 820);
  // small stacks and the followed box
  box(k, 880, 504, 50, 34, 0.02, '#D98A9C'); box(k, 880, 470, 40, 26, -0.03, '#8FA8C8');
  box(k, 330, 504, 44, 30, -0.02, '#B7A2CC');
  box(k, CX, 504, 124, 92, 0, PAL.rasp, true, true);
  k.glaze([[CX - 78, 504], [CX + 78, 504], [CX + 86, 522], [CX - 70, 522]], '#3A2440', 0.35);
  return { w: W, h: H, seed, items: k.items, skyStops: [] };
}
export { mix, bays };
