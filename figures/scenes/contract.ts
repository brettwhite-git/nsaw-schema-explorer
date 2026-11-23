// The scene contract (v2). The entry piece is presented LIVE: a scene is a list of BEATS, each ending on a finished
// frame; the player (player.ts) steps from finished frame to finished frame. A scene is still a pure function of its
// progress 0..1 (the beats are contiguous windows of it), so scroll, time and clicks all drive the same drawing.
//
// A scene supplies PURE parts (tested without a DOM) and one DOM part:
//   layout(stage, names)   all geometry, from the stage size (a landscape and a portrait composition)
//   at(layout, p, names)   the scene's whole state at progress p
//   furniture(layout, s)   the shared furniture's state at that moment (pinned questions, ledger, locator, legend)
//   boxes(layout, s)       every visible element's box, for the tests (stay in the stage, never touch the furniture)
//   create(view, layout)   builds the scene's elements into the shared stage view; apply(state) draws a state
import type { FurnitureState } from './shared/furniture';
import type { StageView } from './shared/stageview';
import type { Beat } from './shared/beats';
import type { Box, Stage } from './shared/stage';
import type { Names } from './order/data';

export interface SceneSpec<L = unknown, S = unknown> {
  id: string;
  index: number;
  name: string;
  /** which layer of the five the locator marks while this scene is on */
  layer: number;
  beats: Beat[];
  /** the scene played straight through, ms */
  duration: number;
  layout(stage: Stage, names: Names): L;
  at(L: L, p: number, names: Names): S;
  furniture(L: L, s: S): FurnitureState;
  boxes(L: L, s: S): Box[];
  alt(s: S): string;
  create(view: StageView, L: L, names: Names): { apply(s: S): void; destroy(): void };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScene = SceneSpec<any, any>;
