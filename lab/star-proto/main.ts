// Lab "star-proto": three ways to draw the returning star diagram on a fact page, to pick by eye.
//   ?v=a  classic radial star      ?v=b  ordered comb (ledger)      ?v=c  orbit rings by reach
//   ?t=DW_NS_SALES_ORDER_LINES_F (default) or any fact in the data-model CSV
//   ?hover=DW_NS_ITEM_D  pre-hovers a node (screenshots)
// Stated only. Relationships: Oracle's 26R4 "NSAW Data Models" diagrams (data-src/nsaw_data_model_edges.csv), which
// state that a fact relates to a set of tables, with no join columns, direction or cardinality. The header partner and
// its key: Oracle's Entity Key List. Reach: how many subject areas list the table (bus matrix in core.json).

import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/source-sans-3/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '../../styles/tokens.generated.css';
import '../../styles/explorer/base.css';
import './style.css';
import edgesCsv from '../../data-src/nsaw_data_model_edges.csv?raw';
import { loadOntology } from '../../ontology/load';
import { buildCore, findTable, grainSentence, headerOf, primaryGrain, keyOrder, prettyTable, shortTable } from '../../explorer/data';
import type { CoreModel } from '../../explorer/data';

// ------------------------------------------------------------------ data
type Variant = 'a' | 'b' | 'c';
interface Rel { name: string; pretty: string; fact: boolean; reach: number | null }
interface Header { name: string; pretty: string; on: string; key: string; reach: number | null }
interface Star { name: string; pretty: string; grain: string | null; keys: string[]; header?: Header; dims: Rel[]; facts: Rel[]; area: string }

const q = new URLSearchParams(location.search);
const variant: Variant = (['a', 'b', 'c'].includes(q.get('v') ?? '') ? q.get('v') : 'a') as Variant;
const DEFAULT = 'DW_NS_SALES_ORDER_LINES_F';
const SMALL = 'DW_NS_TRANSFER_LINES_F';
const factName = (q.get('t') ?? DEFAULT).toUpperCase();
const hoverName = q.get('hover');

const rows = edgesCsv.trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
const byFact = new Map<string, { area: string; related: string[] }>();
for (const [area, fact, rel] of rows) {
  const k = fact.toUpperCase();
  const e = byFact.get(k) ?? byFact.set(k, { area, related: [] }).get(k)!;
  e.related.push(rel);
}

const o = await loadOntology({ baseUrl: '/ontology/', fetchJson: async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} -> ${r.status}`); return r.json(); } });
const m: CoreModel = buildCore(o.core);
const N = m.bus.rows.length; // subject areas in the bus matrix

const reachOf = (t: number | undefined): number | null => {
  if (t === undefined) return null;
  const c = m.tables[t].col;
  return c >= 0 ? m.bus.columnSaCount[c] : null;
};
const isFactT = (t: number | undefined) => t !== undefined && (m.tables[t].role === 'fact' || m.tables[t].role === 'enhanced');

function star(name: string): Star | null {
  const e = byFact.get(name);
  const t = findTable(m, name);
  if (!e || t === undefined) return null;
  const rels: Rel[] = e.related.map((r) => {
    const ti = findTable(m, r);
    const nm = ti !== undefined ? m.tables[ti].name : r;
    return { name: nm, pretty: prettyTable(m, nm), fact: isFactT(ti), reach: reachOf(ti) };
  });
  const byReach = (a: Rel, b: Rel) => (b.reach ?? -1) - (a.reach ?? -1) || a.pretty.localeCompare(b.pretty);
  const h = headerOf(m, t);
  const g = primaryGrain(m, t);
  return {
    name: m.tables[t].name, pretty: prettyTable(m, m.tables[t].name), grain: grainSentence(m, t), area: e.area,
    keys: g ? keyOrder(g.cols) : [],
    header: h ? { name: m.tables[h.table].name, pretty: prettyTable(m, m.tables[h.table].name), on: h.col.toLowerCase(), key: 'id', reach: reachOf(h.table) } : undefined,
    dims: rels.filter((r) => !r.fact).sort(byReach),
    facts: rels.filter((r) => r.fact).sort(byReach),
  };
}

// ------------------------------------------------------------------ svg + text helpers
const NS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number | undefined>;
function el<K extends keyof SVGElementTagNameMap>(tag: K, a: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a)) if (v !== undefined) n.setAttribute(k, String(v));
  parent?.appendChild(n);
  return n;
}
function txt(parent: Element, x: number, y: number, s: string, cls: string, anchor: 'start' | 'middle' | 'end' = 'start') {
  const t = el('text', { x: r1(x), y: r1(y), class: cls, 'text-anchor': anchor }, parent);
  t.textContent = s;
  return t;
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const h = (tag: string, cls?: string, html?: string) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const FONT = {
  ui13: '400 13px "Source Sans 3 Variable"',
  ui14: '400 14px "Source Sans 3 Variable"',
  mono12: '400 12px "JetBrains Mono Variable"',
  mono13: '500 13px "JetBrains Mono Variable"',
  monoS: '400 10.5px "JetBrains Mono Variable"',
  it13: 'italic 400 13px "Source Serif 4 Variable"',
  serif16: '400 17px "Source Serif 4 Variable"',
};
const ctx = document.createElement('canvas').getContext('2d')!;
const measure = (s: string, font: string) => { ctx.font = font; return ctx.measureText(s).width; };
function wrap(s: string, font: string, w: number): string[] {
  const out: string[] = []; let line = '';
  for (const word of s.split(' ')) {
    const tryL = line ? `${line} ${word}` : word;
    if (measure(tryL, font) > w && line) { out.push(line); line = word; } else line = tryL;
  }
  if (line) out.push(line);
  return out;
}
/** Wrap, then narrow the measure while the line count holds, so the last line is not a lone word. */
function wrapBalanced(s: string, font: string, w: number): string[] {
  const base = wrap(s, font, w);
  if (base.length < 2) return base;
  let best = base;
  for (let ww = w - 6; ww > w * 0.55; ww -= 6) { const t = wrap(s, font, ww); if (t.length !== base.length) break; best = t; }
  return best;
}

interface Box { x: number; y: number; w: number; h: number }
const overlap = (a: Box, b: Box, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
/** Liang-Barsky: does segment p->q cross box b? */
function segHits(px: number, py: number, qx: number, qy: number, b: Box): boolean {
  let t0 = 0, t1 = 1; const dx = qx - px, dy = qy - py;
  const ps = [-dx, dx, -dy, dy], qs = [px - b.x, b.x + b.w - px, py - b.y, b.y + b.h - py];
  for (let i = 0; i < 4; i++) {
    if (ps[i] === 0) { if (qs[i] < 0) return false; continue; }
    const r = qs[i] / ps[i];
    if (ps[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}
/** Where the ray from the box centre towards (tx,ty) leaves the box. */
function exitPoint(b: Box, tx: number, ty: number): [number, number] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy;
  const s = Math.min(Math.abs(dx) > 0 ? b.w / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 0 ? b.h / 2 / Math.abs(dy) : Infinity);
  return [cx + dx * s, cy + dy * s];
}

// ------------------------------------------------------------------ shared pieces: cards, the key link, reach bar
const SRC_DM = "stated in Oracle's 26R4 data model";
const SRC_KEY = "stated in Oracle's Entity Key List";

interface HoverInfo { title: string; mono: string; detail: string; src: string }
const hoverInfo = new Map<string, HoverInfo>();
const reachText = (r: number | null) => (r === null ? 'fact table' : `in ${r} of ${N} subject areas`);

function factCard(g: Element, x: number, y: number, w: number, s: Star, compact = false): Box {
  const pad = compact ? 14 : 18;
  const gfont = compact ? '400 15px "Source Serif 4 Variable"' : FONT.serif16;
  const lh = compact ? 19 : 22;
  const lines = s.grain ? wrapBalanced(s.grain, gfont, w - pad * 2) : [];
  const hgt = pad + 14 + 20 + lines.length * lh + (s.keys.length ? 30 : 6) + pad - 6;
  const card = el('g', { class: 'fact-card' }, g);
  el('rect', { x: r1(x), y: r1(y), width: r1(w), height: r1(hgt), class: 'card card-main' }, card);
  let yy = y + pad + 10;
  txt(card, x + pad, yy, 'fact', 't-it');
  txt(card, x + w - pad, yy, 'this table', 't-it t-faint', 'end');
  yy += 21;
  txt(card, x + pad, yy, s.name, 't-mono13');
  yy += 6;
  for (const l of lines) { yy += lh; txt(card, x + pad, yy, l, compact ? 't-serif15' : 't-serif17'); }
  if (s.keys.length) {
    yy += 25;
    let xx = x + pad;
    txt(card, xx, yy, 'key', 't-it t-faint'); xx += measure('key', FONT.it13) + 10;
    s.keys.forEach((k, i) => {
      if (i) { txt(card, xx + 2, yy, '+', 't-ui13 t-faint'); xx += 16; }
      txt(card, xx, yy, k, 't-key');
      const kw = measure(k, FONT.mono13);
      el('line', { x1: r1(xx), x2: r1(xx + kw), y1: r1(yy + 4), y2: r1(yy + 4), class: 'key-ul' }, card);
      xx += kw + 4;
    });
  }
  return { x, y, w, h: hgt };
}

const HDR_H = 68;
function headerCard(g: Element, x: number, y: number, w: number, hd: Header): Box {
  const hgt = HDR_H;
  const card = el('g', { class: 'node hdr', 'data-id': hd.name }, g);
  el('rect', { x: r1(x), y: r1(y), width: r1(w), height: hgt, class: 'card' }, card);
  txt(card, x + 14, y + 21, 'header', 't-it');
  txt(card, x + 14, y + 41, hd.name, 't-mono12 t-ink');
  txt(card, x + 14, y + 58, `key ${hd.key}`, 't-monoS t-soft');
  hoverInfo.set(hd.name, { title: hd.pretty, mono: hd.name, detail: `header: ${hd.key} = ${hd.on}, one header to many lines`, src: SRC_KEY });
  return { x, y, w, h: hgt };
}
const headerW = (hd: Header) => Math.max(200, measure(hd.name, FONT.mono12) + 28);

/** Vertical key link from header (above) to the fact card (below). */
function keyLink(g: Element, x: number, y1: number, y2: number, hd: Header, side: 'right' | 'left' = 'right') {
  const lg = el('g', { class: 'lnk key-link', 'data-id': hd.name }, g);
  el('line', { x1: x, x2: x, y1, y2: y2 - 1, class: 'wire wire-key' }, lg);
  el('line', { x1: x - 5, x2: x + 5, y1: y1 + 8, y2: y1 + 8, class: 'wire wire-key' }, lg); // "one" tick
  el('path', { d: `M${x - 5} ${y2 - 9} L${x} ${y2 - 1} L${x + 5} ${y2 - 9}`, class: 'wire wire-key', fill: 'none' }, lg); // "many" chevron
  const sx = side === 'right' ? x + 12 : x - 12, an = side === 'right' ? 'start' : 'end';
  txt(lg, sx, y1 + 13, '1', 't-monoS t-soft', an);
  txt(lg, sx, y2 - 5, 'many', 't-monoS t-soft', an);
  txt(lg, sx, (y1 + y2) / 2 + 4, `${hd.key} = ${hd.on}`, 't-key', an);
}

function smallFactCard(g: Element, x: number, y: number, r: Rel): Box {
  const w = Math.max(160, measure(r.name, FONT.mono12) + 28), hgt = 46;
  const card = el('g', { class: 'node', 'data-id': r.name }, g);
  el('rect', { x: r1(x), y: r1(y), width: r1(w), height: hgt, class: 'card' }, card);
  txt(card, x + 14, y + 18, 'fact', 't-it');
  txt(card, x + 14, y + 36, r.name, 't-mono12 t-ink');
  return { x, y, w, h: hgt };
}
const smallFactW = (r: Rel) => Math.max(160, measure(r.name, FONT.mono12) + 28);

function reachBar(g: Element, x: number, y: number, w: number, r: number, hgt = 3) {
  el('rect', { x: r1(x), y: r1(y), width: r1(w), height: hgt, class: 'bar-track' }, g);
  el('rect', { x: r1(x), y: r1(y), width: r1(Math.max(1.5, (w * r) / N)), height: hgt, class: 'bar-fill' }, g);
}

function register(rs: Rel[]) {
  for (const r of rs) hoverInfo.set(r.name, { title: r.pretty, mono: r.name, detail: reachText(r.reach), src: SRC_DM });
}

// ------------------------------------------------------------------ A. classic radial star
function drawA(svg: SVGSVGElement, s: Star, W: number): number {
  const dims = s.dims;
  const left: Rel[] = [], right: Rel[] = [];
  // alphabetical around the star: left column top->bottom, right column top->bottom
  const alpha = dims.slice().sort((a, b) => a.pretty.localeCompare(b.pretty));
  const nL = Math.ceil(alpha.length / 2);
  alpha.forEach((d, i) => (i < nL ? left : right).push(d));
  const step = 46;
  const cardW = 372;
  // centre cluster sizes
  const hdW = s.header ? headerW(s.header) : 0;
  const gap = 64;
  const probe = el('g', {}, svg); const fb = factCard(probe, 0, 0, cardW, s); probe.remove();
  const facts = s.facts;
  const clusterH = (s.header ? HDR_H + gap : 0) + fb.h + (facts.length ? 52 + 46 : 0);
  const span = Math.max((nL - 1) * step, clusterH + 40);
  const top = 30;
  const cy = top + span / 2 + 10;
  const cx = W / 2;
  const H = top + span + 60;
  const Rx = Math.min(W / 2 - 250, 540);

  const gLinks = el('g', { class: 'links' }, svg);
  const gNodes = el('g', { class: 'nodes' }, svg);

  // fact card: vertically centred on cy (cluster offset so the card centre is the star centre)
  const fy = cy - fb.h / 2;
  const fx = cx - cardW / 2;
  const fbox = factCard(gNodes, fx, fy, cardW, s);
  if (s.header) {
    const hy = fy - gap - HDR_H;
    headerCard(gNodes, cx - hdW / 2, hy, hdW, s.header);
    keyLink(gLinks, cx, hy + HDR_H, fy, s.header);
  }
  if (facts.length) {
    const tw = facts.reduce((a, r) => a + smallFactW(r), 0) + (facts.length - 1) * 20;
    let x = cx - tw / 2;
    const y = fy + fbox.h + 52;
    for (const r of facts) {
      const w = smallFactW(r);
      const lg = el('g', { class: 'lnk', 'data-id': r.name }, gLinks);
      el('line', { x1: r1(x + w / 2), x2: r1(x + w / 2), y1: r1(fy + fbox.h), y2: y, class: 'wire' }, lg);
      smallFactCard(gNodes, x, y, r);
      x += w + 20;
    }
  }
  register(facts);
  register(dims);

  const place = (list: Rel[], side: -1 | 1) => {
    const n = list.length;
    const sp = Math.max((n - 1) * step, Math.min(span, (n - 1) * 70));
    list.forEach((d, i) => {
      const y = cy - sp / 2 + (n === 1 ? sp / 2 : (i * sp) / (n - 1));
      const dy = (y - cy) / (sp / 2 + step * 1.4);
      const x = cx + side * (cardW / 2 + 70 + (Rx - cardW / 2 - 70) * Math.sqrt(Math.max(0, 1 - dy * dy)));
      const port: [number, number] = [cx + side * (cardW / 2), cy];
      const lg = el('g', { class: 'lnk', 'data-id': d.name }, gLinks);
      el('line', { x1: r1(port[0]), y1: r1(port[1]), x2: r1(x), y2: r1(y), class: 'wire' }, lg);
      const ng = el('g', { class: 'node dim', 'data-id': d.name }, gNodes);
      el('circle', { cx: r1(x), cy: r1(y), r: 2.6, class: 'dot' }, ng);
      const tx = x + side * 10, an = side < 0 ? 'end' : 'start';
      txt(ng, tx, y - 1, d.pretty, 't-ui13 t-ink name', an);
      if (d.reach !== null) {
        const bw = 44;
        const label = `${d.reach}`;
        const lw = measure(label, FONT.monoS);
        if (side < 0) { reachBar(ng, tx - bw, y + 8, bw, d.reach, 2.5); txt(ng, tx - bw - 6, y + 12, label, 't-monoS t-soft', 'end'); }
        else { reachBar(ng, tx, y + 8, bw, d.reach, 2.5); txt(ng, tx + bw + 6, y + 12, label, 't-monoS t-soft'); }
        void lw;
      }
      // invisible hit area
      const nw = measure(d.pretty, FONT.ui13) + 20;
      el('rect', { x: r1(side < 0 ? x - nw : x - 6), y: r1(y - 16), width: r1(nw + 6), height: 34, class: 'hit' }, ng);
    });
  };
  place(left, -1);
  place(right, 1);
  // port dots
  el('circle', { cx: cx - cardW / 2, cy, r: 2.2, class: 'port' }, gNodes);
  el('circle', { cx: cx + cardW / 2, cy, r: 2.2, class: 'port' }, gNodes);
  return H;
}

// ------------------------------------------------------------------ B. ordered comb (ledger)
function drawB(svg: SVGSVGElement, s: Star, W: number): number {
  const half = N / 2;
  const most = s.dims.filter((d) => (d.reach ?? 0) >= half);
  const fewer = s.dims.filter((d) => (d.reach ?? 0) < half);
  register(s.dims); register(s.facts);
  const cardW = 300;
  const gLinks = el('g', { class: 'links' }, svg);
  const gNodes = el('g', { class: 'nodes' }, svg);
  let fy = 8;
  if (s.header) {
    const hw = headerW(s.header);
    headerCard(gNodes, 0, 8, hw, s.header);
    fy = 8 + HDR_H + 66;
    keyLink(gLinks, 40, 8 + HDR_H, fy, s.header);
  }
  const fbox = factCard(gNodes, 0, fy, cardW, s);
  const trunkY = fy + 31; // aligned with the mono name row
  const colsX = cardW + 96;
  const colGap = 64;
  const groups: { title: string; items: Rel[] }[] = [];
  if (most.length) groups.push({ title: `In most subject areas`, items: most });
  if (fewer.length) groups.push({ title: `In fewer subject areas`, items: fewer });
  if (s.facts.length) groups.push({ title: 'Fact tables', items: s.facts });
  // two columns (first group in column 1, the rest stacked in column 2); one column when the list is short
  const total = s.dims.length + s.facts.length;
  const one = total <= 14 || groups.length === 1;
  const colW = one ? Math.min(W - colsX, 620) : (W - colsX - colGap) / 2;
  const columns: { title: string; items: Rel[] }[][] = one ? [groups] : [[groups[0]], groups.slice(1)];
  const rowH = 30;
  let maxY = fbox.y + fbox.h;
  el('line', { x1: cardW, x2: r1(one ? colsX : colsX + colW + colGap), y1: trunkY, y2: trunkY, class: 'wire' }, gLinks);
  el('circle', { cx: cardW, cy: trunkY, r: 2.2, class: 'port' }, gNodes);
  columns.forEach((col, ci) => {
    if (!col.length || !col[0]) return;
    const x0 = colsX + ci * (colW + colGap);
    let y = trunkY;
    let lastRow = y;
    col.forEach((grp, gi) => {
      if (gi > 0) y += 26;
      // group title sits just above the first row (for the first group, above the trunk)
      const ty = gi === 0 ? trunkY - 12 : y + 22;
      txt(gNodes, x0 + 26, ty, grp.title, 't-it-h');
      txt(gNodes, x0 + colW, ty, String(grp.items.length), 't-monoS t-soft', 'end');
      if (gi === 0) y += 8; else y += 36;
      for (const r of grp.items) {
        const ry = y + rowH / 2;
        const lg = el('g', { class: 'lnk', 'data-id': r.name }, gLinks);
        el('line', { x1: x0, x2: x0 + 18, y1: r1(ry), y2: r1(ry), class: 'wire' }, lg);
        const ng = el('g', { class: 'node row', 'data-id': r.name }, gNodes);
        el('rect', { x: x0 + 18, y: r1(y), width: r1(colW - 18), height: rowH, class: 'row-bg' }, ng);
        el('line', { x1: x0 + 26, x2: r1(x0 + colW), y1: r1(y + rowH), y2: r1(y + rowH), class: 'row-rule' }, ng);
        el('circle', { cx: x0 + 18, cy: r1(ry), r: 2.2, class: 'dot' }, ng);
        txt(ng, x0 + 26, ry + 4.5, r.pretty, 't-ui14 t-ink name');
        if (r.reach !== null) {
          const bw = Math.min(140, colW * 0.3);
          const nx = x0 + colW - 62;
          reachBar(ng, nx - bw - 10, ry - 2, bw, r.reach, 4);
          txt(ng, x0 + colW, ry + 4, `${r.reach} of ${N}`, 't-monoS t-soft', 'end');
        } else {
          txt(ng, x0 + colW, ry + 4, r.name, 't-mono12 t-soft', 'end');
        }
        lastRow = ry;
        y += rowH;
      }
    });
    // spine from the trunk down to the last row
    el('line', { x1: x0, x2: x0, y1: trunkY, y2: r1(lastRow), class: 'wire' }, gLinks);
    maxY = Math.max(maxY, y);
  });
  return maxY + 20;
}

// ------------------------------------------------------------------ C. orbit rings by reach
function drawC(svg: SVGSVGElement, s: Star, W: number): number {
  register(s.dims); register(s.facts);
  const bands = [
    { min: 90, label: `in 90 or more of ${N} subject areas` },
    { min: 50, label: `in 50 to 89` },
    { min: 0, label: `in fewer than 50` },
  ];
  const ringOf = (r: number) => bands.findIndex((b) => r >= b.min);
  const rings: Rel[][] = [[], [], []];
  for (const d of s.dims) rings[ringOf(d.reach ?? 0)].push(d);

  // centre cluster: header above, fact card, related facts below
  const cardW = 256;
  const probe = el('g', {}, svg); const fb = factCard(probe, 0, 0, cardW, s, true); probe.remove();
  const gap = 44, gapF = 30;
  const hdW = s.header ? headerW(s.header) : 0;
  const clusterH = (s.header ? HDR_H + gap : 0) + fb.h + (s.facts.length ? gapF + 46 : 0);

  const maxLabel = Math.max(...s.dims.map((d) => measure(d.pretty, FONT.ui13))) + 24;
  const RxO = Math.min(W / 2 - maxLabel - 16, 540);
  const inner = Math.max(cardW / 2 + 110, RxO * 0.5);
  const rxs = [inner, (inner + RxO) / 2, RxO];
  const radii = rxs.map((rx, i) => ({ rx, ry: Math.max(rx * 0.6, i === 0 ? clusterH / 2 + 34 : 0) }));
  for (let i = 1; i < 3; i++) radii[i].ry = Math.max(radii[i].ry, radii[i - 1].ry + 70);
  const cx = W / 2;
  const cy = radii[2].ry + 40;
  const H = cy + radii[2].ry + 36;

  const gBands = el('g', { class: 'bands' }, svg);
  const gLinks = el('g', { class: 'links' }, svg);
  const gNodes = el('g', { class: 'nodes' }, svg);
  for (let i = 2; i >= 0; i--) {
    // each band reaches halfway to the next ring
    const ex = i === 2 ? 40 : (radii[i + 1].rx - radii[i].rx) / 2;
    const ey = i === 2 ? 28 : (radii[i + 1].ry - radii[i].ry) / 2;
    el('ellipse', { cx, cy, rx: r1(radii[i].rx + ex), ry: r1(radii[i].ry + ey), class: `band band-${i}` }, gBands);
  }

  const cTop = cy - clusterH / 2;
  const fy = cTop + (s.header ? HDR_H + gap : 0);
  const fbox = factCard(gNodes, cx - cardW / 2, fy, cardW, s, true);
  const obstacles: Box[] = [fbox];
  if (s.header) {
    const hb = headerCard(gNodes, cx - hdW / 2, cTop, hdW, s.header);
    keyLink(gLinks, cx, cTop + HDR_H, fy, s.header);
    obstacles.push(hb, { x: cx, y: cTop + HDR_H, w: 120, h: gap });
  }
  if (s.facts.length) {
    const tw = s.facts.reduce((a, r) => a + smallFactW(r), 0) + (s.facts.length - 1) * 20;
    let x = cx - tw / 2;
    const y = fy + fbox.h + gapF;
    for (const r of s.facts) {
      const w = smallFactW(r);
      const lg = el('g', { class: 'lnk', 'data-id': r.name }, gLinks);
      el('line', { x1: r1(x + w / 2), x2: r1(x + w / 2), y1: r1(fy + fbox.h), y2: y, class: 'wire' }, lg);
      obstacles.push(smallFactCard(gNodes, x, y, r), { x: x + w / 2 - 2, y: fy + fbox.h, w: 4, h: gapF });
      x += w + 20;
    }
  }
  // ring labels on the top of each ring, where no node sits
  const ringLabels: Box[] = [];
  radii.forEach((rr, i) => {
    if (!rings[i].length) return;
    const ly = cy - rr.ry;
    txt(gBands, cx, ly + 4, bands[i].label, 't-it-ring', 'middle');
    const w = measure(bands[i].label, 'italic 400 12.5px "Source Serif 4 Variable"');
    ringLabels.push({ x: cx - w / 2 - 8, y: ly - 11, w: w + 16, h: 22 });
  });

  // nodes on two side arcs of each ring, alphabetical top to bottom (left arc, then right arc);
  // greedy: inner ring first, each node takes the free angle nearest its slot
  const placed: Box[] = [...obstacles, ...ringLabels];
  const nFixed = placed.length;
  const segs: [number, number, number, number][] = [];
  const deg = Math.PI / 180;
  [2, 1, 0].forEach((ri) => {
    const list = rings[ri];
    const { rx, ry } = radii[ri];
    const sorted = list.slice().sort((a, b) => a.pretty.localeCompare(b.pretty));
    const nL = Math.ceil(sorted.length / 2);
    sorted.forEach((d, k) => {
      const left = k < nL;
      const m = left ? nL : sorted.length - nL;
      const j = left ? k : k - nL;
      const half = Math.min(64, 9 + 12 * m) * deg;
      const t = m === 1 ? 0.5 : j / (m - 1);
      const stagger = (ri % 2 ? 1 : -1) * 4 * deg;
      // right arc: -half (top) .. +half (bottom); left arc: PI+half (top) .. PI-half (bottom)
      const ideal = left ? Math.PI + half - t * 2 * half + stagger : -half + t * 2 * half + stagger;
      const lw = measure(d.pretty, FONT.ui13);
      let best: { a: number; box: Box; x: number; y: number; side: number; cost: number } | null = null;
      for (let st = 0; st < 200; st++) {
        const da = (st % 2 ? 1 : -1) * Math.ceil(st / 2) * 0.5 * deg;
        const a = ideal + da;
        const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
        const side = Math.cos(a) >= 0 ? 1 : -1;
        const bx = side > 0 ? x + 7 : x - 7 - lw;
        const box: Box = { x: bx - 3, y: y - 13, w: lw + 6, h: 31 };
        const dotBox: Box = { x: x - 5, y: y - 5, w: 10, h: 10 };
        const [px, py] = exitPoint(fbox, x, y);
        let cost = Math.abs(da) * 4;
        if (placed.some((p) => overlap(p, box, 2) || overlap(p, dotBox, 2))) cost += 100;
        if (placed.slice(1).some((p, i) => (i < nFixed - 1 ? segHits(px, py, x, y, p) : segHits(px, py, x, y, { x: p.x + 2, y: p.y + 3, w: p.w - 4, h: p.h - 6 })))) cost += 60;
        if (segs.some(([sx, sy, tx, ty]) => segHits(sx, sy, tx, ty, { x: box.x - 2, y: box.y + 1, w: box.w + 4, h: box.h - 2 }))) cost += 60;
        // keep lines apart: a near-parallel neighbour reads as one line
        const dir = Math.atan2(y - cy, x - cx);
        for (const [, , tx, ty] of segs) {
          let dd = Math.abs(Math.atan2(ty - cy, tx - cx) - dir); if (dd > Math.PI) dd = 2 * Math.PI - dd;
          if (dd < 3.2 * deg) cost += (3.2 * deg - dd) / deg * 12;
        }
        if (!best || cost < best.cost) best = { a, box, x, y, side, cost };
        if (cost < 0.5) break;
      }
      const b = best!;
      placed.push(b.box, { x: b.x - 5, y: b.y - 5, w: 10, h: 10 });
      const [px, py] = exitPoint(fbox, b.x, b.y);
      segs.push([px, py, b.x, b.y]);
      const lg = el('g', { class: 'lnk', 'data-id': d.name }, gLinks);
      el('line', { x1: r1(px), y1: r1(py), x2: r1(b.x), y2: r1(b.y), class: 'wire' }, lg);
      const ng = el('g', { class: 'node dim', 'data-id': d.name }, gNodes);
      el('circle', { cx: r1(b.x), cy: r1(b.y), r: 3, class: 'dot' }, ng);
      const an = b.side > 0 ? 'start' : 'end';
      const tx = b.x + b.side * 9;
      txt(ng, tx, b.y + 1, d.pretty, 't-ui13 t-ink name halo', an);
      if (d.reach !== null) txt(ng, tx, b.y + 14, `${d.reach}`, 't-monoS t-soft halo', an);
      el('rect', { x: r1(b.box.x - 8), y: r1(b.box.y - 2), width: r1(b.box.w + 16), height: r1(b.box.h + 4), class: 'hit' }, ng);
    });
  });
  return H;
}

// ------------------------------------------------------------------ narrow: stacked list
function stackList(s: Star): HTMLElement {
  const box = h('div', 'stack');
  const fc = h('div', 'stack-fact');
  fc.innerHTML = `<div class="it">fact <span class="faint">· this table</span></div><div class="mono">${esc(s.name)}</div>` +
    (s.grain ? `<div class="g">${esc(s.grain)}</div>` : '') +
    (s.keys.length ? `<div class="k"><i>key</i> ${s.keys.map((k) => `<span class="ktag hot">${esc(k)}</span>`).join(' + ')}</div>` : '');
  if (s.header) {
    const hd = h('div', 'stack-hdr');
    hd.innerHTML = `<div class="it">header</div><div class="mono">${esc(s.header.name)}</div><div class="hk"><span class="kk">${esc(s.header.key)} = ${esc(s.header.on)}</span> <span class="faint">one header to many lines</span></div>`;
    box.append(hd);
  }
  box.append(fc);
  const half = N / 2;
  const groups: [string, Rel[]][] = [
    ['In most subject areas', s.dims.filter((d) => (d.reach ?? 0) >= half)],
    ['In fewer subject areas', s.dims.filter((d) => (d.reach ?? 0) < half)],
    ['Fact tables', s.facts],
  ];
  for (const [title, items] of groups) {
    if (!items.length) continue;
    const g = h('div', 'stack-group');
    g.append(h('div', 'stack-title', `<i>${esc(title)}</i><span class="mono faint">${items.length}</span>`));
    const ul = h('ul');
    for (const r of items) {
      const li = h('li');
      li.innerHTML = `<span class="nm">${esc(r.pretty)}</span>` + (r.reach !== null
        ? `<span class="bar"><span style="width:${((r.reach / N) * 100).toFixed(1)}%"></span></span><span class="mono faint n">${r.reach}</span>`
        : `<span class="mono faint fname">${esc(shortTable(r.name))}</span>`);
      ul.append(li);
    }
    g.append(ul);
    box.append(g);
  }
  return box;
}

// ------------------------------------------------------------------ page
const VARIANTS: { id: Variant; name: string; blurb: string }[] = [
  { id: 'a', name: 'Radial star', blurb: 'The fact in the centre, related tables on two arcs in alphabetical order.' },
  { id: 'b', name: 'Comb ledger', blurb: 'The fact on the left, related tables in ruled columns ranked by reach.' },
  { id: 'c', name: 'Orbit rings', blurb: 'The fact in the centre, tables on rings by how many subject areas list them.' },
];
const link = (p: Record<string, string>) => {
  const u = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(p)) u.set(k, v);
  u.delete('hover');
  return `?${u.toString()}`;
};

const app = document.getElementById('app')!;
const s = star(factName) ?? star(DEFAULT)!;

await Promise.all([FONT.ui13, FONT.ui14, FONT.mono12, FONT.mono13, FONT.monoS, FONT.it13, FONT.serif16, '400 15px "Source Serif 4 Variable"', 'italic 400 15px "Source Serif 4 Variable"', 'italic 400 12.5px "Source Serif 4 Variable"'].map((f) => document.fonts.load(f)));

const vInfo = VARIANTS.find((v) => v.id === variant)!;
const examples = [DEFAULT, SMALL].map((n) => ({ n, s: star(n)! }));
app.innerHTML = `
<header class="top">
  <div class="brand"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.5" fill="var(--accent)"/><path d="M8 8 2 3M8 8l6-5M8 8l-6 5M8 8l6 5" stroke="var(--ink)" stroke-width="1.1"/></svg><b>NetSuite Data Intelligence Schema Explorer</b><span class="faint mono">lab · star</span></div>
  <nav class="tabs" aria-label="Design direction">${VARIANTS.map((v) => `<a href="${link({ v: v.id })}" ${v.id === variant ? 'aria-current="page"' : ''}><span class="mono">${v.id.toUpperCase()}</span> ${v.name}</a>`).join('')}</nav>
  <nav class="tabs ex" aria-label="Example">${examples.map((e) => `<a href="${link({ t: e.n })}" ${e.n === s.name ? 'aria-current="page"' : ''}>${esc(e.s.pretty)} <span class="faint num">${e.s.dims.length + e.s.facts.length}</span></a>`).join('')}</nav>
</header>
<main class="page">
  <p class="proto"><span class="mono">${variant.toUpperCase()}</span> <b>${vInfo.name}.</b> ${vInfo.blurb}</p>
  <div class="eyebrow"><i>fact</i> <span class="mono">${esc(s.name)}</span></div>
  <section class="sec">
    <div class="sec-head">
      <div>
        <h2>In Oracle's data model</h2>
        <p class="lede">Oracle's 26R4 data model diagram for this table, in <i>${esc(s.area)}</i>, relates it to ${s.dims.length + s.facts.length} tables${s.header ? `; the Entity Key List gives its header partner and the key between them` : ''}.</p>
      </div>
      <div class="legend">
        <span><svg width="26" height="8"><line x1="0" x2="26" y1="4" y2="4" stroke="var(--line)" stroke-width="1.1"/></svg>stated in the data model</span>
        ${s.header ? `<span><svg width="26" height="8"><line x1="0" x2="26" y1="4" y2="4" stroke="var(--line)" stroke-width="1.7"/></svg>stated in the key list</span>` : ''}
        <span><svg width="26" height="8"><rect x="0" y="3" width="26" height="3" fill="var(--rule)"/><rect x="0" y="3" width="17" height="3" fill="var(--ink-2)"/></svg>subject areas listing it, of ${N}</span>
      </div>
    </div>
    <figure class="fig v-${variant}">
      <div class="canvas"></div>
      <div class="tip" role="status" aria-live="polite" hidden></div>
      <figcaption>Oracle's data model diagram for this table states these relationships.</figcaption>
    </figure>
  </section>
</main>`;

const fig = app.querySelector<HTMLElement>('.fig')!;
const canvas = fig.querySelector<HTMLElement>('.canvas')!;
const tip = fig.querySelector<HTMLElement>('.tip')!;
fig.insertBefore(stackList(s), fig.querySelector('figcaption'));

let svg: SVGSVGElement | null = null;
function render() {
  const W = variant === 'b' ? canvas.clientWidth : Math.min(canvas.clientWidth, 1400);
  canvas.innerHTML = '';
  hoverInfo.clear();
  if (W < 700) { document.body.dataset.ready = '1'; return; }
  svg = el('svg', { width: W, class: 'star', role: 'img', 'aria-label': `${s.name} and the ${s.dims.length + s.facts.length} tables Oracle's data model relates it to` });
  canvas.appendChild(svg);
  const H = variant === 'a' ? drawA(svg, s, W) : variant === 'b' ? drawB(svg, s, W) : drawC(svg, s, W);
  svg.setAttribute('height', String(Math.ceil(H)));
  svg.setAttribute('viewBox', `0 0 ${W} ${Math.ceil(H)}`);
  wireHover(svg);
  if (hoverName) hover(hoverName.toUpperCase());
  document.body.dataset.ready = '1';
}

function hover(id: string | null) {
  if (!svg) return;
  svg.classList.toggle('has-on', !!id);
  svg.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
  if (!id) { tip.hidden = true; return; }
  const key = [...hoverInfo.keys()].find((k) => k.toUpperCase() === id);
  if (!key) { tip.hidden = true; return; }
  svg.querySelectorAll(`[data-id="${key}"]`).forEach((n) => n.classList.add('on'));
  const info = hoverInfo.get(key)!;
  tip.innerHTML = `<b>${esc(info.title)}</b><span class="sep">·</span><span class="mono">${esc(info.mono)}</span><span class="sep">·</span>${esc(info.detail)}<span class="sep">·</span><i>${esc(info.src)}</i>`;
  tip.hidden = false;
  const node = svg.querySelector<SVGGElement>(`.node[data-id="${key}"]`)!;
  // place the label where it covers the fewest other labels: beside the node on the side towards the
  // centre (over faded lines), then above, then below
  const nb = labelBox(node);
  const fr = fig.getBoundingClientRect(), cr = svg.getBoundingClientRect();
  const ox = cr.left - fr.left, oy = cr.top - fr.top;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const W = svg.viewBox.baseVal.width;
  const towardsCentre = nb.x + nb.w / 2 < W / 2 ? 1 : -1;
  const side = (dir: number, dy: number): Box => ({ x: dir > 0 ? nb.x + nb.w + 14 : nb.x - tw - 14, y: nb.y + nb.h / 2 - th / 2 + dy, w: tw, h: th });
  const cands: Box[] = variant === 'b'
    ? [{ x: nb.x, y: nb.y + nb.h + 8, w: tw, h: th }]
    : [
      side(towardsCentre, 0),
      { x: nb.x + nb.w / 2 - tw / 2, y: nb.y - th - 8, w: tw, h: th },
      { x: nb.x + nb.w / 2 - tw / 2, y: nb.y + nb.h + 6, w: tw, h: th },
      side(towardsCentre, -th - 4), side(towardsCentre, th + 4),
      side(-towardsCentre, 0),
    ];
  const others = [...svg.querySelectorAll<SVGGElement>('.node')].filter((n) => n !== node).map(labelBox);
  const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  let best = cands[0], bestA = Infinity;
  for (const c of cands) {
    c.x = Math.max(-ox, Math.min(c.x, fig.clientWidth - ox - tw));
    const a = others.reduce((t, o) => t + area(c, o), 0);
    if (a < bestA - 1) { best = c; bestA = a; }
  }
  tip.style.transform = `translate(${Math.round(ox + best.x)}px, ${Math.round(oy + best.y)}px)`;
}
/** A node's visible extent (its text and marks; the invisible hit area left out). */
function labelBox(n: SVGGElement): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  n.querySelectorAll<SVGGraphicsElement>(':scope > :not(.hit):not(.row-bg)').forEach((c) => {
    const b = c.getBBox();
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function wireHover(root: SVGSVGElement) {
  root.querySelectorAll<SVGGElement>('.node[data-id]').forEach((n) => {
    n.addEventListener('mouseenter', () => hover(n.dataset.id!.toUpperCase()));
    n.addEventListener('mouseleave', () => hover(null));
  });
}

render();
let rt = 0;
addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(render); });
