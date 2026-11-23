// The figure's own CSS, injected once. Colours are the site's CSS variables (never captured). Stroke weights stay in
// screen pixels at any camera scale: the world group sets --k = 1 / scale and every stroke multiplies it in.
export const STYLE_ID = 'section-style';
export const CSS = `
.sec-stage { display: block; width: 100%; position: relative; outline: none; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
.sec-stage:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
svg.sec { display: block; overflow: hidden; max-width: none; color: var(--ink); }
.sec .ink { fill: none; stroke: currentColor; stroke-width: calc(var(--w, 1.1) * var(--k, 1) * 1px); stroke-linecap: round; stroke-linejoin: round; }
.sec .ink.pencil { stroke: var(--pencil); }
.sec .ink.amber { stroke: var(--accent); }
.sec .ink.pencil.amber { stroke-opacity: 0.85; }
.sec.hov .ink.amber { stroke: var(--ink); stroke-opacity: 0.55; }
.sec .pf { fill: var(--paper-2); stroke: none; }
.sec .pf.plate { fill: var(--paper-2); }
.sec .thread { fill: none; stroke: var(--ink); stroke-opacity: 0.55; stroke-width: calc(1.2px * var(--k, 1)); stroke-dasharray: calc(4.5px * var(--k, 1)) calc(5px * var(--k, 1)); stroke-linecap: round; }
.sec .reveal { stroke-width: 8; }
.sec .knot { fill: var(--ink); fill-opacity: 0.5; r: calc(2.6px * var(--k, 1)); }
.sec .knot.amber-k { fill: var(--accent); fill-opacity: 1; r: calc(3.2px * var(--k, 1)); }
.sec.hov .knot.amber-k { fill: var(--ink); fill-opacity: 0.55; }
.sec .band.lit .frame { stroke: var(--accent); }
.sec .fld { stroke-opacity: 0.5; }
.sec .pf.clearing { fill: var(--paper-2); }
.sec .fld-dots { fill: none; stroke: currentColor; stroke-width: calc(1.3px * var(--k, 1)); stroke-linecap: round; stroke-opacity: 0.7; }
.sec .rm-r { fill: var(--paper-2); stroke: var(--pencil); stroke-width: calc(1px * var(--k, 1)); }
.sec .rm-l { fill: none; stroke: var(--pencil); stroke-width: calc(1px * var(--k, 1)); }
.sec .wt, .sec .ws, .sec .wi, .sec .wh, .sec .wsm { fill: var(--ink); paint-order: stroke; stroke: var(--paper-2); stroke-width: calc(3px * var(--k, 1)); stroke-linejoin: round; pointer-events: none; }
.sec .wt { font: 500 12.5px var(--mono); }
.sec .ws { font: 400 12.5px var(--serif); }
.sec .wi { font: italic 400 15px var(--serif); fill: var(--ink-2); }
.sec .wh { font: 700 24px var(--serif); letter-spacing: -0.01em; }
.sec .wm { fill: var(--ink-2); font-weight: 400; }
.sec .wa { fill: var(--accent); stroke: none; }
.sec.hov .wa { fill: var(--ink); }
.sec .wsm { font: italic 400 10px var(--serif); letter-spacing: 0; text-transform: none; fill: var(--ink-2); }
.sec .wn { font: 700 22px var(--serif); fill: var(--ink); paint-order: stroke; stroke: var(--paper-2); stroke-width: calc(4px * var(--k, 1)); stroke-linejoin: round; pointer-events: none; visibility: hidden; }
.sec.lod-names .wn { visibility: visible; }
.sec.closing .chip { visibility: hidden; }
.sec:not(.lod-text) .wt, .sec:not(.lod-text) .ws, .sec:not(.lod-text) .wi { visibility: hidden; }
.sec:not(.lod-small) .wsm { visibility: hidden; }
.sec .co, .sec .nums { opacity: 0; pointer-events: none; transition: opacity var(--dur-text, 320ms) var(--ease-text, ease); }
.sec .co.on, .sec .nums.on { opacity: 1; }
.sec .co-l { fill: none; stroke: var(--ink-2); stroke-width: 0.7; stroke-opacity: 0.8; }
.sec .co-b circle { fill: var(--paper); stroke: var(--ink); stroke-width: 1; }
.sec .co-n { font: 500 11px var(--mono); fill: var(--ink); }
.sec .co-t text { font: 400 15px var(--serif); fill: var(--ink); }
.sec .nm-a { font: 700 15px var(--serif); fill: var(--ink); }
.sec .nm-c { font: 400 13px var(--serif); fill: var(--ink); }
.sec .nm-b { font: 400 10.5px var(--mono); fill: var(--ink-2); }
.sec-tip { position: absolute; left: 0; top: 0; max-width: 270px; padding: 6px 9px; background: var(--paper-2); border: 1px solid var(--edge); opacity: 0; pointer-events: none; transition: opacity var(--dur-hover, 160ms) ease; z-index: 3; }
.sec-tip.show { opacity: 1; }
.sec-tip-n { font: 500 11px/1.35 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
.sec-tip-k { font: 400 10.5px/1.45 var(--mono); color: var(--ink-2); }
.sec-tip-p { margin-top: 2px; font: italic 400 12px/1.35 var(--serif); color: var(--ink-2); }
.sec-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .sec .co, .sec .nums, .sec-tip { transition: none; } }
html.is-reduced .sec .co, html.is-reduced .sec .nums { transition: none; }
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
