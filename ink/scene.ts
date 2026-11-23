// A Scene is one SVG drawing with its timeline. Primitives draw into a Scene.
import { Timeline } from './timeline';
import { el, uid } from './svg';

export class Scene {
  readonly svg: SVGSVGElement;
  readonly defs: SVGDefsElement;
  readonly tl = new Timeline();
  readonly w: number;
  readonly h: number;
  private pencilId?: string;

  constructor(host: HTMLElement, w: number, h: number, label: string) {
    this.w = w;
    this.h = h;
    this.svg = el('svg', { class: 'fig', width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': label }, host);
    this.defs = el('defs', {}, this.svg);
  }

  /** The seeded grain filter that makes pencil lighter and greyer (rulebook 1.1). One per scene. */
  pencilFilter(): string {
    if (!this.pencilId) {
      const id = (this.pencilId = uid('pencil-f'));
      const f = el('filter', { id, filterUnits: 'userSpaceOnUse', x: -20, y: -20, width: this.w + 40, height: this.h + 40 }, this.defs);
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: 1.1, numOctaves: 2, seed: 4, result: 'n' }, f);
      el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.95', result: 'm' }, f);
      el('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' }, f);
    }
    return this.pencilId;
  }

  destroy(): void {
    this.tl.destroy();
    this.svg.remove();
  }
}
