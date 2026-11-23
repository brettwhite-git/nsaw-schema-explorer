// Builds a SceneSpec from a world table (world/index.ts): the scene is a pure function of progress, as the contract asks.
import type { SceneSpec } from '../contract';
import { evalWorld, screenRect, type Camera, type Rect, type WorldDef, type WorldState } from '../world';
import { WorldView } from '../world/view';
import { makeBeats, type Beat, type BeatDef } from './beats';
import type { FurnitureState } from './furniture';
import type { Box, Stage } from './stage';
import { el } from '../../../ink/svg';
import type { Names } from '../order/data';

export interface LW { def: WorldDef; beats: Beat[]; total: number; stage: Stage }
export interface SW { p: number; t: number; beat: number; world: WorldState; furniture: FurnitureState; alt: string }

export interface WorldSceneOpts {
  id: string; index: number; name: string; layer: number;
  beats: BeatDef[]; world: WorldDef; alt: string[];
  furniture(k: number, t: number, lt: number): FurnitureState;
}

/** estimated box of a text (design units) */
export function textBox(def: { lines: string[]; x: number; y: number; size: number; anchor?: string; kind: string }): Rect {
  const w = Math.max(...def.lines.map((l) => l.length)) * def.size * (def.kind === 'hand' ? 0.38 : 0.5);
  const x = def.anchor === 'middle' ? def.x - w / 2 : def.anchor === 'end' ? def.x - w : def.x;
  const top = def.kind === 'hand' ? def.y : def.y - def.size * 0.9;
  return { x, y: top, w, h: def.size * 1.22 * def.lines.length };
}
/** the box of an entity on the screen (world things go through the camera) */
export const onScreen = (e: { rect: Rect; space: 'world' | 'screen' }, cam: Camera): Rect => (e.space === 'world' ? screenRect(e.rect, cam) : e.rect);

export function worldScene(o: WorldSceneOpts): SceneSpec<LW, SW> & { world: WorldDef; opts: WorldSceneOpts } {
  const { beats, total } = makeBeats(o.beats);
  return {
    id: o.id, index: o.index, name: o.name, layer: o.layer, beats, duration: total, world: o.world, opts: o,
    layout: (stage: Stage): LW => ({ def: o.world, beats, total, stage }),
    at(L: LW, p: number): SW {
      const t = Math.min(1, Math.max(0, p)) * total;
      const world = evalWorld(L.def, L.beats, t);
      const k = world.beat;
      return { p, t, beat: k, world, furniture: o.furniture(k, t, t - beats[k].startMs), alt: o.alt[k] ?? '' };
    },
    furniture: (_L: LW, s: SW) => s.furniture,
    boxes(L: LW, s: SW): Box[] {
      const out: Box[] = [];
      for (const e of s.world.entities) if (e.kind !== 'string' && e.kind !== 'building' && e.op > 0.5 && e.draw > 0.5) out.push({ id: e.id, kind: e.kind, rect: onScreen(e, s.world.camera) });
      for (const t of s.world.texts) {
        const d = L.def.texts.find((x) => x.id === t.id)!;
        if (t.op > 0.5) out.push({ id: t.id, kind: d.kind === 'hand' ? 'note' : 'text', rect: textBox(d) });
      }
      return out;
    },
    alt: (s: SW) => s.alt,
    create(view, L: LW, _names: Names) {
      const defs = el('defs', {}, view.sceneG);
      const wv = new WorldView(view.sceneG, defs, view.sceneHtml, view.m, L.def);
      return { apply: (s: SW) => wv.apply(s.world), destroy: () => wv.destroy() };
    },
  };
}
