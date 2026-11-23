// Small React pieces built on the ink primitives: copy with inline marks, a provenance mark, a static layer tag.
import { useEffect, useMemo, useRef } from 'react';
import tokens from '../tokens.json';
import { roughPath, PENCIL } from '../ink/rough';
import { Scene } from '../ink/scene';
import { drawTag, tagWidth, LAYERS, type Layer } from '../ink/tags';
import { el } from '../ink/svg';
import { parseMarks } from './marks';
import type { Provenance } from '../content/types';

export function Copy({ text }: { text: string }) {
  return (
    <>
      {parseMarks(text).map((m, i) =>
        m.kind === 'em' ? <em key={i}>{m.text}</em> : m.kind === 'code' ? <code key={i}>{m.text}</code> : <span key={i}>{m.text}</span>)}
    </>
  );
}

const MARK_W = 40, MARK_H = 12;
export const PROVENANCE_WORD: Record<Provenance, string> = { explicit: 'explicit', inferred: 'inferred', illustrative: 'illustrative' };

/** The three line styles as a tiny static sample, so a list or a link says where its fact came from. */
export function ProvenanceMark({ kind, word = true }: { kind: Provenance; word?: boolean }) {
  const d = useMemo(() => {
    if (kind === 'explicit') return roughPath(`M3 ${MARK_H / 2}H${MARK_W - 3}`, 31);
    if (kind === 'illustrative') return roughPath(`M3 ${MARK_H / 2}H${MARK_W - 3}`, 41, PENCIL);
    return `M3 ${MARK_H / 2}Q${MARK_W / 2} ${MARK_H / 2 + 3} ${MARK_W - 3} ${MARK_H / 2}`;
  }, [kind]);
  return (
    <span className={`prov prov-${kind}`} title={`${PROVENANCE_WORD[kind]}`}>
      <svg width={MARK_W} height={MARK_H} viewBox={`0 0 ${MARK_W} ${MARK_H}`} aria-hidden="true" focusable="false">
        {kind === 'inferred' ? (
          <>
            <path d={d} className="thread" />
            <circle cx={3} cy={MARK_H / 2} r={tokens.line.thread.knotR - 0.6} className="knot" />
            <circle cx={MARK_W - 3} cy={MARK_H / 2} r={tokens.line.thread.knotR - 0.6} className="knot" />
          </>
        ) : (
          <path d={d} className={kind === 'illustrative' ? 'ink pencil-plain' : 'ink'} strokeWidth={kind === 'illustrative' ? 1.4 : tokens.line.weights.standard} style={{ strokeDasharray: 'none' }} />
        )}
      </svg>
      {word && <span className="prov-word">{PROVENANCE_WORD[kind]}</span>}
    </span>
  );
}

/** A name drawn as its layer's tag, finished (no animation): used on Atlas pages. */
export function LayerTag({ layer, label, seed = 3, face }: { layer: Layer; label: string; seed?: number; face?: 'mono' | 'serif' | 'serifi' }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const w = tagWidth(layer, label, face);
    const H = 34, pad = 8;
    const sc = new Scene(h, w + 2 * pad, H + 2 * pad, `${LAYERS[layer].name}: ${label}`);
    const g = el('g', {}, sc.svg);
    drawTag(sc, g, pad, pad, w, H, { layer, label, seed, face });
    sc.tl.finish();
    return () => sc.destroy();
  }, [layer, label, seed, face]);
  return <span ref={host} className="layer-tag" />;
}
