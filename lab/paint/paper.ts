// Procedural parchment: mottling, fibres, foxing, tooth, and a deckled edge. Shared by the techniques that need a sheet.
import { Rng, vnoise, fbm, hash } from './rng';

export interface Paper { base: HTMLCanvasElement; bump: HTMLCanvasElement; mask: HTMLCanvasElement; w: number; h: number; scale: number; ms: number; }
export const PAPER_RGB: [number, number, number] = [240, 227, 200];

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}
/** A 256x256 tileable grain table in device pixels (feature size follows the scale), so per-pixel noise is a lookup. */
export function grainTile(S: number, seed: number, f1 = 1.9, f2 = 0.6): Float32Array {
  const N = 256, out = new Float32Array(N * N), c1 = Math.max(2, Math.round((N * f1) / S)), c2 = Math.max(2, Math.round((N * f2) / S));
  const vp = (x: number, y: number, c: number, sd: number): number => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h = (a: number, b: number): number => hash(((a % c) + c) % c, ((b % c) + c) % c, sd);
    const a = h(ix, iy), b = h(ix + 1, iy), cc = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out[y * N + x] = 0.55 * vp((x / N) * c1, (y / N) * c1, c1, seed + 1) + 0.45 * vp((x / N) * c2, (y / N) * c2, c2, seed + 2);
  return out;
}
const sstep = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makePaper(w: number, h: number, scale: number, seed: number, opts: { deckle?: number; fade?: number } = {}): Paper {
  const t0 = performance.now(), S = scale, W = Math.round(w * S), H = Math.round(h * S), rng = new Rng(seed * 31 + 5);
  const deckle = opts.deckle ?? 7, fade = opts.fade ?? 46;
  const [base, bx] = cv(W, H), [bump, ux] = cv(W, H), [mask, mx] = cv(W, H);
  bx.fillStyle = '#F0E3C8'; bx.fillRect(0, 0, W, H);
  bx.save(); bx.scale(S, S);
  for (let i = 0; i < 140; i++) {
    const x = rng.range(0, w), y = rng.range(0, h), r = rng.range(50, 280), warm = rng.chance(0.55);
    const g = bx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, warm ? 'rgba(196,158,98,0.07)' : 'rgba(255,248,228,0.09)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    bx.fillStyle = g; bx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fibres: short wandering strokes, dark and light
  for (let i = 0; i < Math.round((w * h) / 140); i++) {
    const x = rng.range(0, w), y = rng.range(0, h), a = rng.range(0, Math.PI * 2), l = rng.range(4, 16);
    bx.strokeStyle = rng.chance(0.55) ? `rgba(150,112,64,${rng.range(0.04, 0.12)})` : `rgba(255,250,235,${rng.range(0.1, 0.3)})`;
    bx.lineWidth = rng.range(0.3, 0.8);
    bx.beginPath(); bx.moveTo(x, y); bx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); bx.stroke();
  }
  // foxing: tiny brown freckles with halos, and a few larger tide-marks
  for (let i = 0; i < 70; i++) {
    const x = rng.range(10, w - 10), y = rng.range(10, h - 10), r = rng.range(1, 4.5), halo = r * rng.range(3, 7);
    const g = bx.createRadialGradient(x, y, 0, x, y, halo);
    g.addColorStop(0, 'rgba(150,92,40,0.28)'); g.addColorStop(r / halo, 'rgba(160,104,50,0.14)'); g.addColorStop(1, 'rgba(160,104,50,0)');
    bx.fillStyle = g; bx.beginPath(); bx.arc(x, y, halo, 0, 7); bx.fill();
    bx.fillStyle = 'rgba(112,64,28,0.4)'; bx.beginPath(); bx.arc(x, y, r * 0.6, 0, 7); bx.fill();
  }
  for (let i = 0; i < 5; i++) {
    const x = rng.range(0, w), y = rng.range(0, h), r = rng.range(40, 110);
    bx.strokeStyle = 'rgba(166,120,60,0.07)'; bx.lineWidth = 2.5;
    bx.beginPath(); for (let a = 0; a <= 6.4; a += 0.2) { const rr = r * (0.85 + vnoise(Math.cos(a) * 2 + i * 9, Math.sin(a) * 2, 4) * 0.3); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.8; a === 0 ? bx.moveTo(px, py) : bx.lineTo(px, py); } bx.stroke();
  }
  bx.restore();
  ux.fillStyle = 'rgb(128,128,128)'; ux.fillRect(0, 0, W, H);
  ux.save(); ux.scale(S, S);
  for (let i = 0; i < Math.round((w * h) / 90); i++) {
    const x = rng.range(0, w), y = rng.range(0, h), a = rng.range(0, 7), l = rng.range(3, 12);
    ux.strokeStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'; ux.lineWidth = 0.5;
    ux.beginPath(); ux.moveTo(x, y); ux.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ux.stroke();
  }
  ux.restore();
  // per-pixel: tooth, deckle edge, edge tanning, and the vignette mask the painting fades through
  const bd = bx.getImageData(0, 0, W, H), ud = ux.getImageData(0, 0, W, H), md = mx.createImageData(W, H);
  const B = bd.data, U = ud.data, M = md.data;
  const tile = grainTile(S, seed), far = 130 * S;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4, g = tile[((py & 255) << 8) | (px & 255)];
      const dpx = Math.min(px, py, W - px, H - py);
      if (dpx > far) {
        const f = 0.955 + 0.09 * g;
        B[i] = Math.min(255, B[i] * f); B[i + 1] = Math.min(255, B[i + 1] * f * (0.99 + 0.02 * g)); B[i + 2] = Math.min(255, B[i + 2] * f * (0.97 + 0.02 * g));
        B[i + 3] = 255; const u = (g - 0.5) * 90; U[i] = U[i + 1] = U[i + 2] = Math.max(0, Math.min(255, U[i] + u)); U[i + 3] = 255;
        M[i] = M[i + 1] = M[i + 2] = M[i + 3] = 255; continue;
      }
      const x = px / S, y = py / S, d = dpx / S;
      const rag = (fbm(x * 0.06, y * 0.06, seed + 8, 3) - 0.5) * deckle * 1.8 + (vnoise(x * 0.5, y * 0.5, 12) - 0.5) * 1.6;
      const dd = d + rag - deckle * 0.5;
      const tan = 1 - 0.13 * sstep(16, 0, dd) - 0.04 * sstep(60, 0, d);
      const f = (0.955 + 0.09 * g) * tan;
      B[i] = Math.min(255, B[i] * f); B[i + 1] = Math.min(255, B[i + 1] * f * (0.99 + 0.02 * g)); B[i + 2] = Math.min(255, B[i + 2] * f * (0.97 + 0.02 * g));
      B[i + 3] = 255 * sstep(0, 1.6, dd);
      const u = (g - 0.5) * 90; U[i] = U[i + 1] = U[i + 2] = Math.max(0, Math.min(255, U[i] + u)); U[i + 3] = 255;
      const v = sstep(0, fade, d + (fbm(x * 0.02, y * 0.02, seed + 21, 3) - 0.5) * fade * 0.6 - 8);
      M[i] = M[i + 1] = M[i + 2] = 255; M[i + 3] = 255 * v;
    }
  }
  bx.putImageData(bd, 0, 0); ux.putImageData(ud, 0, 0); mx.putImageData(md, 0, 0);
  return { base, bump, mask, w, h, scale, ms: performance.now() - t0 };
}
