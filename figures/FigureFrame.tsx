// <FigureFrame figure="key" step={n} />: the React wrapper around a figure.
//   - measures its stage (ResizeObserver) and rebuilds on width change, keeping the drawn state
//   - waits to draw until 35% of it is on screen (IntersectionObserver), draws once
//   - freezes while off-screen
//   - prefers-reduced-motion (or ?reduced=1): the finished drawing at once, interactions kept
//   - colours come from CSS variables, so a theme toggle needs no rebuild
import { useEffect, useMemo, useRef, useState } from 'react';
import tokens from '../tokens.json';
import { navigate } from '../site/router';
import { atlasPath } from '../site/routes';
import type { Ontology } from '../ontology/load';
import { loadFigure, type Figure, type FigureHandle } from './contract';
import './index';

export function prefersReducedMotion(): boolean {
  return /[?&]reduced=1\b/.test(location.search) || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function useReducedMotion(): boolean {
  const [r, set] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => set(prefersReducedMotion());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

interface Props {
  figure: string;
  step?: number;
  /** 0..1 scroll-driven drawing; omit to draw by time when the figure comes on screen */
  progress?: number;
  ontology?: Ontology;
  props?: Record<string, unknown>;
  number?: number;
  title?: string;
  /** shows the word "illustration" in the header (rulebook principle 9) */
  illustration?: boolean;
  caption?: string;
  className?: string;
}

type Status = 'loading' | 'ready' | 'missing';

export function FigureFrame({ figure, step = 0, progress, ontology, props, number, title, illustration, caption, className }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const handle = useRef<FigureHandle | null>(null);
  const drawn = useRef(false);
  const visible = useRef(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  const [status, setStatus] = useState<Status>('loading');
  const [fig, setFig] = useState<Figure | null>(null);
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const propsKey = useMemo(() => JSON.stringify(props ?? {}), [props]);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    loadFigure(figure).then((f) => {
      if (!live) return;
      if (f) { setFig(f); setStatus('ready'); } else { setFig(null); setStatus('missing'); }
    }, () => live && setStatus('missing'));
    return () => { live = false; };
  }, [figure]);

  // measure the stage: rebuild when the width changes (never scale a drawn figure with viewBox)
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const w = Math.round(el.clientWidth);
        setWidth((prev) => (Math.abs(prev - w) >= 2 ? w : prev));
      }, 120);
    });
    ro.observe(el);
    setWidth(Math.round(el.clientWidth));
    return () => { window.clearTimeout(timer); ro.disconnect(); };
  }, [status]);

  // build / rebuild
  useEffect(() => {
    const el = stage.current;
    if (!el || !fig || !width) return;
    const h = fig.mount(el, {
      step: stepRef.current,
      reducedMotion: reduced,
      ontology,
      props,
      finished: drawn.current || reduced,
      onOpen: (ref) => navigate(atlasPath(ref.type, ref.key)),
    });
    handle.current = h;
    h.setFrozen?.(!visible.current);
    if (visible.current && !drawn.current && !reduced && progress === undefined) { drawn.current = true; h.replay(); }
    if (reduced) drawn.current = true;
    return () => { h.destroy(); handle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fig, width, reduced, ontology, propsKey]);

  // first reveal at 35% on screen; freeze when off-screen
  useEffect(() => {
    const el = stage.current;
    if (!el || status !== 'ready') return;
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      visible.current = e.isIntersecting;
      const h = handle.current;
      if (!h) return;
      h.setFrozen?.(!e.isIntersecting);
      if (e.intersectionRatio >= tokens.motion.triggerVisibleRatio && !drawn.current) {
        drawn.current = true;
        if (progress === undefined && !reduced) h.replay();
      }
    }, { threshold: [0, tokens.motion.triggerVisibleRatio] });
    io.observe(el);
    return () => io.disconnect();
  }, [status, reduced, progress]);

  useEffect(() => { handle.current?.setStep(step); }, [step]);
  useEffect(() => { if (progress !== undefined) handle.current?.setProgress?.(progress); }, [progress, width, fig]);

  const replay = () => { drawn.current = true; handle.current?.replay(); };

  return (
    <figure className={`figure-frame ${className ?? ''}`} data-figure={figure}>
      {(title || number) && (
        <figcaption className="fig-head">
          {number ? `FIG. ${number} / ` : ''}{title?.toUpperCase()}
          {illustration && <span className="ill">illustration</span>}
        </figcaption>
      )}
      {status === 'missing' ? (
        <div className="fig-missing" role="note">
          <span className="mono-cap">figure not yet drawn</span>
          <span className="fig-missing-key">{figure}</span>
        </div>
      ) : (
        <div ref={stage} className="fig-stage" aria-busy={status === 'loading'} />
      )}
      <div className="fig-foot">
        {caption && <span className="fig-cap">{caption}</span>}
        {status === 'ready' && !reduced && (
          <button type="button" className="btn" onClick={replay}>replay</button>
        )}
      </div>
    </figure>
  );
}
