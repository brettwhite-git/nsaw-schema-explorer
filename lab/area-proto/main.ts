// Lab "area-proto": the subject-area flow (three variants), one inspector sidecar, and the navigation intention.
//   ?v=a  bipartite flow    ?v=b  mini bus matrix    ?v=c  hub map    ?v=nav  the four levels as one map
//   ?area=sales-order | inbound-shipment | order-to-cash-revenue-recognition (any subject-area slug)
//   ?sel=area | fact:DW_NS_SALES_ORDER_LINES_F | dim:DW_NS_SUBSIDIARY_D        ?hover=fact:… | dim:… (screenshots)
// Stated only. Facts of an area: the bus matrix (Oracle's lineage). Relations: Oracle's 26R4 data model diagrams
// (relatesTo), drawn as plain solid lines with no direction or cardinality. Reach: subject areas listing the table.

import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/source-sans-3/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '../../styles/tokens.generated.css';
import '../../styles/explorer/base.css';
import './style.css';
import { loadOntology } from '../../ontology/load';
import type { DetailJson } from '../../ontology/types';
import {
  areaSummary, buildColumns, buildCore, findTable, grainSentence, hasModel, ledgerRows, modelFactsOf, modelRelations,
  prettyTable, unslug, type AreaSummary, type ColumnModel, type CoreModel, type ModelRelation,
} from '../../explorer/data';

// ------------------------------------------------------------------ load
let colsJson: DetailJson | undefined;
const o = await loadOntology({
  baseUrl: '/ontology/',
  fetchJson: async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} -> ${r.status}`); const j = await r.json(); if (u.includes('columns')) colsJson = j; return j; },
});
await o.ensure('columns');
const m: CoreModel = buildCore(o.core);
const cm: ColumnModel = buildColumns(m, colsJson!);
const NSA = m.subjectAreas.length;

// ------------------------------------------------------------------ url state
type V = 'a' | 'b' | 'c' | 'nav';
const q = new URLSearchParams(location.search);
const v: V = (['a', 'b', 'c', 'nav'].includes(q.get('v') ?? '') ? q.get('v') : 'a') as V;
const sa = unslug(m, q.get('area') ?? 'sales-order') ?? unslug(m, 'sales-order')!;
let sel = q.get('sel') ?? 'area';
const AREAS = ['Sales Order', 'Inbound Shipment', 'Order to Cash - Revenue Recognition']
  .map((l) => m.subjectAreas.find((s) => s.label === l)!).filter(Boolean);

// ------------------------------------------------------------------ the area's flow model
interface FactN { i: number; t: number; name: string; grain: string | null; rels: ModelRelation[] }
interface DimN { i: number; t: number; name: string; display: string; reach: number; isFact: boolean; facts: number[] }
interface Flow { s: AreaSummary; facts: FactN[]; dims: DimN[]; others: number[]; shared: number }

function flowOf(saI: number): Flow {
  const s = areaSummary(m, cm, saI);
  const drawn = s.facts.filter((f) => hasModel(m, f.table));
  const facts: FactN[] = drawn.map((f, i) => ({ i, t: f.table, name: f.name, grain: f.grain, rels: modelRelations(m, f.table) }));
  const byT = new Map<number, DimN>();
  for (const f of facts) for (const r of f.rels) {
    const d = byT.get(r.table) ?? byT.set(r.table, { i: 0, t: r.table, name: r.name, display: r.display, reach: r.reach, isFact: r.isFact, facts: [] }).get(r.table)!;
    d.facts.push(f.i);
  }
  const sig = (d: DimN) => facts.map((f) => (d.facts.includes(f.i) ? '1' : '0')).join('');
  const dims = [...byT.values()].sort((a, b) => b.facts.length - a.facts.length || sig(b).localeCompare(sig(a)) || b.reach - a.reach || a.display.localeCompare(b.display));
  dims.forEach((d, i) => { d.i = i; });
  // facts ordered so the ones sharing the most tables sit together (most related first)
  return { s, facts, dims, others: s.facts.filter((f) => !hasModel(m, f.table)).map((f) => f.table), shared: dims.filter((d) => d.facts.length >= 2).length };
}
const F = flowOf(sa);

// ------------------------------------------------------------------ helpers
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const ctx = document.createElement('canvas').getContext('2d')!;
const FONT = { ui13: '400 13px "Source Sans 3 Variable"', mono12: '400 12px "JetBrains Mono Variable"', mono11: '400 11px "JetBrains Mono Variable"', it12: 'italic 400 12.5px "Source Serif 4 Variable"', ui12: '400 12px "Source Sans 3 Variable"' };
const measure = (s: string, f: string) => { ctx.font = f; return ctx.measureText(s).width; };
function fit(s: string, f: string, w: number) {
  if (measure(s, f) <= w) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(s.slice(0, mid) + '…', f) <= w) lo = mid; else hi = mid - 1; }
  return s.slice(0, lo) + '…';
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number) => words[n] ?? String(n);
const short = (n: string) => n.replace(/^DW_NS_/, '');
const tablePath = (n: string, qs = '') => `/table/${encodeURIComponent(n)}${qs}`;

// ------------------------------------------------------------------ shell: header, level bar, controls
const app = document.getElementById('app')!;
const fa = F.s.fa >= 0 ? m.functionalAreas[F.s.fa] : null;
const sibs = fa ? fa.subjectAreas : [];
const at = sibs.indexOf(sa);
const prevSa = at > 0 ? sibs[at - 1] : null, nextSa = at >= 0 && at < sibs.length - 1 ? sibs[at + 1] : null;
const link = (p: Record<string, string | null>) => {
  const u = new URLSearchParams(location.search);
  for (const [k, val] of Object.entries(p)) if (val === null) u.delete(k); else u.set(k, val);
  u.delete('hover');
  return `?${u}`;
};
const selFact = () => (sel.startsWith('fact:') ? findTable(m, sel.slice(5)) : undefined);

function levelBar(): string {
  const ft = selFact();
  const steps = [
    { lvl: 'Matrix', val: 'All subject areas', href: '/', state: 'past' },
    { lvl: 'Subject area', val: F.s.label, pre: F.s.faName, href: `/area/${F.s.slug}`, state: 'here' },
    { lvl: 'Table', val: ft !== undefined ? m.tables[ft].name : 'pick a fact', href: ft !== undefined ? tablePath(m.tables[ft].name) : '', state: ft !== undefined ? 'next' : 'later', mono: ft !== undefined },
    { lvl: 'Field', val: 'pick a column', href: '', state: 'later' },
  ];
  return `<nav class="lv" aria-label="Where you are">
    <ol>${steps.map((st, i) => `<li class="lv-s ${st.state}" ${st.state === 'here' ? 'aria-current="location"' : ''}>
      <span class="lv-n">${i + 1}</span>
      <span class="lv-b"><span class="lv-l">${st.lvl}${st.pre ? ` <span class="lv-pre">· ${esc(st.pre)}</span>` : ''}</span>
      ${st.href ? `<a href="${st.href}" class="lv-v${st.mono ? ' mono' : ''}">${esc(st.val)}</a>` : `<span class="lv-v hint">${esc(st.val)}</span>`}</span>
    </li>`).join('<li class="lv-sep" aria-hidden="true"></li>')}</ol>
    <div class="lv-ctx">${prevSa !== null ? `<a href="${link({ area: m.subjectAreas[prevSa].slug, sel: null })}">‹ ${esc(m.subjectAreas[prevSa].label)}</a>` : ''}
      ${nextSa !== null ? `<a href="${link({ area: m.subjectAreas[nextSa].slug, sel: null })}">${esc(m.subjectAreas[nextSa].label)} ›</a>` : ''}</div>
  </nav>`;
}

const VARIANTS: [V, string][] = [['a', 'Bipartite flow'], ['b', 'Mini bus matrix'], ['c', 'Hub map'], ['nav', 'Navigation map']];
app.innerHTML = `
<header class="top">
  <a class="brand" href="/"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.5" fill="var(--accent)"/><path d="M8 8 2 3M8 8l6-5M8 8l-6 5M8 8l6 5" stroke="var(--ink)" stroke-width="1.1"/></svg><b>NetSuite Data Intelligence Schema Explorer</b></a>
  <span class="faint mono lab">lab · subject-area flow</span>
  <nav class="tabs" aria-label="Variant">${VARIANTS.map(([id, n]) => `<a href="${link({ v: id })}" ${id === v ? 'aria-current="page"' : ''}>${id === 'nav' ? '' : `<span class="mono">${id.toUpperCase()}</span> `}${n}</a>`).join('')}</nav>
  ${v === 'nav' ? '' : `<nav class="tabs ex" aria-label="Subject area">${AREAS.map((a) => `<a href="${link({ area: a.slug, sel: null })}" ${a.i === sa ? 'aria-current="page"' : ''}>${esc(a.label.replace('Order to Cash - ', ''))}</a>`).join('')}</nav>`}
</header>
${v === 'nav' ? '' : levelBar()}
<div class="wrap ${v === 'nav' ? 'nav' : ''}">
  <main class="ap-main" id="main"></main>
  ${v === 'nav' ? '' : '<aside class="sc" id="sc" aria-label="Inspector"></aside>'}
</div>`;

const main = document.getElementById('main')!;

// ------------------------------------------------------------------ the area page: lead + figure
function lead(): string {
  const n = F.s.facts.length, d = F.facts.length, sh = F.shared;
  const drawn = d === n ? `Oracle’s 26R4 data model draws all ${word(d)}` : `Oracle’s 26R4 data model draws ${word(d)} of them`;
  return `${F.s.label} lists ${plural(n, 'fact table')}. ${drawn} and relates them to ${plural(F.dims.length, 'table')}` +
    (sh ? `; ${sh} ${sh === 1 ? 'is' : 'are'} shared by two or more of those facts.` : '.');
}

function renderArea() {
  const nShared = F.shared;
  main.innerHTML = `
  <section class="ah">
    <div class="eyebrow"><i>subject area</i> <span class="faint">${esc(F.s.faName)}</span></div>
    <h1>${esc(F.s.label)}</h1>
    <p class="lede">${esc(lead())}</p>
  </section>
  <section class="fl">
    <div class="fl-h">
      <h2>${v === 'a' ? 'Facts and the tables they relate to' : v === 'b' ? 'Facts by related table' : 'Shared tables at the centre'}</h2>
      <div class="legend" aria-hidden="true">
        <span><i class="lg-line"></i>related in Oracle’s 26R4 data model</span>
        ${v === 'b' ? '<span><i class="lg-dot"></i>the fact’s diagram draws this table</span>' : ''}
        ${v === 'c' ? '<span><i class="lg-hub"></i>shared table, sized by its facts</span><span><i class="lg-sat"></i>a table one fact relates to</span>' : ''}
        ${v === 'a' ? `<span><b class="acc">${nShared}</b>&nbsp;shared by two or more facts</span>` : ''}
      </div>
    </div>
    <figure class="fig"><div class="canvas" id="canvas"></div><div class="tip" id="tip" hidden></div></figure>
    ${F.others.length ? `<p class="also"><i>Also listed in this area</i> ${F.others.map((t) => `<a class="mono" href="${tablePath(m.tables[t].name)}">${esc(m.tables[t].name)}</a>`).join('<span class="faint"> · </span>')}</p>` : ''}
  </section>`;
}

// ------------------------------------------------------------------ figure helpers
const svgOpen = (W: number, H: number, label: string) => `<svg class="fsvg" width="${W}" height="${Math.ceil(H)}" viewBox="0 0 ${W} ${Math.ceil(H)}" role="group" aria-label="${esc(label)}">`;
const factLabel = (f: FactN) => `${f.name}${f.grain ? `, ${f.grain}` : ''}, relates to ${plural(f.rels.length, 'table')}`;
const dimLabel = (d: DimN) => `${d.display}, related to ${d.facts.length} of ${F.facts.length} facts in this area`;

// A. bipartite flow ---------------------------------------------------
function drawA(W: number): string {
  const nF = F.facts.length;
  const shared = F.dims.filter((d) => d.facts.length >= 2), single = F.dims.filter((d) => d.facts.length < 2);
  const rowH = 24, gh = 40;
  const cardW = Math.min(330, W * 0.34), cardH = 54;
  const dimX = Math.max(cardW + 240, W - 330);
  const ys = new Map<number, number>();
  let y = 30;
  const heads: string[] = [];
  const group = (title: string, ds: DimN[]) => {
    if (!ds.length) return;
    heads.push(`<text x="${dimX - 6}" y="${y + 4}" class="t-gh">${esc(title)}</text><text x="${W}" y="${y + 4}" class="t-s" text-anchor="end">${ds.length}</text><line x1="${dimX - 6}" x2="${W}" y1="${y + 12}" y2="${y + 12}" class="rule-ink"/>`);
    y += gh - 6;
    for (const d of ds) { ys.set(d.i, y); y += rowH; }
    y += 26;
  };
  group('Shared by two or more facts', shared);
  group('Related to one fact', single);
  const H = Math.max(y, nF * (cardH + 22) + 60);
  // facts: spread over the shared block first (that is where most lines land)
  const span = Math.max(nF * (cardH + 22), Math.min(H - 60, (shared.length ? (ys.get(shared[shared.length - 1].i)! - 30) : H) + 120));
  const fTop = 30 + Math.max(0, (Math.min(H, span + 60) - span) / 2);
  const fy = (i: number) => fTop + (nF === 1 ? span / 2 - cardH / 2 : (i * (span - cardH)) / Math.max(1, nF - 1));
  let s = svgOpen(W, H, `${F.s.label}: ${nF} facts and the tables Oracle's data model relates them to`);
  s += `<g class="lines" aria-hidden="true">`;
  for (const f of F.facts) {
    const x1 = cardW, y1 = fy(f.i) + cardH / 2;
    for (const r of f.rels) {
      const d = F.dims.find((x) => x.t === r.table)!;
      const x2 = dimX - 8, y2 = ys.get(d.i)!;
      const mx = (x1 + x2) / 2;
      s += `<path class="ln${d.facts.length >= 2 ? ' sh' : ''}" data-f="${f.i}" data-d="${d.i}" d="M${r1(x1)} ${r1(y1)} C${r1(mx)} ${r1(y1)} ${r1(mx)} ${r1(y2)} ${r1(x2)} ${r1(y2)}"/>`;
    }
  }
  s += `</g>${heads.join('')}`;
  for (const f of F.facts) {
    const y0 = fy(f.i);
    s += `<g class="nd fact" data-f="${f.i}" data-sel="fact:${f.name}" tabindex="0" role="button" aria-label="${esc(factLabel(f))}">
      <rect x="0" y="${r1(y0)}" width="${r1(cardW)}" height="${cardH}" class="card"/>
      <text x="14" y="${r1(y0 + 21)}" class="t-mono">${esc(fit(f.name, FONT.mono12, cardW - 70))}</text>
      <text x="${r1(cardW - 12)}" y="${r1(y0 + 21)}" class="t-s" text-anchor="end">${f.rels.length}</text>
      <text x="14" y="${r1(y0 + 40)}" class="t-it">${esc(fit(f.grain ?? prettyTable(m, f.name), FONT.it12, cardW - 28))}</text>
      <circle cx="${r1(cardW)}" cy="${r1(y0 + cardH / 2)}" r="2.4" class="port"/></g>`;
  }
  for (const d of F.dims) {
    const y0 = ys.get(d.i)!;
    const shd = d.facts.length >= 2;
    s += `<g class="nd dim" data-d="${d.i}" data-sel="dim:${d.name}" tabindex="0" role="button" aria-label="${esc(dimLabel(d))}">
      <rect x="${dimX - 12}" y="${y0 - 12}" width="${W - dimX + 12}" height="${rowH}" class="hit"/>
      <circle cx="${dimX - 6}" cy="${y0}" r="2.4" class="dot"/>
      <text x="${dimX + 4}" y="${y0 + 4.5}" class="t-ui${d.isFact ? ' mono-ish' : ''}">${esc(fit(d.display, FONT.ui13, W - dimX - 110))}${d.isFact ? ' <tspan class="t-it">fact</tspan>' : ''}</text>
      ${shd ? `<text x="${W}" y="${y0 + 4}" class="t-acc" text-anchor="end">${d.facts.length} of ${nF} facts</text>` : `<text x="${W}" y="${y0 + 4}" class="t-s" text-anchor="end">1</text>`}
    </g>`;
  }
  return s + '</svg>';
}

// B. mini bus matrix ---------------------------------------------------
function drawB(W: number): { svg: string; W: number } {
  const nF = F.facts.length, nD = F.dims.length;
  const rowHW = 300, rowH = 40;
  const colW = Math.max(19, Math.min(24, (W - rowHW - 20) / nD));
  const GW = rowHW + nD * colW + 20;
  const headH = 150;
  const H = headH + nF * rowH + 40;
  let s = svgOpen(GW, H, `${F.s.label}: facts by the tables Oracle's data model relates them to`);
  // column bands: shared columns tinted
  const nShared = F.shared;
  if (nShared) s += `<rect x="${rowHW}" y="${headH - 4}" width="${r1(nShared * colW)}" height="${nF * rowH + 8}" class="band"/>`;
  for (let r = 0; r <= nF; r++) s += `<line x1="0" x2="${r1(rowHW + nD * colW)}" y1="${headH + r * rowH}" y2="${headH + r * rowH}" class="${r === 0 ? 'rule-ink' : 'rule'}"/>`;
  // column heads (slanted, lean up and right)
  for (const d of F.dims) {
    const x = rowHW + d.i * colW + colW / 2;
    s += `<g class="nd col" data-d="${d.i}" data-sel="dim:${d.name}" tabindex="0" role="button" aria-label="${esc(dimLabel(d))}">
      <rect x="${r1(x - colW / 2)}" y="${headH - 4}" width="${r1(colW)}" height="${nF * rowH + 30}" class="hit colhit"/>
      <text transform="translate(${r1(x + 3)} ${headH - 8}) rotate(-60)" class="t-ch">${esc(fit(d.display, FONT.ui12, 160))}</text>
      <text x="${r1(x)}" y="${headH + nF * rowH + 20}" class="${d.facts.length >= 2 ? 't-acc' : 't-s'}" text-anchor="middle">${d.facts.length}</text></g>`;
  }
  for (const f of F.facts) {
    const y = headH + f.i * rowH;
    s += `<g class="nd row" data-f="${f.i}" data-sel="fact:${f.name}" tabindex="0" role="button" aria-label="${esc(factLabel(f))}">
      <rect x="0" y="${y}" width="${r1(rowHW + nD * colW)}" height="${rowH}" class="hit rowhit"/>
      <text x="4" y="${y + 17}" class="t-mono">${esc(fit(f.name, FONT.mono12, rowHW - 50))}</text>
      <text x="${rowHW - 14}" y="${y + 17}" class="t-s" text-anchor="end">${f.rels.length}</text>
      <text x="4" y="${y + 33}" class="t-it">${esc(fit(f.grain ?? '', FONT.it12, rowHW - 24))}</text></g>`;
    for (const r of f.rels) {
      const d = F.dims.find((x) => x.t === r.table)!;
      s += `<circle class="cell" data-f="${f.i}" data-d="${d.i}" cx="${r1(rowHW + d.i * colW + colW / 2)}" cy="${y + rowH / 2}" r="${Math.min(4.2, colW / 4)}" aria-hidden="true"/>`;
    }
  }
  s += `<text x="${rowHW - 14}" y="${headH - 10}" class="t-s" text-anchor="end">tables</text>`;
  s += `<text x="4" y="${headH + nF * rowH + 20}" class="t-it">facts relating to each</text>`;
  return { svg: s + '</svg>', W: GW };
}

// C. hub map ---------------------------------------------------
function drawC(W: number): string {
  const nF = F.facts.length;
  const hubs = F.dims.filter((d) => d.facts.length >= 2);
  const cellW = 118, cellH = 66, cardH = 44;
  const cols = Math.max(4, Math.min(6, Math.floor((W - 2 * (230 + 116)) / cellW)));
  const cardW = Math.min(230, Math.floor((W - cols * cellW) / 2 - 92));
  const satR = 56; // room for satellites outside each card
  const rows = Math.max(1, Math.ceil(hubs.length / cols));
  const fieldW = cols * cellW, fieldH = rows * cellH;
  const nL = Math.ceil(nF / 2);
  const factStep = 92;
  const H = Math.max(fieldH + 120, Math.max(nL, nF - nL) * factStep + 80);
  const cx = W / 2, cy = H / 2;
  // hubs: grid cells ordered by distance from the centre, largest hub nearest the centre
  const cells: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([cx - fieldW / 2 + (c + 0.5) * cellW, cy - fieldH / 2 + (r + 0.5) * cellH - 8]);
  cells.sort((a, b) => Math.hypot(a[0] - cx, (a[1] - cy) * 1.6) - Math.hypot(b[0] - cx, (b[1] - cy) * 1.6));
  const hp = new Map<number, [number, number]>();
  hubs.forEach((d, k) => hp.set(d.i, cells[k]));
  const hr = (d: DimN) => 4 + 13 * Math.sqrt(d.facts.length / nF);
  // facts: left and right columns, satellites fanning outward
  const fpos = new Map<number, { x: number; y: number; side: number }>();
  const placeCol = (list: FactN[], side: -1 | 1) => list.forEach((f, k) => {
    const y = cy - ((list.length - 1) * factStep) / 2 + k * factStep;
    fpos.set(f.i, { x: side < 0 ? satR : W - satR - cardW, y: y - cardH / 2, side });
  });
  placeCol(F.facts.slice(0, nL), -1); placeCol(F.facts.slice(nL), 1);
  let s = svgOpen(W, H, `${F.s.label}: shared tables at the centre, each fact around them`);
  s += '<g class="lines" aria-hidden="true">';
  for (const f of F.facts) {
    const p = fpos.get(f.i)!;
    const px = p.side < 0 ? p.x + cardW : p.x, py = p.y + cardH / 2;
    for (const r of f.rels) {
      const d = F.dims.find((x) => x.t === r.table)!;
      if (d.facts.length >= 2) { const [hx, hy] = hp.get(d.i)!; s += `<line class="ln sh" data-f="${f.i}" data-d="${d.i}" x1="${r1(px)}" y1="${r1(py)}" x2="${r1(hx)}" y2="${r1(hy)}"/>`; }
    }
    // satellites: tables only this fact relates to
    const own = f.rels.map((r) => F.dims.find((x) => x.t === r.table)!).filter((d) => d.facts.length < 2);
    const ox = p.side < 0 ? p.x : p.x + cardW;
    own.forEach((d, k) => {
      const a = (own.length === 1 ? 0 : (k / (own.length - 1) - 0.5)) * Math.min(Math.PI * 0.9, own.length * 0.2);
      const rr = 34 + (k % 2) * 16;
      const sx = ox + p.side * -1 * 0 + (p.side < 0 ? -1 : 1) * rr * Math.cos(a), sy = py + rr * Math.sin(a) * 1.4;
      s += `<line class="ln own" data-f="${f.i}" data-d="${d.i}" x1="${r1(ox)}" y1="${r1(py)}" x2="${r1(sx)}" y2="${r1(sy)}"/>`;
      s += `<circle class="sat nd" data-f="${f.i}" data-d="${d.i}" data-sel="dim:${d.name}" cx="${r1(sx)}" cy="${r1(sy)}" r="3"><title>${esc(d.display)}</title></circle>`;
    });
  }
  s += '</g>';
  for (const d of hubs) {
    const [x, y] = hp.get(d.i)!;
    const r = hr(d);
    s += `<g class="nd hub" data-d="${d.i}" data-sel="dim:${d.name}" tabindex="0" role="button" aria-label="${esc(dimLabel(d))}">
      <circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" class="hubc"/>
      <text x="${r1(x)}" y="${r1(y + r + 14)}" class="t-hub" text-anchor="middle">${esc(fit(d.display, FONT.ui12, cellW - 8))}</text>
      <text x="${r1(x)}" y="${r1(y + 3.5)}" class="t-hubn" text-anchor="middle">${d.facts.length}</text></g>`;
  }
  for (const f of F.facts) {
    const p = fpos.get(f.i)!;
    const own = f.rels.filter((r) => F.dims.find((x) => x.t === r.table)!.facts.length < 2).length;
    s += `<g class="nd fact" data-f="${f.i}" data-sel="fact:${f.name}" tabindex="0" role="button" aria-label="${esc(factLabel(f))}">
      <rect x="${r1(p.x)}" y="${r1(p.y)}" width="${cardW}" height="${cardH}" class="card"/>
      <text x="${r1(p.x + 10)}" y="${r1(p.y + 18)}" class="t-mono sm">${esc(fit(short(f.name), FONT.mono11, cardW - 20))}</text>
      <text x="${r1(p.x + 12)}" y="${r1(p.y + 35)}" class="t-s">${f.rels.length - own} shared · ${own} own</text></g>`;
  }
  return s + '</svg>';
}

// ------------------------------------------------------------------ hover + selection wiring
const tip = () => document.getElementById('tip')!;
function setHover(kind: 'f' | 'd' | null, i = -1, anchor?: Element) {
  const svg = document.querySelector<SVGSVGElement>('.fsvg');
  if (!svg) return;
  svg.classList.toggle('hov', kind !== null);
  svg.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
  const t = tip();
  if (kind === null) { t.hidden = true; return; }
  const lit = new Set<string>();
  svg.querySelectorAll<SVGElement>(`[data-${kind}="${i}"]`).forEach((n) => {
    n.classList.add('on');
    if (n.dataset.f !== undefined) lit.add(`f${n.dataset.f}`);
    if (n.dataset.d !== undefined) lit.add(`d${n.dataset.d}`);
  });
  svg.querySelectorAll<SVGElement>('.nd').forEach((n) => {
    if ((n.dataset.f !== undefined && lit.has(`f${n.dataset.f}`) && !n.dataset.d) || (n.dataset.d !== undefined && lit.has(`d${n.dataset.d}`) && !n.dataset.f)) n.classList.add('on');
  });
  // label
  let html = '';
  if (kind === 'f') { const f = F.facts[i]; html = `<b class="mono">${esc(f.name)}</b><span class="sep">·</span>relates to ${plural(f.rels.length, 'table')}, ${f.rels.filter((r) => F.dims.find((d) => d.t === r.table)!.facts.length >= 2).length} shared<span class="sep">·</span><i>stated in Oracle’s 26R4 data model</i>`; }
  else { const d = F.dims[i]; html = `<b>${esc(d.display)}</b><span class="sep">·</span>related to ${d.facts.length} of ${F.facts.length} facts here<span class="sep">·</span>in ${d.reach} of ${NSA} subject areas<span class="sep">·</span><i>stated in Oracle’s 26R4 data model</i>`; }
  t.innerHTML = html; t.hidden = false;
  if (anchor) {
    const fig = t.parentElement!.getBoundingClientRect(), b = anchor.getBoundingClientRect();
    const cls = anchor.getAttribute('class') ?? '';
    let x = b.left - fig.left + b.width / 2 - t.offsetWidth / 2;
    let y = b.top - fig.top - t.offsetHeight - 8;
    // beside the node, over the faded lines, where a column of labels would otherwise be covered
    if (v === 'a' && cls.includes('dim')) { x = b.left - fig.left - t.offsetWidth - 14; y = b.top - fig.top + b.height / 2 - t.offsetHeight / 2; }
    else if ((v === 'a' || v === 'c') && cls.includes('fact')) { const right = b.left - fig.left < fig.width / 2; x = right ? b.right - fig.left + 14 : b.left - fig.left - t.offsetWidth - 14; y = b.top - fig.top + b.height / 2 - t.offsetHeight / 2; }
    x = Math.max(0, Math.min(x, fig.width - t.offsetWidth));
    if (y < 0) y = b.bottom - fig.top + 8;
    t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
function markSel() {
  document.querySelectorAll('.fsvg .sel').forEach((n) => n.classList.remove('sel'));
  document.querySelectorAll(`.fsvg [data-sel="${CSS.escape(sel)}"]`).forEach((n) => n.classList.add('sel'));
}
function wire() {
  document.querySelectorAll<SVGElement>('.fsvg .nd').forEach((n) => {
    const kind = n.dataset.f !== undefined && n.dataset.d === undefined ? 'f' : 'd';
    const i = Number(kind === 'f' ? n.dataset.f : n.dataset.d);
    n.addEventListener('mouseenter', () => setHover(kind, i, n));
    n.addEventListener('mouseleave', () => setHover(null));
    n.addEventListener('focus', () => setHover(kind, i, n));
    n.addEventListener('blur', () => setHover(null));
    const pick = () => { sel = n.dataset.sel!; history.replaceState(null, '', link({ sel })); markSel(); renderSidecar(); renderLevel(); };
    n.addEventListener('click', pick);
    n.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); pick(); } });
  });
}
function renderLevel() { const lv = document.querySelector('.lv'); if (lv) lv.outerHTML = levelBar(); }

function drawFigure() {
  const canvas = document.getElementById('canvas')!;
  const W = Math.min(canvas.clientWidth, 1320);
  if (W < 600) { canvas.innerHTML = ''; return; }
  if (v === 'a') canvas.innerHTML = drawA(W);
  else if (v === 'b') canvas.innerHTML = drawB(W).svg;
  else canvas.innerHTML = drawC(W);
  wire(); markSel();
  const h = q.get('hover');
  if (h) {
    const n = document.querySelector<SVGElement>(`.fsvg .nd[data-sel="${CSS.escape(h)}"]`);
    if (n) { const kind = n.dataset.f !== undefined && n.dataset.d === undefined ? 'f' : 'd'; setHover(kind, Number(kind === 'f' ? n.dataset.f : n.dataset.d), n); }
  }
}

// ------------------------------------------------------------------ the sidecar (one inspector for every page)
let collapsed = false;
function miniStar(rels: ModelRelation[], sharedSet: Set<number>): string {
  const n = rels.length, R = 34, cx = 60, cy = 42;
  let s = `<svg class="mini" width="120" height="84" viewBox="0 0 120 84" aria-hidden="true">`;
  rels.forEach((r, k) => {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + R * 1.35 * Math.cos(a), y = cy + R * Math.sin(a);
    const sh = sharedSet.has(r.table);
    s += `<line x1="${cx}" y1="${cy}" x2="${r1(x)}" y2="${r1(y)}" class="${sh ? 'mi-sh' : 'mi'}"/><circle cx="${r1(x)}" cy="${r1(y)}" r="${sh ? 2.4 : 1.6}" class="${sh ? 'mi-dsh' : 'mi-d'}"/>`;
  });
  return s + `<rect x="${cx - 9}" y="${cy - 6}" width="18" height="12" class="mi-c"/></svg>`;
}
const fig = (n: number | string, t: string) => `<div class="sc-f"><b>${n}</b><span>${t}</span></div>`;
function go(items: [string, string, string][]) {
  return `<div class="sc-go"><div class="sc-k">Go next</div><ul>${items.map(([href, t, sub]) => `<li><a href="${href}"><span>${t}</span><small>${sub}</small><i aria-hidden="true">→</i></a></li>`).join('')}</ul></div>`;
}
function renderSidecar() {
  const sc = document.getElementById('sc');
  if (!sc) return;
  sc.classList.toggle('collapsed', collapsed);
  const head = (kind: string, name: string, mono: string | null) => `
    <div class="sc-top"><span class="sc-kind">${kind}</span>
      <button type="button" class="sc-x" aria-expanded="${!collapsed}" aria-controls="sc-body" title="${collapsed ? 'Open the inspector' : 'Fold the inspector'}">${collapsed ? '‹' : '›'}</button></div>
    <h2 class="sc-name">${esc(name)}</h2>${mono ? `<div class="sc-mono mono">${esc(mono)}</div>` : ''}`;
  let body = '';
  let title = '';
  if (sel.startsWith('fact:')) {
    const t = findTable(m, sel.slice(5))!;
    const name = m.tables[t].name;
    const rels = modelRelations(m, t);
    const shared = new Set(F.dims.filter((d) => d.facts.length >= 2).map((d) => d.t));
    const sh = rels.filter((r) => shared.has(r.table)).length;
    const g = grainSentence(m, t);
    const lr = ledgerRows(m, cm, t);
    const keyRow = lr.rows.find((r) => r.isKey && r.sources.length) ?? lr.rows.find((r) => r.sources.length);
    const src = keyRow?.sources[0];
    title = prettyTable(m, name);
    body = head('fact table', title, name) + `
      ${g ? `<p class="sc-grain">${esc(g)}</p>` : ''}
      <div class="sc-figs">${fig(rels.length, 'tables its diagram relates it to')}${fig(sh, `shared with other facts in ${esc(F.s.label)}`)}${fig(cm.tableCols[t].length, 'columns')}${fig(cm.tableSas[t].length, 'subject areas read it')}</div>
      <div class="sc-vis">${miniStar(rels, shared)}<p>Its star, with the tables it shares in this area drawn darker.</p></div>
      ${go([
        [tablePath(name), 'Open the table star', 'the data model, the column ledger'],
        ...(keyRow ? [[tablePath(name, `?col=${encodeURIComponent(keyRow.name)}`), `Follow ${keyRow.name}`, 'one column from NetSuite to the reports'] as [string, string, string]] : []),
        ...(src ? [[`/field/${encodeURIComponent(src.record)}/${encodeURIComponent(src.key.split('.').slice(1).join('.'))}`, 'Trace a field', src.label] as [string, string, string]] : []),
      ])}`;
  } else if (sel.startsWith('dim:')) {
    const t = findTable(m, sel.slice(4))!;
    const name = m.tables[t].name;
    const d = F.dims.find((x) => x.t === t);
    const reach = m.tables[t].saCount;
    const facts = modelFactsOf(m, t).length;
    title = prettyTable(m, name);
    body = head(m.tables[t].role === 'fact' ? 'fact table' : 'dimension', title, name) + `
      <div class="sc-figs">${d ? fig(`${d.facts.length}<small> of ${F.facts.length}</small>`, `facts in ${esc(F.s.label)} relate to it`) : ''}${fig(reach, `of ${NSA} subject areas list it`)}${fig(facts, 'facts relate to it across Oracle’s data model')}</div>
      <div class="sc-vis bar"><span class="sc-bar"><i style="width:${((reach / NSA) * 100).toFixed(1)}%"></i></span><p>Listed in ${reach} of ${NSA} subject areas.</p>
      ${d ? `<ul class="sc-fl">${d.facts.map((fi) => `<li class="mono">${esc(short(F.facts[fi].name))}</li>`).join('')}</ul>` : ''}</div>
      ${go([
        [`/?dim=${encodeURIComponent(name)}`, 'Open in the bus matrix', 'its column across every subject area'],
        [tablePath(name), 'Open the table', 'facts that relate to it, its columns'],
      ])}`;
  } else {
    const other = sibs.find((x) => x !== sa);
    title = F.s.label;
    body = head('subject area', F.s.label, null) + `
      <p class="sc-grain">${esc(F.s.faName)}</p>
      <div class="sc-figs">${fig(F.s.facts.length, 'fact tables listed')}${fig(F.facts.length, 'drawn in the data model')}${fig(F.dims.length, 'tables they relate to')}${fig(F.shared, 'shared by two or more facts')}</div>
      <div class="sc-vis"><div class="sc-dots">${F.s.facts.map((f) => `<i class="${hasModel(m, f.table) ? 'on' : ''}" title="${esc(f.name)}"></i>`).join('')}</div><p>One mark per fact table; the filled ones are drawn in Oracle’s data model.</p></div>
      ${go([
        [`/area/${F.s.slug}`, 'Open the area page', 'report folders, dimensions, grain'],
        ['/', 'Back to the bus matrix', 'all subject areas'],
        ...(other !== undefined ? [[`/compare/${F.s.slug}/${m.subjectAreas[other].slug}`, `Compare with ${m.subjectAreas[other].label}`, `a neighbour in ${F.s.faName}`] as [string, string, string]] : []),
      ])}`;
  }
  sc.innerHTML = collapsed
    ? `<button type="button" class="sc-rail" aria-expanded="false" aria-controls="sc-body"><span>Inspector</span><b>${esc(title)}</b></button>`
    : `<div class="sc-in" id="sc-body">${body}<p class="sc-foot">Esc folds the inspector · click any table to inspect it</p></div>`;
  sc.querySelector<HTMLButtonElement>('.sc-x, .sc-rail')?.addEventListener('click', () => { collapsed = !collapsed; renderSidecar(); requestAnimationFrame(drawFigure); });
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !collapsed && document.getElementById('sc')) { collapsed = true; renderSidecar(); requestAnimationFrame(drawFigure); } });

// ------------------------------------------------------------------ the navigation map (?v=nav)
function wire1(): string { // matrix
  let s = '<svg viewBox="0 0 240 150" class="wf" aria-hidden="true"><rect x="0.5" y="0.5" width="239" height="149" class="wf-frame"/>';
  for (let c = 0; c < 12; c++) s += `<line x1="${62 + c * 14}" y1="34" x2="${70 + c * 14}" y2="18" class="wf-t"/>`;
  for (let r = 0; r < 8; r++) {
    s += `<line x1="10" x2="${44 + (r % 3) * 4}" y1="${46 + r * 12}" y2="${46 + r * 12}" class="wf-t"/>`;
    for (let c = 0; c < 12; c++) if ((r * 7 + c * 3) % 5 < 3) s += `<circle cx="${66 + c * 14}" cy="${46 + r * 12}" r="2.2" class="${r === 3 ? 'wf-acc' : 'wf-dot'}"/>`;
  }
  return s + '<rect x="6" y="40" width="228" height="12" class="wf-hi"/></svg>';
}
function wire2(): string { // area flow
  let s = '<svg viewBox="0 0 240 150" class="wf" aria-hidden="true"><rect x="0.5" y="0.5" width="239" height="149" class="wf-frame"/>';
  const fy = [30, 62, 94, 126], dy = [22, 36, 50, 64, 78, 92, 106, 120, 134];
  fy.forEach((y, i) => { s += `<rect x="12" y="${y - 9}" width="58" height="18" class="${i === 1 ? 'wf-card acc' : 'wf-card'}"/>`; });
  fy.forEach((y, i) => dy.forEach((d, k) => { if ((i + k) % 3 !== 0 || k < 3) s += `<path d="M70 ${y} C120 ${y} 120 ${d} 166 ${d}" class="${i === 1 ? 'wf-lacc' : 'wf-l'}"/>`; }));
  dy.forEach((d, k) => { s += `<circle cx="168" cy="${d}" r="2" class="wf-dot"/><line x1="174" x2="${200 + (k % 3) * 8}" y1="${d}" y2="${d}" class="wf-t"/>`; });
  return s + '</svg>';
}
function wire3(): string { // table star + ledger
  let s = '<svg viewBox="0 0 240 150" class="wf" aria-hidden="true"><rect x="0.5" y="0.5" width="239" height="149" class="wf-frame"/>';
  const cx = 120, cy = 50;
  for (let k = 0; k < 7; k++) { const y = 18 + k * 10; s += `<line x1="${cx - 26}" y1="${cy}" x2="40" y2="${y}" class="wf-l"/><line x1="${cx + 26}" y1="${cy}" x2="200" y2="${y}" class="wf-l"/><circle cx="40" cy="${y}" r="1.8" class="wf-dot"/><circle cx="200" cy="${y}" r="1.8" class="wf-dot"/>`; }
  s += `<rect x="${cx - 26}" y="${cy - 13}" width="52" height="26" class="wf-card main"/>`;
  for (let r = 0; r < 4; r++) s += `<line x1="16" x2="74" y1="${104 + r * 11}" y2="${104 + r * 11}" class="wf-t"/><line x1="94" x2="146" y1="${104 + r * 11}" y2="${104 + r * 11}" class="${r === 1 ? 'wf-lacc' : 'wf-t'}"/><line x1="166" x2="224" y1="${104 + r * 11}" y2="${104 + r * 11}" class="wf-t"/>`;
  return s + '</svg>';
}
function wire4(): string { // field trace
  let s = '<svg viewBox="0 0 240 150" class="wf" aria-hidden="true"><rect x="0.5" y="0.5" width="239" height="149" class="wf-frame"/>';
  s += '<rect x="14" y="62" width="50" height="22" class="wf-card acc"/>';
  [36, 74, 112].forEach((y) => { s += `<path d="M64 73 C90 73 90 ${y} 112 ${y}" class="wf-lacc"/><rect x="112" y="${y - 9}" width="44" height="18" class="wf-card"/>`; [-8, 0, 8].forEach((o) => { s += `<path d="M156 ${y} C176 ${y} 176 ${y + o * 1.5} 196 ${y + o * 1.5}" class="wf-l"/><circle cx="200" cy="${y + o * 1.5}" r="1.8" class="wf-dot"/>`; }); });
  return s + '</svg>';
}
function renderNav() {
  const levels = [
    { n: 1, name: 'Matrix', q: 'Which subject areas share which tables?', wf: wire1(), sc: 'Hover a row or a column: the inspector shows that subject area or dimension, with its reach.', path: '/' },
    { n: 2, name: 'Subject area flow', q: 'Which facts does this area read, and which tables do they share?', wf: wire2(), sc: 'Click a fact or a table: its key figures, a mini star or reach bar, and where to go next.', path: '?v=a' },
    { n: 3, name: 'Table star and ledger', q: 'What is one row, what does the table relate to, which column feeds which report?', wf: wire3(), sc: 'Pick a column: the inspector follows it from its NetSuite field to the report columns.', path: '/table/DW_NS_SALES_ORDER_LINES_F' },
    { n: 4, name: 'Field trace', q: 'Where does one NetSuite field end up across every subject area?', wf: wire4(), sc: 'The inspector lists the subject areas and report columns the field reaches.', path: '/field/transactions/tranid' },
  ];
  const acts = ['click a subject area', 'pick a fact', 'pick a column', ''];
  main.innerHTML = `
  <section class="ah nav-h">
    <div class="eyebrow"><i>intention</i></div>
    <h1>Four levels, one direction</h1>
    <p class="lede">A reader starts wide and narrows: all subject areas, one subject area, one table, one field. Each level answers one question, the level bar shows where you are, and the same inspector sits on the right of every level.</p>
  </section>
  <div class="nv-bar" aria-hidden="true">${levels.map((l, i) => `<span class="${i === 1 ? 'here' : ''}"><b>${l.n}</b>${l.name}</span>`).join('<i>›</i>')}</div>
  <ol class="nv">
    ${levels.map((l, i) => `<li class="nv-l">
      <div class="nv-k"><span class="nv-n">${l.n}</span><h2>${l.name}</h2></div>
      <a class="nv-wf" href="${l.path}">${l.wf}</a>
      <p class="nv-q">${l.q}</p>
      <p class="nv-sc"><span class="nv-sck">Inspector</span>${l.sc}</p>
      ${acts[i] ? `<div class="nv-go" aria-hidden="true"><span>${acts[i]}</span><svg width="56" height="12" viewBox="0 0 56 12"><line x1="0" y1="6" x2="52" y2="6"/><path d="M47 1 L53 6 L47 11"/></svg></div>` : ''}
    </li>`).join('')}
  </ol>
  <section class="nv-back">
    <h3>Ways back and sideways</h3>
    <ul>
      <li><b>Level bar</b> every level names the ones above it; click any to go back up with the same selection.</li>
      <li><b>Open in the matrix</b> from any dimension, in the inspector or a table page, to see its column across all subject areas.</li>
      <li><b>Neighbours</b> the level bar steps to the previous or next subject area in the same functional area.</li>
      <li><b>Compare</b> from a subject area, side by side with a neighbour, the tables they share.</li>
    </ul>
  </section>`;
}

// ------------------------------------------------------------------ go
if (v === 'nav') renderNav();
else { renderArea(); renderSidecar(); }
await document.fonts.ready;
if (v !== 'nav') {
  drawFigure();
  let rt = 0;
  let lastW = 0;
  addEventListener('resize', () => { const w = document.getElementById('canvas')?.clientWidth ?? 0; if (w === lastW) return; lastW = w; cancelAnimationFrame(rt); rt = requestAnimationFrame(drawFigure); });
}
document.body.dataset.ready = '1';
