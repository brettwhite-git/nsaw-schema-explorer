// Technique A: SVG + filters. Wobbled edges (feTurbulence + feDisplacementMap), a second offset wash, wet-edge darkening
// (blur-difference), granulation noise, multiply over a parchment made entirely of filters.
import { hex } from './rng';
import { Item, Scene } from './kit';
import { PAPER_RGB } from './paper';

function pig(T: string): string {
  const t = hex(T), c = t.map((v, i) => Math.max(0, Math.min(255, Math.round((1 - (1 - v / PAPER_RGB[i]) / 0.82) * 255))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const pts = (p: number[]): string => { let s = ''; for (let i = 0; i < p.length; i += 2) s += p[i].toFixed(1) + ',' + p[i + 1].toFixed(1) + ' '; return s; };
const lumOf = (c: string): number => { const h = hex(c); return (0.3 * h[0] + 0.59 * h[1] + 0.11 * h[2]) / 255; };
const PL = (0.3 * 240 + 0.59 * 227 + 0.11 * 200) / 255;

function washFilter(id: string, seed: number, disp: number, edge: number, grain: number): string {
  return `<filter id="${id}" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="${seed}" result="n1"/>
  <feDisplacementMap in="SourceGraphic" in2="n1" scale="${disp}" xChannelSelector="R" yChannelSelector="G" result="d1"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="${seed + 5}" result="n2"/>
  <feDisplacementMap in="SourceGraphic" in2="n2" scale="${disp * 1.6}" xChannelSelector="G" yChannelSelector="B" result="d2"/>
  <feComponentTransfer in="d2" result="d2b"><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
  <feMerge result="st"><feMergeNode in="d1"/><feMergeNode in="d2b"/></feMerge>
  <feGaussianBlur in="st" stdDeviation="1.7" result="bl"/>
  <feComposite in="st" in2="bl" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0" result="band"/>
  <feColorMatrix in="band" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0 0.26  0 0 0 ${edge} 0" result="rim"/>
  <feMerge result="m1"><feMergeNode in="st"/><feMergeNode in="rim"/></feMerge>
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed + 9}" result="g"/>
  <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.06  0 0 0 0 0.2  ${grain} 0 0 0 ${-grain * 0.42}" result="gr"/>
  <feComposite in="gr" in2="m1" operator="in" result="grm"/>
  <feMerge><feMergeNode in="m1"/><feMergeNode in="grm"/></feMerge></filter>`;
}

export function buildA(scene: Scene, seed: number): string {
  const { w, h } = scene;
  let defs = `<linearGradient id="skyg" x1="0" y1="0" x2="0" y2="470" gradientUnits="userSpaceOnUse">${scene.skyStops.map(([o, c]) => `<stop offset="${o}" stop-color="${pig(c)}"/>`).join('')}</linearGradient>`;
  defs += washFilter('wcS', seed % 90 + 1, 9, 1.1, 0.5) + washFilter('wcC', seed % 90 + 3, 4, 1.5, 0.9) + washFilter('wcM', seed % 90 + 8, 14, 0.2, 0.3);
  defs += `<filter id="inkf" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="${seed % 50 + 2}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  defs += `<filter id="paper" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="4" seed="${seed % 40 + 1}" result="m"/>
    <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.45  0 0 0 0 0.22  1.1 0 0 0 -0.4" result="mot"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.8 0.12" numOctaves="3" seed="${seed % 40 + 4}" result="fib"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="${seed % 40 + 6}" result="tooth"/>
    <feDiffuseLighting in="tooth" surfaceScale="1.3" diffuseConstant="1" lighting-color="#fff6e0" result="lit"><feDistantLight azimuth="225" elevation="58"/></feDiffuseLighting>
    <feBlend in="SourceGraphic" in2="lit" mode="multiply" result="b1"/>
    <feMerge result="b2"><feMergeNode in="b1"/><feMergeNode in="mot"/></feMerge>
    <feColorMatrix in="fib" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.36  0 0 0 0 0.2  -2 0 0 0 1.05" result="fibc"/>
    <feComposite in="fibc" in2="b2" operator="in" result="fibm"/>
    <feMerge result="pp"><feMergeNode in="b2"/><feMergeNode in="fibm"/></feMerge>
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="${seed % 40 + 9}" result="dn"/>
    <feDisplacementMap in="pp" in2="dn" scale="13" xChannelSelector="R" yChannelSelector="G" result="ragged"/>
    <feGaussianBlur in="ragged" stdDeviation="0.6"/></filter>`;
  defs += `<filter id="vigf" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="${seed % 30 + 2}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="70" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="22"/></filter>
    <mask id="vig"><rect x="0" y="0" width="${w}" height="${h}" fill="#000"/><rect x="40" y="40" width="${w - 80}" height="${h - 80}" fill="#fff" filter="url(#vigf)"/></mask>`;

  const groups = new Map<number, Item[]>();
  for (const it of scene.items) { if (!groups.has(it.lay)) groups.set(it.lay, []); groups.get(it.lay)!.push(it); }
  let body = '';
  for (const [, items] of groups) {
    let wash = '', glaze = '', ink = '', sky = false;
    for (const it of items) {
      if (it.k === 'poly') {
        const lift = lumOf(it.fill) > PL * 0.97 && it.mat !== 'glaze';
        const fill = it.grad ? 'url(#skyg)' : lift ? '#fff' : pig(it.fill);
        const op = (it.alpha ?? 1) * (it.load ?? 1) * (it.grad || lift ? 1 : 0.86);
        const el = `<polygon points="${pts(it.pts)}" fill="${fill}" fill-opacity="${op.toFixed(2)}"/>`;
        if (it.mat === 'glaze' || it.mat === 'mist') glaze += el; else wash += el;
        if (it.mat === 'sky') sky = true;
        if (it.ink) ink += `<polygon points="${pts(it.pts)}" fill="none" stroke="${pig('#3A2A3C')}" stroke-opacity="${it.ink > 1 ? 0.8 : 0.6}" stroke-width="${0.6 + it.ink * 0.3}" stroke-linejoin="round"/>`;
      } else {
        const lift = lumOf(it.col) > PL * 0.93;
        ink += `<polyline points="${pts(it.pts)}" fill="none" stroke="${lift ? '#fff' : pig(it.col)}" stroke-opacity="${it.a}" stroke-width="${it.w}" stroke-linecap="round"/>`;
      }
    }
    const mist = items.some((i) => i.k === 'poly' && i.mat === 'mist');
    if (wash) body += `<g filter="url(#${sky ? 'wcM' : 'wcC'})">${wash}</g>`;
    if (glaze) body += `<g filter="url(#${mist ? 'wcM' : 'wcS'})" style="mix-blend-mode:multiply">${glaze}</g>`;
    if (ink) body += `<g filter="url(#inkf)">${ink}</g>`;
  }
  return `<svg class="a" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>
  <rect width="${w}" height="${h}" fill="#F0E3C8" filter="url(#paper)"/>
  <g mask="url(#vig)" style="mix-blend-mode:multiply">${body}</g></svg>`;
}
