// The entry piece's scenes, in order. Scenes 2 to 6 are not built yet (sheets: docs/entry-story.md).
import type { AnyScene } from './contract';
import scene0 from './scene0';
import scene1 from './netsuite';

export const SCENES: AnyScene[] = [scene0, scene1];
export { Sequence } from './sequence';
export { PlayerCore } from './player';
