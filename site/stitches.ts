// Hand-sewn stitches: a TS port of the ink-and-thread stitches.js + make-stitches.py.
//  - side guides: one element spans the document; its drawn length follows the scroll but snaps to
//    whole stitches, so stitches pop in one at a time. It never unsews.
//  - seams: a section's top seam is sewn left to right, one stitch per step, when it scrolls into view.
// The stitch tiles are masks, so colour comes from CSS (theme-safe). Reduced motion: all shown complete.
import { mulberry32 } from '../ink/svg';

export const STITCH = { period: 28, length: 6, count: 6, thickness: 4 };

/** Pure geometry of one tile's stitches (seeded). Exported for tests. */
export function stitchGeometry(vertical: boolean, seed: number): { a: [number, number]; b: [number, number]; w: number }[] {
  const rnd = mulberry32(seed);
  const T = STITCH.thickness;
  const out: { a: [number, number]; b: [number, number]; w: number }[] = [];
  const u = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  for (let i = 0; i < STITCH.count; i++) {
    const start = i * STITCH.period + 1.6 + u(-0.8, 0.8);
    const length = STITCH.length + u(-1, 1);
    const mid = T / 2 + u(-0.3, 0.3);
    const tilt = (Math.tan((u(-3.5, 3.5) * Math.PI) / 180) * length) / 2;
    let a: [number, number] = [start, mid - tilt];
    let b: [number, number] = [start + length, mid + tilt];
    if (vertical) { a = [a[1], a[0]]; b = [b[1], b[0]]; }
    out.push({ a, b, w: Math.round((1.05 + u(-0.12, 0.12)) * 100) / 100 });
  }
  return out;
}

export function stitchTileUri(vertical: boolean, seed: number): string {
  const L = STITCH.period * STITCH.count, T = STITCH.thickness;
  const [w, h] = vertical ? [T, L] : [L, T];
  const lines = stitchGeometry(vertical, seed)
    .map((s) => `<line x1='${s.a[0].toFixed(2)}' y1='${s.a[1].toFixed(2)}' x2='${s.b[0].toFixed(2)}' y2='${s.b[1].toFixed(2)}' stroke-width='${s.w}'/>`)
    .join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><g stroke='#000' stroke-linecap='round'>${lines}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}

/** Snap a drawn length to whole stitches: stitch k occupies roughly [k*P, k*P + 9]. */
export const snapStitch = (px: number): number => Math.floor(px / STITCH.period) * STITCH.period + 9;

export function startStitches(reduced: boolean): () => void {
  const root = document.documentElement;
  root.style.setProperty('--stitch-h', stitchTileUri(false, 7));
  root.style.setProperty('--stitch-v', stitchTileUri(true, 11));
  root.style.setProperty('--stitch-size-h', `${STITCH.period * STITCH.count}px ${STITCH.thickness}px`);
  root.style.setProperty('--stitch-size-v', `${STITCH.thickness}px ${STITCH.period * STITCH.count}px`);

  const guides = document.createElement('div');
  guides.className = 'page-guides';
  guides.setAttribute('aria-hidden', 'true');
  guides.innerHTML = '<i class="gl"></i><i class="gr"></i>';
  document.body.prepend(guides);

  let docH = 0, drawn = 0, raf = 0, last = performance.now();
  const measure = () => {
    guides.style.setProperty('--guides-h', '0px');   // the guides are part of the page: collapse, read, set
    docH = document.documentElement.scrollHeight;
    guides.style.setProperty('--guides-h', `${docH}px`);
    if (reduced) guides.style.setProperty('--guides-draw', `${docH}px`);
  };
  const target = () => Math.min(docH, window.scrollY + window.innerHeight * 0.92);
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = target();
    if (t > drawn) drawn += (t - drawn) * (1 - Math.exp(-dt * 2.6));
    const shown = drawn >= docH - 1 ? docH : snapStitch(drawn);
    guides.style.setProperty('--guides-draw', `${shown}px`);
    raf = t - drawn > 0.5 ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!raf && !reduced) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  measure();
  if (!reduced) { window.addEventListener('scroll', kick, { passive: true }); kick(); }
  const ro = new ResizeObserver(() => { measure(); kick(); });
  ro.observe(document.body);

  // seams: sew a stitch per step when they come into view
  const sew = (seam: HTMLElement) => {
    if (reduced) { seam.style.setProperty('--seam-draw', '100%'); return; }
    let k = 0;
    const step = () => {
      k += 1;
      const px = k * STITCH.period + Math.round(STITCH.period * 0.8);
      if (px >= seam.clientWidth) { seam.style.setProperty('--seam-draw', '100%'); return; }
      seam.style.setProperty('--seam-draw', `${px}px`);
      window.setTimeout(step, 16);
    };
    step();
  };
  const seen = new WeakSet<Element>();
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); sew(e.target as HTMLElement); }
  }, { threshold: 0.2 });
  const watch = () => document.querySelectorAll('.seam').forEach((s) => { if (!seen.has(s)) { seen.add(s); io.observe(s); } });
  watch();
  const mo = new MutationObserver(watch);
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    window.removeEventListener('scroll', kick);
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect(); mo.disconnect();
    guides.remove();
  };
}
