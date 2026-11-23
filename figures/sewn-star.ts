// The sewn star schema, data-driven from the ontology (ported from the lab's schemaFigure).
// Given a subject area it draws the primary fact and its most-shared dimensions (cap 8) as warehouse
// tags joined by stitched thread (inferred: co-occurrence in one subject area, not a verified join),
// and says on the figure how many dimensions are not drawn.
//   hover / focus: one tag and its thread take the accent, the rest drop to 30%
//   click / Enter: opens that table's Atlas page
import { drawLine } from '../ink/lines';
import { Scene } from '../ink/scene';
import { drawTag, tagWidth } from '../ink/tags';
import { el } from '../ink/svg';
import { emitFocus, emitStroke, type Figure, type FigureHandle, type FigureOpts } from './contract';
import { DEFAULT_CAP, selectStar, type StarData } from './sewn-star-data';

const FH0 = 40, DH = 30, ROW = DH + 14, PAD = 12;
const shortName = (n: string): string => n.replace(/^DW_NS_/, '');

interface Node { id: string; name: string; label: string; w: number; h: number; x: number; y: number; kind?: 'dim' | 'bundle' | 'hide' }

export function atlasHref(type: string, key: string): string {
  return `/atlas/${type}/${encodeURIComponent(key)}`;
}

const star: Figure = {
  mount(host: HTMLElement, opts: FigureOpts): FigureHandle {
    const saKey = String(opts.props?.subjectArea ?? '');
    const cap = Number(opts.props?.cap ?? DEFAULT_CAP);
    const data: StarData | undefined = opts.ontology ? selectStar(opts.ontology, saKey, cap) : undefined;
    const w = Math.max(280, host.clientWidth || 560);
    host.textContent = '';
    const cleanups: (() => void)[] = [];
    let delegate: FigureHandle | null = null;
    const rebuild = (ex: boolean): void => { cleanups.forEach((c) => c()); cleanups.length = 0; delegate = star.mount(host, { ...opts, finished: true, props: { ...opts.props, expanded: ex } }); };

    if (!data || !data.fact) {
      const h = 84;
      const sc = new Scene(host, w, h, data ? `${data.subjectArea.name} has no fact table to draw.` : 'No data for this figure.');
      const t = el('text', { x: PAD, y: 40, class: 'lbl-note' }, sc.svg);
      t.textContent = data ? 'This subject area has no unsecured fact table, so there is no star to draw.' : 'Loading the ontology...';
      sc.tl.finish();
      return { setStep() {}, replay() {}, destroy() { sc.destroy(); } };
    }

    const fact = data.fact;
    let factLabel = fact.name;
    let fw = tagWidth('warehouse', factLabel);
    if (fw > w - 2 * PAD) { factLabel = shortName(fact.name); fw = tagWidth('warehouse', factLabel); }
    const expanded = !!opts.props?.expanded;
    const mkNode = (d: { name: string }, i: number): Node => {
      const label = shortName(d.name);
      return { id: `d${i}`, name: d.name, label, w: tagWidth('warehouse', label), h: DH, x: 0, y: 0, kind: 'dim' };
    };
    const dimNodes: Node[] = data.dims.map(mkNode);
    const uni = data.universal;
    if (uni.length) {
      if (expanded) {
        uni.forEach((d, i) => dimNodes.push(mkNode(d, data.dims.length + i)));
        const label = `- hide the ${uni.length} shared`;
        dimNodes.push({ id: 'dhide', name: label, label, w: tagWidth('warehouse', label), h: DH, x: 0, y: 0, kind: 'hide' });
      } else {
        const label = `+ ${uni.length} shared by every area`;
        dimNodes.push({ id: 'dbundle', name: `${uni.length} dimensions every subject area shares: ${uni.map((d) => shortName(d.name)).join(', ')}`, label, w: tagWidth('warehouse', label), h: DH, x: 0, y: 0, kind: 'bundle' });
      }
    }
    const n = dimNodes.length;
    // tall enough that the thread knots on the fact's edge do not touch (knot diameter 4.6 px, 6 px apart)
    const FH = Math.max(FH0, Math.min(84, 14 + (n - 1) * 6));
    const maxD = Math.max(0, ...dimNodes.map((d) => d.w));
    const wide = w >= fw + 70 + maxD + 2 * PAD;
    const fn: Node = { id: 'fact', name: fact.name, label: factLabel, w: fw, h: FH, x: PAD, y: PAD };

    const footerH = 30;
    let h: number;
    const thr: { from: [number, number]; to: [number, number]; d: string }[] = [];
    if (wide) {
      const block = Math.max(FH, n * ROW - 14);
      const top = PAD;
      const dimX = w - PAD - maxD;
      dimNodes.forEach((d, i) => { d.x = dimX; d.y = top + i * ROW + (block - (n * ROW - 14)) / 2; });
      fn.y = top + (block - FH) / 2;
      h = top + block + footerH + PAD;
      dimNodes.forEach((d, i) => {
        const a: [number, number] = [fn.x + fn.w, fn.y + 7 + (n > 1 ? (i * (FH - 14)) / (n - 1) : (FH - 14) / 2)];
        const b: [number, number] = [d.x, d.y + DH / 2];
        const mx = (a[0] + b[0]) / 2;
        thr.push({ from: a, to: b, d: `M${a[0]} ${a[1]}C${mx} ${a[1]} ${mx} ${b[1]} ${b[0]} ${b[1]}` });
      });
    } else {
      // thread starts are 5 px apart (knots do not touch) unless the widest tag needs the room
      const gapX = n > 1 ? Math.max(2.5, Math.min(5, (w - 2 * PAD - maxD - 38) / (n - 1))) : 0;
      const bundle = 14 + (n - 1) * gapX;
      const dimX = PAD + bundle + 24;
      const top = fn.y + FH + 26;
      dimNodes.forEach((d, i) => { d.x = dimX; d.y = top + i * ROW; });
      h = top + n * ROW - 14 + footerH + PAD;
      dimNodes.forEach((d, i) => {
        const sx = fn.x + 14 + (n - 1 - i) * gapX, sy = fn.y + FH;
        const ey = d.y + DH / 2;
        thr.push({ from: [sx, sy], to: [d.x, ey], d: `M${sx} ${sy}L${sx} ${ey - 10}Q${sx} ${ey} ${sx + 10} ${ey}L${d.x} ${ey}` });
      });
    }

    const label = `Star schema for ${data.subjectArea.name}: fact table ${fact.name} with ${n} of ${data.totalDims} dimensions drawn` +
      (data.notDrawn ? `, ${data.notDrawn} not drawn.` : '.');
    const sc = new Scene(host, w, Math.round(h), label);
    const tg = el('g', { class: 'threads' }, sc.svg);
    const gg = el('g', { class: 'tags' }, sc.svg);
    sc.svg.classList.add('star');

    const tagEls = new Map<string, SVGGElement>();
    const threadEls = new Map<string, SVGGElement>();
    const all = [fn, ...dimNodes];

    const setFocus = (id: string | null): void => {
      const eff = id ?? 'fact';
      for (const nd of all) {
        const g = tagEls.get(nd.id)!;
        const on = nd.id === eff;
        g.classList.toggle('is-on', on);
        g.classList.toggle('is-dim', !!id && id !== 'fact' && !on && nd.id !== 'fact');
        const t = threadEls.get(nd.id);
        if (t) {
          const tOn = !!id && id !== 'fact' && nd.id === id;
          t.classList.toggle('is-on', tOn);
          t.classList.toggle('is-dim', !!id && id !== 'fact' && !tOn);
        }
      }
      sc.svg.classList.toggle('has-focus', !!id);
      const nd = all.find((a) => a.id === id);
      emitFocus(host, nd ? { x: nd.x + nd.w / 2, y: nd.y + nd.h / 2, label: nd.name } : null);
    };

    // tags (their group sits above the threads group in the DOM)
    const tagsHandles = new Map<string, ReturnType<typeof drawTag>>();
    const link = (nd: Node, seed: number) => {
      const toggle = nd.kind === 'bundle' || nd.kind === 'hide';
      const a = el('a', { class: 'tag-link', href: toggle ? '#' : atlasHref('physicalTable', nd.name), 'aria-label': toggle ? (nd.kind === 'bundle' ? `${nd.name}. Show them` : 'Hide the shared dimensions') : `${nd.name}: open its Atlas page`, ...(toggle ? { role: 'button', 'aria-expanded': String(expanded) } : {}) }, gg);
      const th = drawTag(sc, a, nd.x, nd.y, nd.w, nd.h, { layer: 'warehouse', label: nd.label, seed, id: nd.id, cls: nd.id === 'fact' ? 'fact' : '' });
      tagEls.set(nd.id, th.g);
      tagsHandles.set(nd.id, th);
      a.addEventListener('pointerenter', (e) => { if ((e as PointerEvent).pointerType !== 'touch') setFocus(nd.id); });
      a.addEventListener('pointerleave', (e) => { if ((e as PointerEvent).pointerType !== 'touch') setFocus(null); });
      a.addEventListener('focus', () => setFocus(nd.id));
      a.addEventListener('blur', () => setFocus(null));
      a.addEventListener('click', (e) => {
        const me = e as MouseEvent;
        if (me.metaKey || me.ctrlKey || me.shiftKey || me.button !== 0) return;
        e.preventDefault();
        if (toggle) { rebuild(!expanded); return; }
        opts.onOpen?.({ type: 'physicalTable', key: nd.name });
      });
    };
    link(fn, 11);
    dimNodes.forEach((d, i) => link(d, 16 + i * 5));

    // schedule: the fact, then each thread and the tag it reaches, then the not-drawn line
    const THREAD_MS = 520, STEP_MS = 360;
    const factEnd = tagsHandles.get('fact')!.schedule(0);
    dimNodes.forEach((d, i) => {
      const start = factEnd - 60 + i * STEP_MS;
      const lh = drawLine(sc, tg, thr[i].d, { provenance: 'inferred', seed: 5 + i, ends: [thr[i].from, thr[i].to], t0: start, dur: THREAD_MS, focusId: d.id });
      threadEls.set(d.id, lh.g);
      tagsHandles.get(d.id)!.schedule(start + THREAD_MS - 140);
    });
    setFocus(null);
    const t = factEnd - 60 + n * STEP_MS + THREAD_MS;

    const note = el('text', { x: PAD, y: Math.round(h) - PAD - 4, class: 'lbl-note' }, sc.svg);
    const rank = data.rankedBy === 'columns' ? 'ranked by columns fed here' : 'ranked by how widely shared';
    note.textContent = data.notDrawn
      ? `+${data.notDrawn} more dimension${data.notDrawn === 1 ? '' : 's'} not drawn, ${rank}`
      : data.totalDims === 0 ? 'no dimensions beyond the shared ones' : `all ${data.totalDims} dimension${data.totalDims === 1 ? '' : 's'} drawn`;
    sc.tl.label(note, t + 300, 420);
    sc.tl.onStroke((it) => emitStroke(host, it.label));

    const reduced = opts.reducedMotion || !!opts.finished;
    if (reduced) sc.tl.finish();
    cleanups.push(() => sc.destroy());

    return {
      setStep() {},
      setProgress: (p) => (delegate ? delegate.setProgress?.(p) : sc.tl.setProgress(p)),
      setFrozen: (f) => (delegate ? delegate.setFrozen?.(f) : sc.tl.freeze(f)),
      replay: () => { if (delegate) delegate.replay(); else if (opts.reducedMotion) sc.tl.finish(); else sc.tl.replay(); },
      destroy: () => { if (delegate) delegate.destroy(); cleanups.forEach((c) => c()); },
    };
  },
};

export default star;
