// The figure contract (ported from the ink-and-thread figure template).
// A figure is plain TypeScript that draws into an element. React only wraps it (FigureFrame).
import type { AtlasRef } from '../content/types';
import type { Ontology } from '../ontology/load';

export interface FigureOpts {
  /** which state of the figure to show (chapter step -> figureStep) */
  step: number;
  /** finished drawing at once, interactions kept, zero animations */
  reducedMotion: boolean;
  ontology?: Ontology;
  /** extra figure-specific inputs, e.g. { subjectArea: 'NetSuite - Sales Order' } */
  props?: Record<string, unknown>;
  /** build the finished drawing at once (used when a figure is rebuilt on resize) */
  finished?: boolean;
  /** called when a tag is activated; the frame wires this to the router */
  onOpen?: (ref: AtlasRef) => void;
}

export interface FigureHandle {
  setStep(n: number): void;
  /** scroll-driven drawing: 0 = nothing drawn, 1 = finished */
  setProgress?(p: number): void;
  /** off-screen: halt any running animation; false resumes it */
  setFrozen?(frozen: boolean): void;
  /** draw from nothing again (the first reveal uses this too) */
  replay(): void;
  destroy(): void;
}

export interface Figure {
  /** mount builds the drawing UNDRAWN (finished when reducedMotion or opts.finished); replay() draws it in */
  mount(el: HTMLElement, opts: FigureOpts): FigureHandle;
}

/** Events a figure dispatches on its element (bubbling). */
export interface FigureFocusDetail { x: number; y: number; label: string }
export type FigureFocusEvent = CustomEvent<FigureFocusDetail | null>;
export type FigureStrokeEvent = CustomEvent<{ label?: string }>;

export function emitFocus(el: HTMLElement, detail: FigureFocusDetail | null): void {
  el.dispatchEvent(new CustomEvent('figure:focus', { detail, bubbles: true }));
}
export function emitStroke(el: HTMLElement, label?: string): void {
  el.dispatchEvent(new CustomEvent('figure:stroke', { detail: { label }, bubbles: true }));
}

/** Registry: key -> lazy loader. Figures are code-split; the chapter names one by key. */
type Loader = () => Promise<{ default: Figure }>;
const registry = new Map<string, Loader>();

export function registerFigure(key: string, loader: Loader): void { registry.set(key, loader); }
export function hasFigure(key: string): boolean { return registry.has(key); }
export function figureKeys(): string[] { return [...registry.keys()]; }
export async function loadFigure(key: string): Promise<Figure | undefined> {
  const l = registry.get(key);
  return l ? (await l()).default : undefined;
}
