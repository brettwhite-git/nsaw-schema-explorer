// WrittenInk: handwritten margin notes, written by a pen rather than wiped in.
// Port of the ink-and-thread skill's written.js (text part). Letters are Caveat SemiBold outlines,
// each revealed through its own mask by a fat stroke that follows the letter's traced centre-line.
// Glyph data comes from public/fonts/caveat-glyphs.json (npm run glyphs): full printable ASCII
// plus common punctuation. A character with no glyph leaves a gap and warns once in the console.
import { el, mulberry32 } from './svg';
import { Timeline } from './timeline';

export interface GlyphData {
  upm: number; asc: number; desc: number;
  glyphs: Record<string, (number | string)[]>;
  kern: Record<string, number>;
}

const CFG = {
  glyphsUrl: '/fonts/caveat-glyphs.json',
  lineHeight: 1.2,   // em
  penSpeed: 15,      // em per second along a centre-line, before the note is fitted to its window
  maskWidth: 0.2,    // em
  lineDur: 1800,
  lineGap: 900,
};

let glyphPromise: Promise<GlyphData> | null = null;
export function loadGlyphs(url = CFG.glyphsUrl): Promise<GlyphData> {
  if (!glyphPromise) {
    glyphPromise = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<GlyphData>;
    });
    glyphPromise.catch((e) => { glyphPromise = null; console.warn('[written] glyph data did not load, notes fall back to plain text:', e); });
  }
  return glyphPromise;
}

/** ms a note of that many lines takes to write */
export function noteWindow(lineCount: number): number {
  const n = Math.max(1, lineCount || 1);
  return (n - 1) * CFG.lineGap + ((n - 1) % 2 ? 110 : 0) + CFG.lineDur;
}

/** Deterministic tilt per line, as the skill does it. */
export function tiltRand(s: number): number {
  const x = Math.sin(s * 9999) * 10000;
  return x - Math.floor(x);
}

interface Stroke { el: SVGPathElement; len: number; t0: number; t1: number }
interface Item { el: SVGPathElement; maskRef: string; strokes: Stroke[]; pad: number; t0: number; t1: number; state: number }

const warned = new Set<string>();
let maskCount = 0;

function buildText(rows: SVGSVGElement[], lines: string[], D: GlyphData, total: number, seed: number): Item[] {
  const upm = D.upm, rnd = mulberry32(seed * 7919 + 20211);
  const box = CFG.lineHeight * upm, baseIn = (box - (D.asc + D.desc)) / 2 + D.asc;
  const mw = CFG.maskWidth * upm, speed = (CFG.penSpeed * upm) / 1000;
  const items: Item[] = [];
  let t = 0;
  lines.forEach((text, li) => {
    const svg = rows[li];
    let x = 0, prev = '';
    const defs = el('defs', {}, svg);
    if (li) t += 200;
    for (const ch of text) {
      const g = D.glyphs[ch];
      if (!g) {
        if (!warned.has(ch)) { warned.add(ch); console.warn(`[written] no glyph for "${ch}": run npm run glyphs`); }
        x += upm * 0.3; t += 100; prev = '';
        continue;
      }
      x += D.kern[prev + ch] || 0;
      prev = ch;
      if (!g[1]) { x += g[0] as number; t += 100; continue; }
      const id = `wi-m${++maskCount}`;
      const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: -0.6 * upm, y: -(D.asc + 0.25 * upm), width: (g[0] as number) + 1.2 * upm, height: D.asc + D.desc + 0.5 * upm }, defs);
      const pen = el('g', { fill: 'none', stroke: '#fff', 'stroke-width': mw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mask);
      const path = el('path', { d: g[1] as string, transform: `translate(${x} 0)` }, svg);
      const pace = 0.82 + rnd() * 0.43, g0 = t;
      const strokes: Stroke[] = [];
      for (let k = 2; k < g.length; k += 2) {
        const len = g[k] as number;
        const sp = el('path', { d: g[k + 1] as string, 'stroke-dasharray': `${len} ${len + mw * 2}` }, pen);
        const s: Stroke = { el: sp, len, t0: t, t1: 0 };
        t += Math.max(32, (len / speed) * pace);
        s.t1 = t;
        t += 16;
        strokes.push(s);
      }
      items.push({ el: path, maskRef: `url(#${id})`, strokes, pad: mw, t0: g0, t1: t - 16, state: -1 });
      t += 4 + rnd() * 22;
      x += g[0] as number;
    }
    svg.setAttribute('viewBox', `0 ${(-baseIn).toFixed(1)} ${Math.max(1, Math.ceil(x))} ${box}`);
    svg.style.width = `${(x / upm).toFixed(3)}em`;
  });
  const k = t > 0 ? total / t : 1;
  for (const it of items) {
    it.t0 *= k; it.t1 *= k;
    for (const s of it.strokes) { s.t0 *= k; s.t1 *= k; }
  }
  return items;
}

export interface WrittenHandle {
  duration: number;
  /** render the note as it stands ms into the take (-1 = nothing, Infinity = finished) */
  seek(ms: number): void;
  /** the note's own clock, used when it is not driven by a figure timeline */
  play(delayMs?: number): void;
  finish(): void;
  clear(): void;
  destroy(): void;
}

export interface WriteOpts { seed?: number; tilt?: number; window?: number; reduced?: boolean }

/**
 * Write lines of text into `root` (one div.note-line per line). The note starts cleared unless
 * `reduced`, in which case it is finished at once. The words stay readable to assistive tech.
 */
export function writeText(root: HTMLElement, lines: string[], opts: WriteOpts = {}): WrittenHandle {
  const seed = opts.seed ?? 0, tilt = opts.tilt ?? 1.2;
  const total = opts.window ?? noteWindow(lines.length);
  let items: Item[] | null = null;
  let alive = true;
  let want = opts.reduced ? Infinity : -1;   // the state to show once glyphs arrive
  const clock = new Timeline();

  if (lines.length) {
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', lines.join(' '));
  }
  const divs = lines.map((_, i) => {
    const row = document.createElement('div');
    row.className = 'note-line';
    row.style.setProperty('--line-tilt', `${((tiltRand(seed + i + 1) - 0.5) * tilt).toFixed(2)}deg`);
    root.appendChild(row);
    return row;
  });
  const rows = divs.map((row) =>
    el('svg', { class: 'written-line', 'aria-hidden': 'true', focusable: 'false', fill: 'currentColor', style: `display:block;height:${CFG.lineHeight}em;width:0;overflow:visible` }, row));

  const ease = (p: number) => 0.55 * p + 0.45 * (0.5 - 0.5 * Math.cos(Math.PI * p));
  function render(ms: number): void {
    want = ms;
    if (!items) return;
    for (const it of items) {
      const state = ms < it.t0 ? 0 : ms >= it.t1 ? 1 : 2;
      if (state !== 2 && state === it.state) continue;
      if (state === 0) it.el.style.visibility = 'hidden';
      else if (state === 1) { it.el.style.visibility = ''; it.el.removeAttribute('mask'); }
      else {
        if (it.state !== 2) { it.el.setAttribute('mask', it.maskRef); it.el.style.visibility = ''; }
        for (const s of it.strokes) {
          const p = ms <= s.t0 ? -1 : ms >= s.t1 ? 1 : ease((ms - s.t0) / (s.t1 - s.t0));
          s.el.style.strokeDashoffset = p < 0 ? (s.len + it.pad).toFixed(1) : (s.len * (1 - p)).toFixed(1);
        }
      }
      it.state = state;
    }
  }

  loadGlyphs().then((D) => {
    if (!alive) return;
    items = buildText(rows, lines, D, total, seed);
    render(want);
  }, () => {
    if (!alive) return;
    rows.forEach((s) => s.remove());
    divs.forEach((row, i) => { row.textContent = lines[i]; });
    root.removeAttribute('role');
    root.removeAttribute('aria-label');
  });

  clock.custom(0, total, (p) => render(p <= 0 ? -1 : p * total));
  if (opts.reduced) render(Infinity);

  return {
    duration: total,
    seek: (ms) => { clock.stop(); render(ms); },
    play: (delay = 0) => { if (opts.reduced) render(Infinity); else clock.replay(delay); },
    finish: () => { clock.stop(); render(Infinity); },
    clear: () => { clock.stop(); render(-1); },
    destroy: () => {
      alive = false;
      clock.destroy();
      divs.forEach((r) => r.remove());
      root.removeAttribute('role');
      root.removeAttribute('aria-label');
    },
  };
}
