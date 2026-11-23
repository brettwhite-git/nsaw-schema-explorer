// Tiny SVG helpers shared by every drawing primitive. No framework.
export const SVG_NS = 'http://www.w3.org/2000/svg';

export type Attrs = Record<string, string | number>;

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

let counter = 0;
/** Document-unique id fragment for masks, clips and filters. */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}

/** mulberry32: small seeded PRNG. Same seed, same drawing. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const f1 = (n: number): string => n.toFixed(1);
