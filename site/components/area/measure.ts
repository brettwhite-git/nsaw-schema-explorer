// Text measuring for the area figures (same faces as styles/explorer/area.css), plus a width hook.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const FONT = {
  ui13: '400 13px "Source Sans 3 Variable"',
  ui12: '400 12px "Source Sans 3 Variable"',
  ui105: '400 10.5px "Source Sans 3 Variable"',
  mono12: '400 12px "JetBrains Mono Variable"',
  it12: 'italic 400 12.5px "Source Serif 4 Variable"',
};

let ctx: CanvasRenderingContext2D | null = null;
export function measure(s: string, font: string): number {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return s.length * 7;
  ctx.font = font;
  return ctx.measureText(s).width;
}

/** The string, cut with "…" so it fits `w` pixels. */
export function fit(s: string, font: string, w: number): string {
  if (measure(s, font) <= w) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(s.slice(0, mid) + '…', font) <= w) lo = mid; else hi = mid - 1; }
  return s.slice(0, lo) + '…';
}

export const r1 = (n: number): number => Math.round(n * 10) / 10;

/** The content width of an element (0 until measured), and true once the web fonts have loaded. */
export function useWidth<T extends HTMLElement>(): [{ current: T | null }, number, boolean] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  const [fonts, setFonts] = useState(() => typeof document === 'undefined' || document.fonts?.status === 'loaded');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.floor(el.clientWidth));
    const ro = new ResizeObserver(() => setW(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => { if (live) setFonts(true); });
    return () => { live = false; };
  }, []);
  return [ref, w, fonts];
}
