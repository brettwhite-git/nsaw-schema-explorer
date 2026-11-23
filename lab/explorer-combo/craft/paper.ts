// A small parchment sheet for the plate: the lab/paint paper scaled down for a card (its mottling and foxing counts are
// tuned for a 1200 px plate and turn a 320 px card to mud). Base, tooth bump, torn-edge alpha, and the vignette mask
// the painting fades through. Deterministic from the seed.
import { Rng, vnoise, fbm } from '../../paint/rng';
import { Paper, grainTile } from '../../paint/paper';

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}
const sstep = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function cardPaper(w: number, h: number, S: number, seed: number, deckle = 4.5, fade = 18): Paper {
  const t0 = performance.now(), W = Math.round(w * S), H = Math.round(h * S), rng = new Rng(seed * 31 + 5);
  const [base, bx] = cv(W, H), [bump, ux] = cv(W, H), [mask, mx] = cv(W, H);
  bx.fillStyle = '#F1E6CF'; bx.fillRect(0, 0, W, H);
  bx.save(); bx.scale(S, S);
  for (let i = 0; i < 14; i++) {
    const x = rng.range(0, w), y = rng.range(0, h), r = rng.range(20, 70), warm = rng.chance(0.5);
    const g = bx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, warm ? 'rgba(196,158,98,0.05)' : 'rgba(255,250,234,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    bx.fillStyle = g; bx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < Math.round((w * h) / 320); i++) {
    const x = rng.range(0, w), y = rng.range(0, h), a = rng.range(0, Math.PI * 2), l = rng.range(3, 9);
    bx.strokeStyle = rng.chance(0.5) ? `rgba(150,112,64,${rng.range(0.03, 0.07)})` : `rgba(255,250,235,${rng.range(0.1, 0.25)})`;
    bx.lineWidth = rng.range(0.3, 0.6);
    bx.beginPath(); bx.moveTo(x, y); bx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); bx.stroke();
  }
  // two faint freckles, no more
  for (let i = 0; i < 2; i++) {
    const x = rng.range(20, w - 20), y = rng.range(20, h - 20), r = rng.range(0.6, 1.2), halo = r * 4;
    const g = bx.createRadialGradient(x, y, 0, x, y, halo);
    g.addColorStop(0, 'rgba(150,92,40,0.16)'); g.addColorStop(1, 'rgba(160,104,50,0)');
    bx.fillStyle = g; bx.beginPath(); bx.arc(x, y, halo, 0, 7); bx.fill();
  }
  bx.restore();
  ux.fillStyle = 'rgb(128,128,128)'; ux.fillRect(0, 0, W, H);
  const bd = bx.getImageData(0, 0, W, H), ud = ux.getImageData(0, 0, W, H), md = mx.createImageData(W, H);
  const B = bd.data, U = ud.data, M = md.data, tile = grainTile(S, seed);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4, g = tile[((py & 255) << 8) | (px & 255)];
      const x = px / S, y = py / S, d = Math.min(x, y, w - x, h - y);
      const rag = (fbm(x * 0.07, y * 0.07, seed + 8, 3) - 0.5) * deckle * 1.8 + (vnoise(x * 0.6, y * 0.6, 12) - 0.5) * 1.2;
      const dd = d + rag - deckle * 0.5;
      const tan = 1 - 0.1 * sstep(10, 0, dd) - 0.03 * sstep(30, 0, d);
      const f = (0.965 + 0.07 * g) * tan;
      B[i] = Math.min(255, B[i] * f); B[i + 1] = Math.min(255, B[i + 1] * f); B[i + 2] = Math.min(255, B[i + 2] * f * (0.98 + 0.02 * g));
      B[i + 3] = 255 * sstep(0, 1.4, dd);
      const u = (g - 0.5) * 70; U[i] = U[i + 1] = U[i + 2] = Math.max(0, Math.min(255, 128 + u)); U[i + 3] = 255;
      const v = sstep(0, fade, d + (fbm(x * 0.03, y * 0.03, seed + 21, 3) - 0.5) * fade * 0.9 - 6);
      M[i] = M[i + 1] = M[i + 2] = 255; M[i + 3] = 255 * v;
    }
  }
  bx.putImageData(bd, 0, 0); ux.putImageData(ud, 0, 0); mx.putImageData(md, 0, 0);
  return { base, bump, mask, w, h, scale: S, ms: performance.now() - t0 };
}
