// Scene 0, "At the counter". Six clicks (docs/entry-story.md): the building at dusk with a customer walking up; the
// three questions written above the customer; the counter clerk pins three notes; the view travels down to the ground
// floor where a light comes on. Its last frame is scene 1's first frame (SC0_END).
import { FLOORS, SPOT } from '../building';
import { SCENE0_WORDS } from '../../../content/scenes';
import { emptyFurniture, type FurnitureState } from '../shared/furniture';
import { win } from '../shared/stage';
import { QUESTION_WINDOW } from '../shared/stageview';
import { worldScene } from '../shared/worldscene';
import { spring, type BeatWorld, type Poses, type TextDef, type WorldDef } from '../world';
import { BALCONY_X, CAM, SC0_END, baseEntities, building, cabinet, lit } from '../staged/common';

/** one block of timing for the scene (ms) */
export const BEATS0 = [
  { id: 'arrives', name: 'A customer comes to the counter', ms: 3200 },
  { id: 'q1', name: 'The first question', ms: 3600 },
  { id: 'q2', name: 'The second question', ms: 3600 },
  { id: 'q3', name: 'The third question', ms: 3600 },
  { id: 'pins', name: 'The clerk pins up all three', ms: 4200 },
  { id: 'down', name: 'The view travels downstairs', ms: 3400 },
];
const B = BEATS0.reduce<number[]>((a, b, i) => { a.push(i ? a[i - 1] + BEATS0[i - 1].ms : 0); return a; }, []);
export const T0 = { write: [300, QUESTION_WINDOW] as const, pinAt: 2500, pinStagger: 120, pinMove: 800, light: [900, 900] as const };

const N = (id: string, text: string): TextDef => ({ id, kind: 'serif', lines: [text], x: 60, y: 716, size: 26, tone: 'ink2', italic: true });
export const NARRATION0: TextDef[] = [0, 4, 5].map((i) => N(`n0-${i}`, SCENE0_WORDS[i]));

const CY = FLOORS[4];
const dim = (poses: Poses): Poses => Object.fromEntries(Object.entries(poses).map(([k, v]) => [k, { ...v, strength: 'back' as const, op: 0.28 }]));
/** the ground floor's furniture and clerk, at the background weight until the light comes on */
const office = (): Poses => dim({ ...cabinet([0, 0, 0, 0]), clerk: SC0_END.clerk, car: SC0_END.car });
const counter = (customerX: number, fig: string, clerk: Partial<import('../world').Pose> = {}): Poses => ({
  counterF: { x: 850, y: CY, H: 76, flip: false, fig: 'wait', ...clerk },
  customerF: { x: customerX, y: CY - 8, H: 76, flip: true, fig },
});
const noBoard = { board: { x: SPOT.counter.board.x, y: SPOT.counter.board.y, props: { n0: 0, n1: 0, n2: 0 } } };

const stage = (at: number, poses: Poses, texts?: Record<string, { delay?: number; dur?: number }>) => ({ at, poses, texts });
const beats: BeatWorld[] = [
  // 1: the building at dusk; the customer walks up to the window in a few steps
  { poses: { building: building(4), ...office(), ...noBoard, ...counter(1052, 'step1') }, texts: { 'n0-0': { delay: 500, dur: 1000 } }, camera: { ...CAM.wide },
    stages: [
      stage(800, { building: building(4), ...office(), ...noBoard, ...counter(1018, 'step2') }),
      stage(1600, { building: building(4), ...office(), ...noBoard, ...counter(996, 'step1') }),
      stage(2300, { building: building(4), ...office(), ...noBoard, ...counter(BALCONY_X, 'wait') }),
    ] },
  // 2 to 4: close on the counter; the questions are written above the customer (the furniture writes them)
  { poses: { building: building(4), ...office(), ...noBoard, ...counter(BALCONY_X, 'wait') }, texts: {}, camera: { ...CAM.counter } },
  { poses: { building: building(4), ...office(), ...noBoard, ...counter(BALCONY_X, 'wait') }, texts: {} },
  { poses: { building: building(4), ...office(), ...noBoard, ...counter(BALCONY_X, 'wait') }, texts: {} },
  // 5: the counter clerk pins three notes to a board
  { poses: { building: building(4), ...office(), ...noBoard, ...counter(BALCONY_X, 'wait', { x: 846, flip: true, fig: 'pin', handsW: [null, [826, CY - 66]] }) }, texts: { 'n0-4': { delay: 400, dur: 900 } },
    stages: [1, 2, 3].map((n) => stage(500 + n * 600, { building: building(4), ...office(), board: { x: SPOT.counter.board.x, y: SPOT.counter.board.y, props: { n0: n >= 1 ? 1 : 0, n1: n >= 2 ? 1 : 0, n2: n >= 3 ? 1 : 0 } }, ...counter(BALCONY_X, 'wait', { x: 846, flip: true, fig: 'pin', handsW: [null, [826, CY - 66 + (n % 2) * 8]] }) })) },
  // 6: the view travels down the outside of the building to the ground floor; a light comes on
  { poses: {
      ...SC0_END, building: { ...SC0_END.building, delay: T0.light[0], dur: T0.light[1] },
      ...Object.fromEntries(Object.entries({ ...cabinet([0, 0, 0, 0]), clerk: SC0_END.clerk }).map(([k, v]) => [k, { ...v, delay: T0.light[0], dur: T0.light[1] }])),
    },
    texts: { 'n0-5': { delay: 600, dur: 1000 } }, camera: { ...CAM.desk, dur: 1900 } },
];
void lit;
const world: WorldDef = { entities: baseEntities(), texts: NARRATION0, beats, entry: { poses: {}, texts: {}, camera: CAM.wide } };

function furniture(k: number, t: number, lt: number): FurnitureState {
  const f = emptyFurniture();
  f.questions.forEach((q, i) => {
    q.write = k < i + 1 ? 0 : k === i + 1 ? win(lt, [T0.write[0], T0.write[1]]) : 1;
    q.from = 'center'; q.to = 'pinned';
    q.a = k < 4 ? 0 : k === 4 ? spring(win(lt, [T0.pinAt + i * T0.pinStagger, T0.pinMove])) : 1;
  });
  f.locator = { layer: k >= 5 && lt > 1300 ? 0 : 4, draw: 1 };
  f.legend = 1;
  void t;
  return f;
}

const ALT = [
  'The whole building at dusk, quiet. A customer walks up to the counter window with three questions.',
  'Close on the counter. The first question is written above the customer: how do we compare with last year, when last year is in the old system?',
  'The second question is written: why do we each have a different number?',
  'The third question is written: what about the web store and marketing data that isn’t in NetSuite?',
  'The counter clerk pins three notes to a board. They shorten to Last year, Whose number, Other systems, and stay in the corner.',
  'The view travels down the outside of the building to the ground floor. A light comes on in the front office.',
];
const scene0 = worldScene({ id: 'counter', index: 0, name: 'At the counter', layer: 4, beats: BEATS0, world, alt: ALT, furniture });
export default scene0;
export { SC0_END };
