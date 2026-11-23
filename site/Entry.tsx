// <Entry />: the site's entry piece. A tall scroll track with a sticky stage; scroll progress drives a camera that
// climbs the side-on section (figures/section). Under the stage: a caption strip that changes per beat, then the
// five-layer list with counts and links. `?p=0.37` freezes the piece at a progress value (debug and screenshots).
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../figures/FigureFrame';
import { loadFigure, type Figure, type FigureHandle } from '../figures/contract';
import '../figures/index';
import { countsOf } from '../figures/section/data';
import { BEAT_COUNT, BEAT_NAMES, TIMING, beatAt, beatCentre, cameraAt, closeAt, isNarrow } from '../figures/section/model';
import { CALLOUTS, HINT_STATIC, LEGEND, PARTS, SECURITY } from '../content/entry';
import { CHAPTERS } from './chapters';
import { Link, navigate } from './router';
import { atlasPath, coursePath } from './routes';
import { ProvenanceMark } from './ui';
import { useOntology } from './useOntology';

const SCROLL_KEY = 'drawn:home-scroll';
/** the intro draws once per page load; coming back from an Atlas page does not draw it again */
let everDrawn = false;

const chapterHref = (band: number): string | null => {
  const part = PARTS[band];
  const ch = part && CHAPTERS.find((c) => c.id === part.chapter);
  return ch?.drawn ? coursePath(ch.id) : null;
};

function useReduced(): boolean {
  const [r, set] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => set(prefersReducedMotion());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const debugOn = (): boolean => /[?&]debug=1\b/.test(location.search);
const debugP = (): number | null => { const m = /[?&]p=([0-9.]+)/.exec(location.search); return m ? clamp01(parseFloat(m[1])) : null; };

interface BeatCopy { number: number; name: string; claim: string; count: string; pencil: boolean }
function beatCopy(beat: number, c: ReturnType<typeof countsOf> | null): BeatCopy {
  const counts = [
    '', `${c?.records ?? ''} source records`, 'Oracle runs it', `${c?.tables ?? ''} tables`, `${c?.subjectAreas ?? ''} subject areas`, 'two doors', '',
  ];
  if (beat === 0) return { number: 1, name: BEAT_NAMES[0], claim: 'Start at the bottom. Scroll.', count: '', pencil: false };
  if (beat === 6) return { number: 7, name: BEAT_NAMES[6], claim: 'Five parts and one order line. Point at a layer, or open any named table.', count: c ? `${c.records} records, ${c.tables} tables, ${c.subjectAreas} subject areas` : '', pencil: false };
  const part = PARTS[beat - 1];
  return { number: beat + 1, name: part.name, claim: part.claim, count: counts[beat], pencil: part.provenance === 'illustrative' };
}

function useFigure(): Figure | null {
  const [fig, setFig] = useState<Figure | null>(null);
  useEffect(() => { let live = true; loadFigure('section').then((f) => live && setFig(f ?? null)); return () => { live = false; }; }, []);
  return fig;
}

function Caption({ beat, copy, narrow, onTop }: { beat: number; copy: BeatCopy; narrow: boolean; onTop?: () => void }) {
  const calls = narrow && CALLOUTS[beat] ? CALLOUTS[beat] : null;
  return (
    <div className="en-cap" aria-hidden={onTop ? undefined : 'true'}>
      <div className="en-cap-in" key={beat}>
        <p className="en-cap-h"><span className="en-cap-n">{copy.number} / {BEAT_COUNT}</span><span className="en-cap-name">{copy.name}</span></p>
        <p className="en-cap-claim">{copy.claim}</p>
        <p className="en-cap-count">{copy.count || '\u00a0'}{copy.pencil ? <span className="en-cap-pencil"> pencil: documented, not in the lineage file</span> : null}</p>
        {calls && <ul className="en-cap-calls">{calls.map((c) => <li key={c.letter}><b>({c.letter})</b> {c.text.join(' ')}</li>)}</ul>}
      </div>
      {onTop && <button type="button" className="btn en-top" onClick={onTop}>from the ground again</button>}
    </div>
  );
}

/** A still of the finished section at one beat (reduced motion). */
function Still({ fig, ontology, beat, copy, stillKey }: { fig: Figure | null; ontology: NonNullable<ReturnType<typeof useOntology>['ontology']>; beat: number; copy: BeatCopy; stillKey?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.round(el.clientWidth))); ro.observe(el); setW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = host.current;
    if (!el || !fig || !w) return;
    const narrow = w < 540;
    const h = fig.mount(el, { step: 0, reducedMotion: true, finished: true, ontology, props: { still: beat, stillKey, height: beat === 6 ? (narrow ? 520 : 640) : beat === 5 && narrow ? 300 : (narrow ? 380 : 440), chapterHref, onChapter: navigate }, onOpen: (ref) => navigate(atlasPath(ref.type, ref.key)) });
    return () => h.destroy();
  }, [fig, w, ontology, beat, stillKey]);
  return (
    <figure className="en-still">
      <div ref={host} className="en-host" />
      <Caption beat={beat} copy={copy} narrow={w > 0 && w < 540} />
    </figure>
  );
}

export function Entry() {
  const { ontology } = useOntology();
  const reduced = useReduced();
  const fig = useFigure();
  const fixed = useMemo(debugP, []);
  const track = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<FigureHandle | null>(null);
  const prog = useRef(fixed ?? 0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [beat, setBeat] = useState(fixed !== null ? beatAt(fixed, { w: 1000, h: 625 }) : 0);
  const dbg = useMemo(debugOn, []);
  const [dbgP, setDbg] = useState(fixed ?? 0);
  const counts = useMemo(() => (ontology ? countsOf(ontology) : null), [ontology]);
  const layers = useMemo(() => PARTS.map((p) => ({ ...p, href: chapterHref(p.band) })), []);

  useEffect(() => {
    const el = host.current;
    if (!el || reduced) return;
    let timer = 0;
    const measure = () => {
      const w = Math.round(el.clientWidth), vh = window.innerHeight;
      const h = w < 540 ? Math.round(Math.max(380, Math.min(vh - 380, 520))) : Math.round(Math.max(480, Math.min(vh - 280, 720)));
      setSize((s) => (Math.abs(s.w - w) >= 2 || Math.abs(s.h - h) >= 24 ? { w, h } : s));
    };
    const ro = new ResizeObserver(() => { window.clearTimeout(timer); timer = window.setTimeout(measure, 120); });
    ro.observe(el); window.addEventListener('resize', measure); measure();
    return () => { window.clearTimeout(timer); ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [reduced]);

  useEffect(() => {
    const el = host.current;
    if (reduced || !el || !fig || !ontology || !size.w) return;
    const h = fig.mount(el, {
      step: 0, reducedMotion: false, ontology, finished: false,
      props: { height: size.h, progress: prog.current, chapterHref, onChapter: navigate },
      onOpen: (ref) => { try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch { /* ignore */ } navigate(atlasPath(ref.type, ref.key)); },
    });
    handle.current = h;
    if (!everDrawn && prog.current === 0) { everDrawn = true; h.replay(); }
    return () => { h.destroy(); handle.current = null; };
  }, [fig, ontology, size.w, size.h, reduced]);

  useEffect(() => {
    const t = track.current;
    if (!t || reduced) return;
    let raf = 0;
    const calc = () => {
      raf = 0;
      let p = prog.current;
      if (fixed === null) {
        const r = t.getBoundingClientRect();
        const span = Math.max(1, r.height - (host.current?.parentElement?.clientHeight ?? size.h) - 8);
        p = clamp01((8 - r.top) / span);
      }
      prog.current = p;
      handle.current?.setProgress?.(p);
      if (dbg) setDbg(p);
      const b = beatAt(p, { w: size.w || 1000, h: size.h || 625 });
      setBeat((prev) => (prev === b ? prev : b));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
    if (fixed === null) { window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on); }
    calc();
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, [size.h, reduced, fig, fixed]);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(SCROLL_KEY); sessionStorage.removeItem(SCROLL_KEY); } catch { /* ignore */ }
    if (saved) { const y = Number(saved); const t = window.setTimeout(() => window.scrollTo(0, y), 80); return () => window.clearTimeout(t); }
  }, []);

  const narrow = size.w > 0 && isNarrow({ w: size.w, h: size.h });
  const copy = beatCopy(beat, counts);
  const trackH = reduced || !size.h || fixed !== null ? undefined : size.h + 130 + Math.round(window.innerHeight * TIMING.trackViewports);
  const toTop = () => {
    const t = track.current; if (!t) return;
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 8, behavior: reduced ? 'auto' : 'smooth' });
  };
  return (
    <section className="en" aria-labelledby="en-h">
      {dbg && size.w > 0 && <DebugReadout p={dbgP} stage={{ w: size.w, h: size.h }} />}
      <h2 id="en-h" className="en-sr-h">How NetSuite Data Intelligence is put together. One order line, followed all the way up.</h2>
      {reduced ? (
        <div className="en-stills">
          <p className="en-hint">{HINT_STATIC}</p>
          {ontology && [[6, ''], [1, ''], [2, ''], [3, ''], [4, ''], [5, ''], ...(window.innerWidth < 540 ? [[5, 'doorB']] : [])].map(([b, k]) => <Fragment key={`${b}${k}`}><Still fig={fig} ontology={ontology} beat={b as number} copy={beatCopy(b as number, counts)} stillKey={(k as string) || undefined} /></Fragment>)}
        </div>
      ) : (
        <div ref={track} className="en-track" style={trackH ? { height: trackH } : undefined}>
          <div className="en-sticky">
            <div ref={host} className="en-host" />
            <Caption beat={beat} copy={copy} narrow={narrow} onTop={beat === BEAT_COUNT - 1 ? toTop : undefined} />
          </div>
        </div>
      )}
      <div className="en-legend" aria-hidden="true">
        <span className="prov"><span className="en-sw en-sw-a" /> <span className="mono-cap">{LEGEND.amber}</span></span>
        <span className="prov"><ProvenanceMark kind="illustrative" word={false} /> <span className="mono-cap">{LEGEND.pencil}</span></span>
      </div>
      <ol className="en-list" aria-label="The five parts, bottom to top">
        {layers.map((l, i) => (
          <li key={l.id}>
            <h3 className="en-list-h">
              <span className="toc-num">{i + 1}</span>
              {l.href ? <Link to={l.href}>{l.name}</Link> : <span>{l.name} <span className="faint">(chapter not yet drawn)</span></span>}
            </h3>
            <p className="en-list-claim">{l.claim}</p>
            <p className="en-list-meta"><ProvenanceMark kind={l.provenance} word={false} /> {i === 0 && counts ? `${counts.records} source records. ` : i === 2 && counts ? `${counts.tables} tables. ` : i === 3 && counts ? `${counts.subjectAreas} subject areas. ` : ''}{l.source}</p>
          </li>
        ))}
        <li>
          <h3 className="en-list-h"><span className="toc-num">+</span><span>{SECURITY.name}</span></h3>
          <p className="en-list-claim">{SECURITY.claim}</p>
          <p className="en-list-meta"><ProvenanceMark kind="illustrative" word={false} /> {SECURITY.source}</p>
        </li>
      </ol>
      <p className="en-foot">The amber line is the order line from chapter 1. <Link to={coursePath('follow-one-order-line')}>Follow it, chapter 1.</Link> Named tables and subject areas open their Atlas pages.</p>
    </section>
  );
}
void beatCentre;

/** `?debug=1`: progress, beat and camera scale, for tuning the timing block in model.ts. */
function DebugReadout({ p, stage }: { p: number; stage: { w: number; h: number } }) {
  const c = cameraAt(p, stage);
  const b = beatAt(p, stage);
  return (
    <pre className="en-debug">{`p ${p.toFixed(3)}  beat ${b} ${BEAT_NAMES[b]}\nscale ${c.s.toFixed(3)}  cy ${c.cy.toFixed(0)}  close ${closeAt(p, stage).toFixed(2)}\ntrack ${TIMING.trackViewports} vh  stage ${stage.w}x${stage.h}`}</pre>
  );
}
