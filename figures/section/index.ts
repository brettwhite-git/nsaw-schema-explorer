// section: the entry piece. The side-on section of NetSuite Data Intelligence, drawn tall in world coordinates, with a
// camera that climbs it as the page scrolls.
//   mount(el, { props: { height, progress, still } })
//   setProgress(p)   0 = the ground .. 1 = the whole section (a pure function: the camera, every reveal, the row marks)
//   replay()         draws the ground and the desk again (the only time-driven part)
// `still: n` renders the finished drawing at beat n (reduced motion: no travel, no draw-in).
import type { Figure, FigureHandle, FigureOpts } from '../contract';
import { DOOR_CLAIMS, PARTS, SECURITY } from '../../content/entry';
import { buildFields, countsOf } from './data';
import { BEAT_COUNT, BEAT_NAMES, beatAt, isNarrow, timelineFor } from './model';
import { SectionView, type NamedRef } from './render';
import { useStyle } from './style';

/** progress from which the whole section is at rest and interactive */
/** (the section is at rest from timelineFor(stage).restStart; this is the fallback for tools) */
export const REST_P = 0.93;

const figure: Figure = {
  mount(host: HTMLElement, opts: FigureOpts): FigureHandle {
    const o = opts.ontology;
    if (!o) { host.textContent = ''; return { setStep() {}, replay() {}, destroy() {} }; }
    const unStyle = useStyle();
    host.textContent = '';
    const W = Math.max(280, Math.round(host.clientWidth || 720));
    const H = Math.max(isNarrow({ w: W, h: 0 }) ? 380 : 440, Math.round((opts.props?.height as number) || host.clientHeight || 620));
    const stage = { w: W, h: H };
    const still = typeof opts.props?.still === 'number' ? (opts.props.still as number) : null;
    const stillKey = (opts.props?.stillKey as import('./model').KeyName | undefined) ?? null;
    const reduced = !!opts.reducedMotion;
    const counts = countsOf(o);
    const fields = buildFields(o);
    host.classList.add('sec-stage');
    host.style.height = `${H}px`;
    if (still === null) { host.tabIndex = 0; host.setAttribute('role', 'group'); host.setAttribute('aria-roledescription', 'scrolling drawing'); }
    const view = new SectionView(host, {
      stage, counts, fields, reduced, still, stillKey,
      chapterHref: (b) => (opts.props?.chapterHref as ((b: number) => string | null) | undefined)?.(b) ?? null,
      onOpen: opts.onOpen,
    });
    const nameFor = (i: number) => PARTS[i];
    view.setNumberedText([
      { n: '1', name: nameFor(0).name, claim: nameFor(0).claim, count: `${counts.records} source records`, short: 'NetSuite' },
      { n: '2', name: nameFor(1).name, claim: nameFor(1).claim, count: 'Oracle runs it (pencil)', short: 'Ingestion' },
      { n: '3', name: nameFor(2).name, claim: nameFor(2).claim, count: `${counts.tables} tables`, short: 'Warehouse' },
      { n: '4', name: nameFor(3).name, claim: nameFor(3).claim, count: `${counts.subjectAreas} subject areas`, short: 'Model' },
      { n: '5a', name: 'Door one: on the tables', claim: DOOR_CLAIMS.a, count: 'rows come out (pencil)', short: 'Door 1' },
      { n: '5b', name: 'Door two: through the model', claim: DOOR_CLAIMS.b, count: 'one number, 1,550.50 (pencil)', short: 'Door 2' },
    ]);
    const live = document.createElement('div');
    live.className = 'sec-sr'; live.setAttribute('aria-live', 'polite');
    host.appendChild(live);

    let p = typeof opts.props?.progress === 'number' ? (opts.props.progress as number) : (reduced || opts.finished ? 1 : 0);
    let hoverBand: number | null = null;
    let hoverNamed: NamedRef | null = null;
    let destroyed = false;
    let raf = 0;
    let introStart = 0;

    const beatLabel = (): string => {
      const b = beatAt(p, stage);
      const part = b >= 1 && b <= 5 ? PARTS[b - 1] : null;
      return `Section of NetSuite Data Intelligence, step ${b + 1} of ${BEAT_COUNT}: ${BEAT_NAMES[b]}. ${part ? part.claim : 'One order line, followed all the way up. Scroll to climb.'} ` +
        `At the end, Up and Down choose a layer, Left and Right choose a named table or subject area, Enter opens it.`;
    };
    const draw = (): void => { view.update(p, hoverBand); };
    if (still === null) host.setAttribute('aria-label', beatLabel());

    const atRest = (): boolean => p >= timelineFor(stage).restStart - 1e-9 && still === null;
    const tipFor = (n: NamedRef | null, band: number | null): { cls: string; text: string }[] | null => {
      if (n) {
        const lines = [{ cls: 'sec-tip-n', text: n.label }, { cls: 'sec-tip-k', text: n.kind }];
        if (n.band === 4) lines.push({ cls: 'sec-tip-p', text: 'documented by Oracle, not in the lineage file' });
        else lines.push({ cls: 'sec-tip-p', text: 'opens its Atlas page' });
        return lines;
      }
      if (band !== null) {
        const part = PARTS[band];
        const href = opts.props?.chapterHref ? (opts.props.chapterHref as (b: number) => string | null)(band) : null;
        return [{ cls: 'sec-tip-n', text: part.name }, { cls: 'sec-tip-k', text: href ? 'opens its chapter' : 'chapter not yet drawn' }];
      }
      return null;
    };
    const setHover = (n: NamedRef | null, band: number | null, sx = 0, sy = 0, announce = false): void => {
      const b = n && n.band < 4 ? n.band : band;
      if (n === hoverNamed && b === hoverBand) return;
      hoverNamed = n; hoverBand = b;
      draw();
      const t = tipFor(n, band);
      view.setTip(t, sx, sy);
      if (announce && t) live.textContent = t.map((l) => l.text).join('. ');
    };

    const local = (e: PointerEvent): [number, number] => { const r = host.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
    const open = (n: NamedRef | null, band: number | null): void => {
      if (n) { if (n.band === 4) { const h = chapter(4); if (h) opts.props?.onChapter && (opts.props.onChapter as (h: string) => void)(h); return; } opts.onOpen?.(n.ref); return; }
      if (band !== null) { const h = chapter(band); if (h) (opts.props?.onChapter as ((h: string) => void) | undefined)?.(h); }
    };
    const chapter = (b: number): string | null => (opts.props?.chapterHref as ((b: number) => string | null) | undefined)?.(b) ?? null;
    const onMove = (e: PointerEvent): void => {
      if (!atRest() || e.pointerType === 'touch') return;
      const [sx, sy] = local(e);
      const pk = view.pick(sx, sy);
      setHover(pk.named, pk.band, sx, sy);
      host.style.cursor = pk.named || (pk.band !== null && chapter(pk.band)) ? 'pointer' : '';
    };
    const onLeave = (): void => { if (atRest()) setHover(null, null); };
    const onClick = (e: MouseEvent): void => {
      if (!atRest()) return;
      const r = host.getBoundingClientRect();
      const pk = view.pick(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (pk.named || pk.band !== null) {
        // a first tap on a touch screen selects, a second opens
        const touch = (e as PointerEvent).pointerType === 'touch';
        if (touch && (hoverNamed !== pk.named || hoverBand !== pk.band)) { const [sx, sy] = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; setHover(pk.named, pk.band, sx, sy, true); return; }
        open(pk.named, pk.band);
      }
    };
    let kIdx = -1, bIdx = -1;
    const onKey = (e: KeyboardEvent): void => {
      if (e.target !== host || !atRest() || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault(); kIdx = -1;
        bIdx = bIdx < 0 ? (k === 'ArrowUp' ? 3 : 0) : Math.min(3, Math.max(0, bIdx + (k === 'ArrowUp' ? 1 : -1)));
        setHover(null, bIdx, W / 2, H / 2, true);
      } else if (k === 'ArrowRight' || k === 'ArrowLeft') {
        e.preventDefault(); bIdx = -1;
        const list = view.named.filter((n) => n.band < 4);
        kIdx = (kIdx + (k === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
        const n = list[kIdx];
        const [sx, sy] = [view.lastCam.s * (n.x + n.w / 2 - view.lastCam.cx) + W / 2, view.lastCam.s * (n.y - view.lastCam.cy) + H / 2];
        setHover(n, n.band, sx, sy, true);
      } else if (k === 'Enter' || k === ' ') { e.preventDefault(); open(hoverNamed, hoverBand); }
      else if (k === 'Escape') { setHover(null, null); kIdx = bIdx = -1; }
    };
    if (still === null) {
      host.addEventListener('pointermove', onMove); host.addEventListener('pointerleave', onLeave);
      host.addEventListener('click', onClick); host.addEventListener('keydown', onKey);
      host.addEventListener('blur', onLeave);
    }

    // the intro: the ground and the desk are drawn by time, once, so the first paint already has something in it
    const tickIntro = (now: number): void => {
      raf = 0;
      if (destroyed) return;
      view.intro = Math.min(1, (now - introStart) / 1600);
      draw();
      if (view.intro < 1) raf = requestAnimationFrame(tickIntro);
    };
    view.intro = reduced || opts.finished || still !== null || p > 0.04 ? 1 : 0;
    draw();
    (host as unknown as { __section: unknown }).__section = { view, get state() { return { p, hoverBand, beat: beatAt(p, stage) }; }, setHover, draw };

    return {
      setStep() {},
      setProgress(np: number) {
        const q = Math.min(1, Math.max(0, np));
        if (q === p) return;
        const was = beatAt(p, stage);
        p = q;
        if (hoverBand !== null && !atRest()) setHover(null, null);
        if (still === null && beatAt(p, stage) !== was) host.setAttribute('aria-label', beatLabel());
        draw();
      },
      setFrozen() {},
      replay() { view.intro = 0; introStart = performance.now(); if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(tickIntro); },
      destroy() {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerleave', onLeave);
        host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); host.removeEventListener('blur', onLeave);
        delete (host as unknown as { __section?: unknown }).__section;
        view.destroy(); live.remove();
        host.classList.remove('sec-stage');
        for (const a of ['tabindex', 'role', 'aria-label', 'aria-roledescription']) host.removeAttribute(a);
        host.style.height = ''; host.style.cursor = '';
        unStyle();
      },
    };
  },
};

void SECURITY;
export default figure;
