// order-line-journey: one continuous drawing, eight states (storyboard content/ch01.storyboard.md).
//   mount(el, { step })  builds that state (finished at once when reducedMotion or opts.finished)
//   setStep(n)           forward: draws in what is new, in the storyboard's order; back: removes what is later,
//                        quietly (160 ms); a jump lands on the finished target state
//   replay()             draws the current state in again from the previous one
// One source of truth: `cur`. Every transition first finishes whatever was in flight, so fast scrolling never
// leaves half-drawn strokes or stacked animations.
import { Scene } from '../../ink/scene';
import { Timeline } from '../../ink/timeline';
import { emitFocus, type Figure, type FigureHandle, type FigureOpts } from '../contract';
import { monoW } from './geom';
import { buildSpec } from './layout';
import { BACKWARD_IDS, STEPS, STEP_COUNT, focusOf, itemsAt, type HoverDef, type Item, type Layer, type Spec, type Tip } from './model';
import { build, type ElRec, type Env } from './render';
import { BUDGET_MS, schedule } from './schedule';
import { addLocator, showSheet, type Locator } from './phone';
import { useStyle } from './style';
import { el } from '../../ink/svg';

const REMOVE_MS = 160;

const figure: Figure = {
  mount(host: HTMLElement, opts: FigureOpts): FigureHandle {
    const unStyle = useStyle();
    const W = Math.max(280, Math.round(host.clientWidth || 560));
    const spec: Spec = buildSpec(W);
    host.textContent = '';
    const reduced = !!opts.reducedMotion;
    const scene = new Scene(host, W, spec.H, STEPS[0].alt);
    const svg = scene.svg;
    svg.classList.add('oljf');
    if (reduced) svg.classList.add('rm');
    svg.setAttribute('role', 'group');
    const desc = el('desc', {}, svg);
    svg.insertBefore(desc, svg.firstChild);
    const layers = {} as Record<Layer, SVGGElement>;
    for (const l of ['back', 'lines', 'boxes', 'text', 'top'] as Layer[]) layers[l] = el('g', { class: `layer-${l}` }, svg);
    const tipG = el('g', { class: 'tip', 'aria-hidden': 'true' }, svg);
    const capEl = document.createElement('div');
    capEl.className = 'oljf-cap';
    capEl.setAttribute('aria-hidden', 'true');
    capEl.style.cssText = 'font:400 10.5px/1.5 var(--mono);letter-spacing:0.02em;color:var(--ink-2);margin-top:10px;min-height:16px';
    host.appendChild(capEl);
    const inSheet = !!opts.props?.sheet;
    const phone = spec.layout === 'phone' && !inSheet;
    if (phone) {
      host.style.maxHeight = 'min(50vh, 420px)';
      host.style.overflowY = 'auto';
      host.style.overscrollBehavior = 'contain';
      capEl.style.cssText += ';position:sticky;bottom:0;background:var(--paper);padding:6px 0 2px';
    }
    const env: Env = { scene, svg, defs: scene.defs, layers, W, H: spec.H, tl: new Timeline(), k: 1 };

    let cur = Math.max(0, Math.min(STEP_COUNT - 1, Math.round(opts.step || 0)));
    let locator: Locator | null = null;
    let revealed = reduced || !!opts.finished;
    let tl: Timeline | null = null;
    let hoverKey: string | null = null;
    if (phone) {
      locator = addLocator(host, spec.H, W, () => spec.view.map(([y0, y1]) => ({ y0, y1 })), () => cur, () => showSheet(figure, opts, cur));
      svg.addEventListener('click', (e) => { if (!(e.target as Element).closest('[data-ref]')) showSheet(figure, opts, cur); });
    }
    const els = new Map<string, ElRec>();
    const pending = new Map<string, number>();
    let destroyed = false;

    // ------------------------------------------------------------ state painting (classes only)
    const applyState = (): void => {
      const focus = focusOf(cur);
      const hv: HoverDef | undefined = hoverKey ? spec.hovers[hoverKey] : undefined;
      const act = !!hv && (hv.lit.length > 0 || !!hv.dim || !!hv.solo);
      const lit = new Set(hv?.lit ?? []);
      for (const rec of els.values()) {
        const isLit = lit.has(rec.id);
        rec.g.classList.toggle('dim', act && !!hv!.dim && !isLit);
        for (const n of rec.nodes) {
          let on: boolean;
          if (n.hl) on = hoverKey === n.hl;
          else if (act) on = n.main && isLit;
          else on = n.f.includes(focus);
          n.node.classList.toggle('on', on);
        }
      }
      showTip(hv);
    };

    const showTip = (hv: HoverDef | undefined): void => {
      tipG.classList.remove('show');
      const tips = hv?.tips?.filter((t) => t.fromStep <= cur);
      const tip: Tip | undefined = tips && tips.length ? tips[tips.length - 1].tip : undefined;
      if (!tip) return;
      tipG.textContent = '';
      const lh = 13, padX = 6;
      const w = Math.max(...tip.lines.map((l) => monoW(l, 10.5))) + padX * 2, h = tip.lines.length * lh + 7;
      let x = tip.x, y = tip.y;
      if (tip.place === 'below') { x -= w / 2; y += 7; }
      else if (tip.place === 'above') { x -= w / 2; y -= h + 7; }
      else if (tip.place === 'right') { x += 9; y -= h / 2; }
      else { x -= w + 9; y -= h / 2; }
      x = Math.max(2, Math.min(W - w - 2, x));
      y = Math.max(2, Math.min(spec.H - h - 2, y));
      el('rect', { x, y, width: w, height: h, rx: 0 }, tipG);
      tip.lines.forEach((l, i) => { const t = el('text', { x: x + padX, y: y + 12 + i * lh }, tipG); t.textContent = l; });
      tipG.classList.add('show');
    };

    const setHover = (k: string | null): void => {
      if (k === hoverKey) return;
      hoverKey = k;
      applyState();
      emitFocus(host, null);
    };

    // ------------------------------------------------------------ binding (hover, focus, click)
    const open = (rec: ElRec): void => {
      if (rec.item.hk === 'num') { replayBackward(); return; }
      if (rec.item.ref) opts.onOpen?.(rec.item.ref);
    };
    const labelOf = (it: Item): string => {
      switch (it.k) {
        case 'tag': case 'hex': return `${it.full}: open its Atlas page`;
        case 'rec': return it.pencil ? `${it.name}: not in the lineage file. Open the entity Sales Order Transaction Accounting Line` : `${it.name}: open its Atlas page`;
        case 'pill': return `${it.lines.join(' ')}: open its Atlas page`;
        case 'box': return it.hk === 'num' ? 'Report number 1,550.50: draw the thread back to the form' : 'SOURCE_RECORD_ID, not in the lineage file: open the entity Sales Order Transaction Accounting Line';
        case 'text': return it.hk === 'ghosts' ? 'x 87 fact tables load from Transactions: open the Transactions record' : it.hk === 'x65' ? 'x 65 tables load from TransactionLine: open the TransactionLine record' : 'Subject area NetSuite - Sales Order: open its Atlas page';
        default: return '';
      }
    };
    const FOCUSABLE = new Set(['rec', 'tag', 'hex', 'pill', 'box', 'text']);
    const bind = (rec: ElRec): void => {
      const it = rec.item;
      rec.g.querySelectorAll('[data-hk]').forEach((n) => {
        const hk = n.getAttribute('data-hk')!;
        n.addEventListener('pointerenter', (e) => { if ((e as PointerEvent).pointerType !== 'touch') setHover(hk); });
        n.addEventListener('pointerleave', (e) => { if ((e as PointerEvent).pointerType !== 'touch') setHover(null); });
      });
      const clickable = !!it.ref || it.hk === 'num';
      if (!clickable) return;
      rec.g.setAttribute('data-ref', it.ref ? `${it.ref.type}` : 'replay');
      rec.g.addEventListener('click', (e) => {
        const me = e as MouseEvent;
        if (me.metaKey || me.ctrlKey || me.shiftKey || me.button !== 0) return;
        open(rec);
      });
      if (FOCUSABLE.has(it.k) && it.hk) {
        const hk = it.hk;
        rec.g.setAttribute('tabindex', '0');
        rec.g.setAttribute('role', hk === 'num' ? 'button' : 'link');
        rec.g.setAttribute('aria-label', labelOf(it));
        rec.g.addEventListener('focus', () => setHover(hk));
        rec.g.addEventListener('blur', () => setHover(null));
        rec.g.addEventListener('keydown', (e) => {
          const ke = e as KeyboardEvent;
          if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); open(rec); }
        });
      }
    };

    // ------------------------------------------------------------ building
    const buildList = (list: Item[], animate: boolean): void => {
      if (!list.length) return;
      const sorted = [...list].sort((a, b) => a.ord - b.ord);
      let k = 1;
      const sch = schedule(sorted);
      if (animate && sch.total > BUDGET_MS) k = BUDGET_MS / sch.total;
      const t = new Timeline();
      env.tl = t;
      env.k = animate ? k : 1;
      for (const it of sorted) {
        const rec = build(env, it, animate ? (sch.start.get(it.ord) ?? 0) * k : 0);
        els.set(it.id, rec);
        bind(rec);
      }
      if (animate) { tl = t; t.play(); tl.freeze(!revealedVisible); }
      else { t.finish(); t.destroy(); }
    };
    let revealedVisible = true;

    const cancel = (): void => {
      if (tl) { tl.finish(); tl.destroy(); tl = null; }
      for (const [id, timer] of pending) { window.clearTimeout(timer); els.get(id)?.g.remove(); els.delete(id); }
      pending.clear();
    };

    const removeNow = (id: string): void => { const r = els.get(id); if (r) { r.g.remove(); els.delete(id); } };
    const removeSoon = (ids: string[]): void => {
      for (const id of ids) {
        const r = els.get(id);
        if (!r) continue;
        r.g.classList.add('gone');
        r.g.querySelectorAll('[tabindex]').forEach((n) => n.removeAttribute('tabindex'));
        pending.set(id, window.setTimeout(() => { pending.delete(id); removeNow(id); }, REMOVE_MS + 20));
      }
    };

    const setCaption = (animate: boolean): void => {
      capEl.textContent = STEPS[cur].caption;
      capEl.style.clipPath = 'none';
      if (animate && tl) {
        const t0 = Math.max(0, tl.total * 0.45);
        tl.label(capEl, t0, 420);
      }
    };
    const setAria = (): void => {
      svg.setAttribute('aria-label', `Order line journey. ${STEPS[cur].alt}`);
      desc.textContent = `${STEPS[cur].caption}`;
    };

    const pan = (animate: boolean): void => {
      if (!phone) return;
      const [y0, y1] = spec.view[cur];
      const hh = host.clientHeight;
      // centre what the step adds; when it is taller than the window, start at its top
      const top = Math.max(0, Math.min(spec.H - hh + 40, y1 - y0 > hh - 24 ? y0 - 12 : (y0 + y1) / 2 - hh / 2));
      host.scrollTo({ top, behavior: animate && !reduced ? 'smooth' : 'auto' });
      locator?.update();
    };

    /** bring the DOM to `next`. animate: draw in what the step adds. */
    const go = (next: number, animate: boolean): void => {
      cancel();
      const prev = cur;
      cur = next;
      const want = itemsAt(spec.items, next);
      const wantIds = new Set(want.map((i) => i.id));
      const gone = [...els.keys()].filter((id) => !wantIds.has(id));
      const adds = want.filter((i) => !els.has(i.id));
      if (!animate) {
        gone.forEach(removeNow);
        buildList(adds, false);
      } else if (next < prev) {
        removeSoon(gone);
        buildList(adds, false);
      } else {
        removeSoon(gone);
        buildList(adds.filter((i) => i.step !== next), false);
        buildList(adds.filter((i) => i.step === next), true);
      }
      setCaption(animate && next >= prev);
      setAria();
      applyState();
      pan(animate);
    };

    function replayBackward(): void {
      if (cur !== STEP_COUNT - 1 || reduced) return;
      cancel();
      const ids = new Set(BACKWARD_IDS);
      for (const id of ids) removeNow(id);
      buildList(spec.items.filter((i) => ids.has(i.id)), true);
      applyState();
    }

    // ------------------------------------------------------------ initial state
    if (revealed) go(cur, false);
    else setAria();
    if (!revealed) capEl.textContent = '';

    return {
      setStep(n: number): void {
        if (destroyed) return;
        const next = Math.max(0, Math.min(STEP_COUNT - 1, Math.round(n)));
        if (!revealed) { cur = next; setAria(); return; }
        if (next === cur && els.size) return;
        go(next, !reduced);
      },
      replay(): void {
        if (destroyed) return;
        revealed = true;
        if (reduced) { cancel(); for (const id of [...els.keys()]) removeNow(id); go(cur, false); return; }
        cancel();
        for (const id of [...els.keys()]) removeNow(id);
        go(cur, true);
      },
      setFrozen(f: boolean): void { revealedVisible = !f; tl?.freeze(f); },
      destroy(): void {
        destroyed = true;
        cancel();
        scene.destroy();
        capEl.remove();
        locator?.destroy();
        host.style.maxHeight = '';
        host.style.overflowY = '';
        host.style.overscrollBehavior = '';
        unStyle();
      },
    };
  },
};

export default figure;
