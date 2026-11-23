// Precomputes the glyph data WrittenInk (ink/written.ts) writes margin notes from, so visitors
// never download opentype.js or the Caveat TTF:
//
//   npm run glyphs   ->   public/fonts/caveat-glyphs.json
//
// For every character (full printable ASCII plus common punctuation) it stores, in 1/250 em with
// y pointing DOWN and the baseline at 0:  glyphs[ch] = [advance, outline, len, line, len, line, ...]
// (outline = Caveat SemiBold outline as SVG path data; each line = one traced pen stroke) and
// kern["ab"] = pair adjustment. Adapted from the ink-and-thread skill's make-written-glyphs.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT = path.join(root, 'scripts/fonts/Caveat-SemiBold.ttf');
const OUT = path.join(root, 'public/fonts/caveat-glyphs.json');

const SIZE = 22;        // the px size the trace is tuned at
const RASTER = 5;       // skeleton resolution: canvas px per CSS px at SIZE
const EM = Number(process.env.WRITTEN_EM) || 250;   // units per em in the file
const SIMPLIFY = 7;     // font units a centre-line may stray when thinned out
// Every printable ASCII character plus the punctuation the copy uses.
let ascii = '';
for (let c = 0x21; c <= 0x7e; c++) ascii += String.fromCharCode(c);
const SAFE = ascii + ' ' + '\u2019\u2018\u201c\u201d\u2013\u2014\u2026\u00b7\u00d7\u2192\u00e9\u00a0';

/* ---------- raster: nonzero fill, 4 sub-rows per pixel, exact horizontal coverage ---------- */
function flatten(commands) {
  const polys = [];
  let cur = null, x = 0, y = 0;
  const STEPS = 10;
  for (const c of commands) {
    if (c.type === 'M') { cur = [[c.x, c.y]]; polys.push(cur); x = c.x; y = c.y; }
    else if (c.type === 'L') { cur.push([c.x, c.y]); x = c.x; y = c.y; }
    else if (c.type === 'Q') {
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS, u = 1 - t;
        cur.push([u * u * x + 2 * u * t * c.x1 + t * t * c.x, u * u * y + 2 * u * t * c.y1 + t * t * c.y]);
      }
      x = c.x; y = c.y;
    } else if (c.type === 'C') {
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS, u = 1 - t;
        cur.push([
          u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
      x = c.x; y = c.y;
    }
  }
  return polys;
}
function rasterise(polys, w, h) {
  const cover = new Float32Array(w * h), SUB = 4;
  const edges = [];
  for (const p of polys) for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1], 1] : [b[0], b[1], a[0], a[1], -1]);
  }
  for (let row = 0; row < h; row++) for (let s = 0; s < SUB; s++) {
    const y = row + (s + 0.5) / SUB, xs = [];
    for (const e of edges) if (y >= e[1] && y < e[3]) xs.push([e[0] + (e[2] - e[0]) * (y - e[1]) / (e[3] - e[1]), e[4]]);
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k][1];
      if (!wind) continue;
      const x0 = Math.max(0, xs[k][0]), x1 = Math.min(w, xs[k + 1][0]);
      for (let px = Math.floor(x0); px < x1; px++) cover[row * w + px] += (Math.min(x1, px + 1) - Math.max(x0, px)) / SUB;
    }
  }
  const g = new Uint8Array(w * h);
  let area = 0;
  for (let i = 0; i < g.length; i++) if (cover[i] > 0.5) { g[i] = 1; area++; }
  return { g, area };
}

/* ---------- skeleton + pen walk: variant-d.js, unchanged ---------- */
function thin(g, w, h) {
  let x, y, i, pass, changed = true;
  const del = [];
  while (changed) {
    changed = false;
    for (pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
        i = y * w + x;
        if (!g[i]) continue;
        const p2 = g[i - w], p3 = g[i - w + 1], p4 = g[i + 1], p5 = g[i + w + 1],
          p6 = g[i + w], p7 = g[i + w - 1], p8 = g[i - 1], p9 = g[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (pass === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
        del.push(i);
      }
      for (i = 0; i < del.length; i++) g[del[i]] = 0;
      if (del.length) changed = true;
    }
  }
  for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
    i = y * w + x;
    if (!g[i]) continue;
    const n = g[i - w], e = g[i + 1], s = g[i + w], wv = g[i - 1];
    if ((n && e && !s && !wv && !g[i + w - 1]) || (e && s && !wv && !n && !g[i - w - 1]) ||
        (s && wv && !n && !e && !g[i - w + 1]) || (wv && n && !e && !s && !g[i + w + 1])) g[i] = 0;
  }
}
/* g: 1 = to ink, 2 = inked. Returns strokes of pixel indices, in pen order. */
function walk(g, w, reach) {
  const NB = [-w, 1, w, -1, -w + 1, w + 1, w - 1, -w - 1];
  const X = (i) => i % w, Y = (i) => (i / w) | 0;
  const open = (i) => { const o = []; for (let k = 0; k < 8; k++) if (g[i + NB[k]] === 1) o.push(i + NB[k]); return o; };
  const inked = (i) => { for (let k = 0; k < 8; k++) if (g[i + NB[k]] === 2) return true; return false; };
  const probe = (c, from) => {
    const seen = [from, c];
    let p = c;
    for (let s = 0; s < 7; s++) {
      const nb = open(p).filter((q) => seen.indexOf(q) < 0);
      if (!nb.length) break;
      p = nb[0]; seen.push(p);
    }
    return p;
  };
  const strokes = [];
  let left = 0, i;
  for (i = 0; i < g.length; i++) left += g[i];

  while (left > 0) {
    let start = -1, best = Infinity, loop = -1, loopBest = Infinity;
    for (i = 0; i < g.length; i++) {
      if (g[i] !== 1) continue;
      if (open(i).length <= 1) { const sc = X(i) + 0.4 * Y(i); if (sc < best) { best = sc; start = i; } }
      else { const ls = Y(i) + 0.2 * X(i); if (ls < loopBest) { loopBest = ls; loop = i; } }
    }
    const isLoop = start < 0;
    if (isLoop) start = loop;
    const rooted = inked(start), pathPx = [start];
    let cur = start;
    g[start] = 2; left--;
    for (;;) {
      const cand = open(cur);
      let next = -1;
      const back = pathPx[Math.max(0, pathPx.length - 7)];
      let hx = X(cur) - X(back), hy = Y(cur) - Y(back);
      if (pathPx.length < 2) { hx = isLoop ? -1 : 0; hy = isLoop ? 0.4 : 0; }
      if (cand.length === 1) next = cand[0];
      else if (cand.length > 1) {
        let bd = -Infinity;
        for (const c of cand) {
          const far = probe(c, cur), dx = X(far) - X(cur), dy = Y(far) - Y(cur);
          const dot = (dx * hx + dy * hy) / (Math.hypot(dx, dy) || 1);
          if (dot > bd) { bd = dot; next = c; }
        }
      } else if (pathPx.length > 4) {
        /* dead end: carry straight on across ink already laid (the crossing of a t or an x) */
        const hl = Math.hypot(hx, hy) || 1, cx = X(cur), r = Math.ceil(reach);
        let nearest = reach + 1;
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
          const q = cur + yy * w + xx, dl = Math.hypot(xx, yy);
          if (q < 0 || q >= g.length || g[q] !== 1 || dl > reach || dl >= nearest) continue;
          if (Math.abs(X(q) - cx - xx) > 0.5) continue;
          if ((xx * hx + yy * hy) / (dl * hl) > 0.82) { nearest = dl; next = q; }
        }
      }
      if (next < 0) break;
      g[next] = 2; left--; pathPx.push(next); cur = next;
    }
    if (pathPx.length <= 3 && rooted) continue;
    strokes.push(pathPx);
  }
  return strokes;
}

/* glyph → pen strokes [[x, y], …] in font units, y down from the baseline */
function centreLine(glyph, font) {
  const sc = SIZE * RASTER / font.unitsPerEm, pad = 3;
  const bb = glyph.getBoundingBox();
  const w = Math.ceil((bb.x2 - bb.x1) * sc) + pad * 2, h = Math.ceil((bb.y2 - bb.y1) * sc) + pad * 2;
  if (!(w > pad * 2 && h > pad * 2)) return [];
  const ox = pad - bb.x1 * sc, oy = pad + bb.y2 * sc;
  const { g, area } = rasterise(flatten(glyph.getPath(ox, oy, SIZE * RASTER).commands), w, h);
  thin(g, w, h);
  let bones = 0;
  for (let i = 0; i < g.length; i++) bones += g[i];
  const stem = bones ? Math.max(4, area / bones) : 4;
  return walk(g, w, stem).map((pathPx) => {
    let pts = pathPx.map((q) => [q % w + 0.5, ((q / w) | 0) + 0.5]);
    for (let pass = 0; pass < 3; pass++) {
      const sm = pts.slice();
      for (let k = 1; k < pts.length - 1; k++) sm[k] = [(pts[k - 1][0] + 2 * pts[k][0] + pts[k + 1][0]) / 4, (pts[k - 1][1] + 2 * pts[k][1] + pts[k + 1][1]) / 4];
      pts = sm;
    }
    const out = pts.map((p) => [(p[0] - ox) / sc, (p[1] - oy) / sc]);
    if (out.length === 1) out.push([out[0][0] + 0.2 / SIZE * font.unitsPerEm, out[0][1]]);   // a dot
    return out;
  });
}

/* ---------- compact path data ---------- */
function simplify(pts, eps) {            // Douglas-Peucker
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, dl = Math.hypot(dx, dy) || 1;
    let far = -1, fd = eps;
    for (let i = a + 1; i < b; i++) {
      const d = dl < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / dl;
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/* numbers run together where SVG allows it: "12-5" for "12 -5" */
const join = (nums) => nums.map((n, i) => (i && n >= 0 ? ' ' : '') + n).join('');
/* integer path data with relative commands; a repeated command letter is left out */
function pathData(commands) {
  let d = '', x = 0, y = 0, last = '';
  const R = Math.round;
  const put = (letter, nums) => { d += (letter === last ? (nums[0] >= 0 ? ' ' : '') : letter) + join(nums); last = letter; };
  for (const c of commands) {
    if (c.type === 'Z') { d += 'z'; last = 'z'; continue; }
    const nx = R(c.x), ny = R(c.y);
    if (c.type === 'M') { put('M', [nx, ny]); last = 'M!'; }           // never fold into an M (it would read as a line)
    else if (c.type === 'L') {
      if (nx === x && ny === y) continue;
      if (ny === y) put('h', [nx - x]); else if (nx === x) put('v', [ny - y]); else put('l', [nx - x, ny - y]);
    }
    else if (c.type === 'Q') put('q', [R(c.x1) - x, R(c.y1) - y, nx - x, ny - y]);
    else if (c.type === 'C') put('c', [R(c.x1) - x, R(c.y1) - y, R(c.x2) - x, R(c.y2) - y, nx - x, ny - y]);
    x = nx; y = ny;
  }
  return d;
}
function lineData(pts) {
  const r = pts.map((p) => [Math.round(p[0]), Math.round(p[1])]);
  let d = 'M' + join(r[0]), len = 0, first = true;
  for (let i = 1; i < r.length; i++) {
    const dx = r[i][0] - r[i - 1][0], dy = r[i][1] - r[i - 1][1];
    if (!dx && !dy && r.length > 2) continue;
    d += (first ? 'l' : (dx >= 0 ? ' ' : '')) + join([dx || (r.length === 2 && !dy ? 1 : 0), dy]);
    first = false;
    len += Math.hypot(dx, dy);
  }
  return [Math.max(1, Math.round(len)), d];
}

/* ---------- build ---------- */
const buf = fs.readFileSync(FONT);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const Q = EM / font.unitsPerEm;
const copy = [];
const chars = [...new Set((SAFE + copy.join('')).split(''))];
const glyphs = {}, missing = [], used = [];
for (const ch of chars) {
  const g = font.charToGlyph(ch);
  if (!g || g.index === 0) { if (copy.join('').includes(ch)) missing.push(ch); continue; }
  const entry = [Math.round(g.advanceWidth * Q)];
  const outline = pathData(g.getPath(0, 0, EM).commands);
  if (outline) {
    entry.push(outline);
    for (const stroke of centreLine(g, font)) entry.push(...lineData(simplify(stroke, SIMPLIFY).map((p) => [p[0] * Q, p[1] * Q])));
  }
  glyphs[ch] = entry;
  used.push([ch, g]);
}
const kern = {};
for (const [a, ga] of used) for (const [b, gb] of used) {
  const k = Math.round(font.getKerningValue(ga, gb) * Q);
  if (k) kern[a + b] = k;
}
const data = {
  font: 'Caveat SemiBold (SIL OFL 1.1), outlines and traced centre-lines; see scripts/fonts/Caveat-OFL.txt',
  upm: EM,
  asc: Math.round(font.ascender * Q),
  desc: Math.round(-font.descender * Q),
  glyphs,
  kern,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const json = JSON.stringify(data);
fs.writeFileSync(OUT, json);
console.log(`${path.relative(root, OUT)}: ${Object.keys(glyphs).length} glyphs, ${Object.keys(kern).length} kerning pairs, ${(json.length / 1024).toFixed(1)} KB`);
if (missing.length) console.warn(`not in the font (left as gaps): ${missing.join(' ')}`);
