// The figure's own CSS, injected once. Colours are the site's CSS variables (never captured, so a theme
// toggle needs no rebuild). Shared drawing classes (.ink .paper .thread .knot .reveal .hit .hole .dot)
// come from styles/drawn.css.
export const STYLE_ID = 'oljf-style';
export const CSS = `
.oljf { overflow: visible; }
.oljf text { pointer-events: none; }
.oljf .ot { fill: var(--ink); transition: fill var(--dur-hover) ease; }
.oljf .ot.mono { font-family: var(--mono); }
.oljf .ot.serif { font-family: var(--serif); }
.oljf .ot.serifi { font-family: var(--serif); font-style: italic; }
.oljf .ot.muted { fill: var(--ink-2); }
.oljf .ot.tg { font-weight: 500; letter-spacing: 0.12em; }
.oljf .ot.hd { letter-spacing: 0; }
.oljf .ot.co { fill: var(--ink-2); }
.oljf .cap { font: 400 10.5px var(--mono); letter-spacing: 0.02em; fill: var(--ink-2); }
.oljf .ink, .oljf .thread, .oljf .knot, .oljf .hole { transition: stroke var(--dur-hover) ease, fill var(--dur-hover) ease, stroke-opacity var(--dur-hover) ease; }
.oljf .ink.on, .oljf .thread.on, .oljf .hole.on { stroke: var(--accent); }
.oljf .thread.on { stroke-opacity: var(--thread-focus-opacity); }
.oljf .ot.on, .oljf .co.on { fill: var(--accent); }
.oljf .knot.on { fill: var(--accent); fill-opacity: 0.9; }
.oljf .knot.solid { fill-opacity: 0.85; }
.oljf .ink.lead { stroke: var(--ink-2); }
.oljf .knot.lead { fill: var(--ink-2); fill-opacity: 0.8; }
.oljf .rowhl { fill: none; stroke: var(--accent); stroke-width: 0.8; opacity: 0; transition: opacity var(--dur-hover) ease; pointer-events: none; }
.oljf .rowhl.on { opacity: 1; }
.oljf .tag .h, .oljf .pill .h { stroke-opacity: 0.6; }
.oljf .el { transition: opacity var(--dur-hover) ease; }
.oljf .el.dim { opacity: 0.3; }
.oljf .el.gone { opacity: 0; pointer-events: none; }
.oljf .ink.faint { stroke-opacity: 0.6; }
.oljf [data-ref] { cursor: pointer; outline: none; }
.oljf [data-ref]:focus-visible .outline { stroke-width: 2.4; }
.oljf [data-ref]:focus-visible .focus-ring { opacity: 1; }
.oljf .focus-ring { fill: none; stroke: var(--ink); stroke-width: 1.4; stroke-dasharray: 3 3; opacity: 0; pointer-events: none; }
.oljf .tip rect { fill: var(--paper); stroke: var(--edge); stroke-width: 0.8; }
.oljf .tip text { font: 400 10.5px var(--mono); fill: var(--ink); }
.oljf .tip { pointer-events: none; opacity: 0; transition: opacity var(--dur-hover) ease; }
.oljf .tip.show { opacity: 1; }
.oljf .rec .ink.pencil, .oljf .form .ink.pencil { stroke-width: 1.2; }
@media (prefers-reduced-motion: reduce) {
  .oljf .ink, .oljf .thread, .oljf .knot, .oljf .ot, .oljf .el, .oljf .tip, .oljf .rowhl { transition: none; }
}
/* reduced motion asked for by the page (?reduced=1) or the OS: no transition at all */
.oljf.rm *, html.is-reduced .oljf * { transition: none !important; }
`;

let users = 0;
export function useStyle(): () => void {
  users += 1;
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  return () => {
    users -= 1;
    if (users <= 0) document.getElementById(STYLE_ID)?.remove();
  };
}
