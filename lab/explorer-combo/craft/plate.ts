// A small code-painted watercolour: a lone depot on a hillside, a few pines, a track winding up to its door, one lit
// window (the plate's only warm accent). Painted with the repo's canvas watercolour (lab/paint) on procedural parchment
// with soft torn edges. Deterministic from the seed. Designed at 320 x 180 CSS px.
import { Rng } from '../../paint/rng';
import { Kit, Pt, smooth } from '../../paint/kit';
import { HOUSE, Look, paintItems, granulate, composite } from '../../paint/paintB';
import { cardPaper } from './paper';

const W = 320, H = 180;
const INK = '#3A3236';

const LOOK: Look = { ...HOUSE, id: 'craft', name: 'Craft plate', dev: 0.75, layers: 0.8, hue: 0.12, blots: 0, inkA: 0.8, inkW: 0.75, inkBreak: 1.2, grain: 0.9, fade: 16 };

function scene(seed: number): { items: Kit['items']; stops: [number, string][] } {
  const rng = new Rng(seed * 7 + 11), k = new Kit(rng);
  const j = (v: number, a = 2): number => v + rng.range(-a, a);

  // sky: a cool evening wash, warming low on the horizon
  k.next(); k.rect(-6, -6, W + 12, 124, '#B4C3CA', 'sky', { grad: ['#B4C3CA', '#EEDFC2'], alpha: 0.55 });
  // far ridge and a strip of mist
  k.next();
  const far: Pt[] = [[-6, 104]]; for (let x = 0; x <= W + 6; x += 16) far.push([x, j(96 - Math.sin(x * 0.018 + seed) * 9 - (x > 200 ? (x - 200) * 0.05 : 0), 2.5)]);
  far.push([W + 6, 130], [-6, 130]);
  k.poly(far, '#A3B1B7', 'far', { alpha: 0.5 });
  k.glaze([[-6, 104], [W + 6, 100], [W + 6, 116], [-6, 118]], '#F1E6CF', 0.3);
  // the hill the depot stands on, rising to the right
  k.next();
  const hill: Pt[] = [[-6, 150]]; for (let x = 0; x <= W + 6; x += 20) hill.push([x, j(146 - 46 * Math.pow(Math.min(1, x / 250), 0.8) + (x > 260 ? (x - 260) * 0.12 : 0), 1.5)]);
  k.poly(smooth(hill, false, 3).concat([[W + 6, H + 6], [-6, H + 6]] as Pt[]), '#B2B893', 'plant', { ink: 0.6, alpha: 0.75 });
  // foreground swell, a little darker
  k.next();
  k.poly(smooth([[-6, 160], [60, 152], [130, 162], [200, 170], [W + 6, 166], [W + 6, H + 6], [-6, H + 6]], false, 4), '#9AA384', 'plant', { alpha: 0.5 });

  // the track: a pale worn strip winding up from the bottom left to the door
  k.next();
  const ctr: Pt[] = smooth([[40, 186], [70, 168], [120, 160], [160, 142], [196, 124], [214, 110]], false, 5);
  const left: Pt[] = [], right: Pt[] = [];
  ctr.forEach((p, i) => {
    const q = ctr[Math.min(ctr.length - 1, i + 1)], o = ctr[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1;
    const w = 1.2 + (1 - i / (ctr.length - 1)) * 7.5;
    left.push([p[0] - (dy / l) * w, p[1] + (dx / l) * w]); right.push([p[0] + (dy / l) * w, p[1] - (dx / l) * w]);
  });
  k.poly([...left, ...right.reverse()], '#D9C7A2', 'stone', { alpha: 0.75, knock: 0.6 });
  k.line(left, INK, 0.6, 0.45);

  // the depot: a long shed with a pitched roof, side in shadow, one lit window
  k.next();
  const gx = 196, gy = 108, bw = 52, bh = 20, side = 16;
  k.poly([[gx, gy], [gx + bw, gy - 3], [gx + bw, gy - 3 - bh], [gx, gy - bh]], '#CDBB9E', 'wall', { ink: 1 });
  k.poly([[gx + bw, gy - 3], [gx + bw + side, gy - 7], [gx + bw + side, gy - 7 - bh], [gx + bw + side / 2, gy - 3 - bh - 10], [gx + bw, gy - 3 - bh]], '#A99A86', 'wall', { ink: 1 });
  k.poly([[gx - 3, gy - bh + 1], [gx + bw, gy - bh - 2], [gx + bw + side / 2, gy - 3 - bh - 10], [gx + 5, gy - bh - 10]], '#6F7F8B', 'roof', { ink: 1 });
  k.next();
  k.rect(gx + 12, gy - 13, 8, 12, '#5B5A5E', 'wood', { ink: 0.6 });
  k.rect(gx + 30, gy - 15, 7, 6, '#F0A54C', 'glow', { ink: 0.5, lit: true });
  k.glaze([[gx + bw, gy - 3], [gx + bw + side, gy - 7], [gx + bw + side, gy - 7 - bh], [gx + bw, gy - 3 - bh]], '#59657A', 0.25);
  k.line([[gx + bw + side + 2, gy - 6], [gx - 6, gy + 1]], INK, 0.7, 0.4);

  // pines: two near the shed, a pair lower down the slope
  const pine = (x: number, base: number, h: number): void => {
    k.next();
    const tiers = 3, pts: Pt[] = [[x, base - h]];
    for (let t = 1; t <= tiers; t++) { const y = base - h + (h * 0.92 * t) / tiers, w = (h * 0.2 * t) / tiers + 1.5; pts.push([x + w, y], [x + w * 0.45, y - 1]); }
    const back = pts.slice(1).map(([px, py]) => [2 * x - px, py] as Pt).reverse();
    k.poly([...pts, ...back], '#4F6560', 'pine', { ink: 0.5 });
    k.line([[x, base - 2], [x, base + 2]], INK, 0.7, 0.55);
  };
  pine(184, 114, 26); pine(176, 117, 18); pine(274, 98, 22); pine(118, 147, 15); pine(108, 150, 11);

  return { items: k.items, stops: [[0, '#A9BCC6'], [0.6, '#DAD7CA'], [1, '#EFDDB8']] };
}

/** Paint the plate into the canvas. Uses the canvas's CSS box if it has one, else 320 x 180, times devicePixelRatio. */
export async function paintPlate(canvas: HTMLCanvasElement, opts: { theme: 'dark' | 'light'; seed?: number }): Promise<void> {
  const seed = opts.seed ?? 7;
  const cssW = canvas.clientWidth || W;
  if (!canvas.clientWidth) { canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; }
  const dpr = Math.min(3, window.devicePixelRatio || 1), S = (cssW / W) * dpr;
  const PW = Math.round(W * S), PH = Math.round(H * S);
  canvas.width = PW; canvas.height = PH;
  await new Promise<void>((r) => setTimeout(r, 0)); // yield so the caller's frame is not held up

  const paper = cardPaper(W, H, S, seed, 3.4, 20);
  const plate = document.createElement('canvas'); plate.width = PW; plate.height = PH;
  const { items, stops } = scene(seed);
  paintItems(plate.getContext('2d', { willReadFrequently: true })!, items, S, seed, 120, stops, LOOK);
  granulate(plate, S, seed, LOOK);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, PW, PH);
  composite(ctx, plate, paper, PW, PH);
  // on the dark UI the sheet is dimmed and cooled a little, so it sits in the night like a card under a lamp
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = opts.theme === 'dark' ? 'rgba(16,31,38,0.16)' : 'rgba(255,250,238,0.06)';
  ctx.fillRect(0, 0, PW, PH);
  ctx.globalCompositeOperation = 'source-over';
}
