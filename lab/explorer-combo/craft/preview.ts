import { glyph, GLYPH_KINDS, paintPlate } from './index';

const NS = 'http://www.w3.org/2000/svg';
const LABEL: Record<string, string> = { fact: 'fact', dimension: 'dim', header: 'header', lines: 'lines', hierarchy: 'hier', derived: 'derived', netsuite: 'netsuite', report: 'report', subjectArea: 'subj area' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;
}

const timings: number[] = [];
async function build(pane: HTMLElement, theme: 'dark' | 'light'): Promise<void> {
  pane.append(el('h2', '', `Glyphs, ${theme}`));
  const grid = el('div', 'glyphs'); grid.id = `glyphs-${theme}`;
  grid.append(el('div'));
  for (const k of GLYPH_KINDS) grid.append(el('div', 'k', LABEL[k]));
  for (const size of [16, 20, 32]) {
    grid.append(el('div', 'lbl', `${size}px`));
    for (const k of GLYPH_KINDS) { const c = el('div', 'c'); c.append(glyph(k, size)); grid.append(c); }
  }
  pane.append(grid);

  pane.append(el('h2', '', 'Inline with text, 16px'));
  const inl = el('div', 'inline');
  for (const [k, t] of [['fact', 'DW_NS_SALES_ORDER_LINES_F'], ['dimension', 'DW_NS_CUSTOMER_D'], ['netsuite', 'salesOrder'], ['subjectArea', 'Sales Orders'], ['report', 'Amount']] as const) {
    const s = el('span'); s.append(glyph(k, 16), document.createTextNode(t)); inl.append(s);
  }
  pane.append(inl);

  pane.append(el('h2', '', 'Ink rule'));
  pane.append(el('hr', 'ink-rule'));
  pane.append(el('hr', 'ink-rule ink-rule--faint'));

  pane.append(el('h2', '', 'Stitch'));
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'thread'); svg.setAttribute('viewBox', '0 0 600 60'); svg.setAttribute('preserveAspectRatio', 'none');
  for (const [d, cls] of [['M10 18 C150 4 300 34 590 16', 'stitch'], ['M10 44 C200 56 380 30 590 46', 'stitch stitch--focus']]) {
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); svg.append(p);
  }
  pane.append(svg);

  pane.append(el('h2', '', 'Plate'));
  const cv = el('canvas', 'plate'); pane.append(cv);
  const t = performance.now(); await paintPlate(cv, { theme, seed: 7 }); timings.push(performance.now() - t);
}

(async () => {
  await build(document.querySelector('.pane.dark')!, 'dark');
  await build(document.querySelector('.pane.light')!, 'light');
  document.body.dataset.ready = '1';
  document.body.dataset.ms = timings.map((m) => m.toFixed(0)).join(',');
})();
