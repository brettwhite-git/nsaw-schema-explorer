// <Chapter content={ChapterContent} />: scrollytelling. The figure sticks on one side (above, on phones),
// the steps scroll past; the step in view tells the figure which state to show.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ChapterContent, ChapterStep } from '../content/types';
import { FigureFrame, prefersReducedMotion } from '../figures/FigureFrame';
import { hasFigure } from '../figures/contract';
import '../figures/index';
import { writeText, type WrittenHandle } from '../ink/written';
import { Link } from './router';
import { atlasPath } from './routes';
import { Copy, ProvenanceMark } from './ui';
import { useOntology } from './useOntology';

/** Split a note into at most a few short lines at word boundaries (about 30 characters each). */
export function noteLines(text: string, max = 30): string[] {
  if (text.includes('\n')) return text.split('\n').map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

function MarginNote({ text, seed }: { text: string; seed: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => noteLines(text), [text]);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    const h: WrittenHandle = writeText(root, lines, { seed, tilt: 1.2, reduced });
    if (reduced) return () => h.destroy();
    let played = false;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting && es[0].intersectionRatio >= 0.6 && !played) { played = true; h.play(250); io.disconnect(); }
    }, { threshold: [0.6] });
    io.observe(root);
    return () => { io.disconnect(); h.destroy(); };
  }, [lines, seed]);
  return <div ref={ref} className="margin-note" />;
}

function Step({ step, index, active, onActive }: { step: ChapterStep; index: number; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(prefersReducedMotion());
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    // the step crossing the middle band of the viewport is the one in view
    const mid = new IntersectionObserver((es) => { if (es[0].isIntersecting) onActive(index); }, { rootMargin: '-35% 0px -55% 0px' });
    mid.observe(e);
    const fade = new IntersectionObserver((es) => { if (es[0].isIntersecting) { setSeen(true); fade.disconnect(); } }, { threshold: 0.12 });
    fade.observe(e);
    return () => { mid.disconnect(); fade.disconnect(); };
  }, [index, onActive]);
  return (
    <section ref={ref} id={step.id} className={`step${active ? ' is-active' : ''}${seen ? ' is-seen' : ''}`} data-step={index} aria-labelledby={`${step.id}-h`}>
      <div className="seam" aria-hidden="true" />
      <div className="step-text">
        <h2 id={`${step.id}-h`} className="step-h"><span className="step-n">{index + 1}</span>{step.heading}</h2>
        {step.body.map((p, i) => <p key={i} className="body"><Copy text={p} /></p>)}
        {step.callouts && (
          <ul className="callouts">
            {step.callouts.map((c) => (
              <li key={c.letter}><span className="callout-l">({c.letter})</span> <Copy text={c.text} /></li>
            ))}
          </ul>
        )}
        {step.note && <MarginNote text={step.note} seed={index + 1} />}
        {step.threads && (
          <div className="threads-block">
            <p className="mono-cap">PULL THIS THREAD</p>
            <ul className="thread-links">
              {step.threads.map((t) => (
                <li key={t.to.type + t.to.key + t.label}>
                  <ProvenanceMark kind={t.provenance} word={false} />
                  <Link to={atlasPath(t.to.type, t.to.key)}>{t.label}</Link>
                  <span className="mono-cap faint">{t.provenance}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function Chapter({ content }: { content: ChapterContent }) {
  const [active, setActive] = useState(0);
  const { ontology } = useOntology();
  const figureStep = content.steps[Math.min(active, content.steps.length - 1)]?.figureStep ?? 0;
  // a new chapter starts at its first step
  useEffect(() => setActive(0), [content.id]);
  useEffect(() => { document.title = `${content.title} - The Warehouse, Drawn`; }, [content.title]);
  const registered = hasFigure(content.figure);
  return (
    <article className="chapter">
      <header className="page-head">
        <p className="label-row">CH. {String(content.number).padStart(2, '0')} <i /> {content.title.toUpperCase()}</p>
        <h1 className="title">{content.title}</h1>
        <p className="dek">{content.dek}</p>
        {content.illustrativeNote && (
          <p className="illus-note"><span className="ill-word">illustration</span> {content.illustrativeNote}</p>
        )}
      </header>
      <div className="chapter-grid">
        <div className={`chapter-fig${registered ? '' : ' is-missing'}`}>
          <FigureFrame figure={content.figure} step={figureStep} ontology={ontology} number={content.number} title={content.title} illustration={!!content.illustrativeNote} />
        </div>
        <div className="chapter-steps">
          {content.steps.map((s, i) => <Fragment key={s.id}><Step step={s} index={i} active={i === active} onActive={setActive} /></Fragment>)}
        </div>
      </div>
    </article>
  );
}
