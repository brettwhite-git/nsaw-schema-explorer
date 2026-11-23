// What scenes 0 and 1 share: the building's world, the front-office furniture at world scale, the camera shots, the
// figures' places. Scene 0 ends exactly where scene 1 begins (SC0_END), so the hand-off is the same frame.
import { CAB, drawerAt } from '../objects';
import { FLOORS, SPOT } from '../building';
import type { Camera, EntityDef, Pose, Poses, TextDef } from '../world';

export const z = { building: 1, car: 8, cabinet: 10, drawer: 11, board: 20, card: 30, string: 40, figure: 50, screen: 60 };
export const SC = 0.162;                       // the object kit at front-office size
export const CABINET = { x: 700, y: FLOORS[0] - 518 * SC };

/** camera shots */
export const CAM = {
  wide: { cx: 650, cy: 431, s: 0.9 } as Camera,
  counter: { cx: 930, cy: 190, s: 3.4 } as Camera,
  desk: { cx: 470, cy: 650, s: 4.4 } as Camera,
  cabinet: { cx: 600, cy: 650, s: 3.0 } as Camera,
  cards: { cx: 470, cy: 650, s: 4.0 } as Camera,
  room: { cx: 560, cy: 650, s: 2.0 } as Camera,
  wholeRoom: { cx: 594, cy: 650, s: 1.6 } as Camera,
  shaft: { cx: 400, cy: 640, s: 3.2 } as Camera,
};

export const DRAWERS = [
  { id: 'dOrders', word: 'orders', sys: 'Transactions', cards: ['', 'SO1041', ''] },
  { id: 'dLines', word: 'lines', sys: 'TransactionLine', cards: ['', 'line 2', ''] },
  { id: 'dCust', word: 'customers', sys: 'customer', cards: ['', 'Harbor Supply 88', ''] },
  { id: 'dItems', word: 'items', sys: 'item', cards: ['', 'Pallet jack 12', ''] },
] as const;

export const baseEntities = (): EntityDef[] => [
  { id: 'building', kind: 'building', spec: {}, z: z.building },
  { id: 'car', kind: 'car', spec: {}, z: z.car },
  { id: 'cabinet', kind: 'cabinet', spec: {}, z: z.cabinet },
  ...DRAWERS.map((d, i): EntityDef => ({ id: d.id, kind: 'drawer', spec: { word: d.word, sys: d.sys, cards: d.cards, raised: 1, lift: 0 }, z: z.drawer + [0, 2, 3, 1][i] * 0.1, parent: 'cabinet' })),
  { id: 'board', kind: 'board', spec: {}, z: z.board },
  { id: 'customerF', kind: 'figure', spec: { role: 'customer' }, z: z.figure },
  { id: 'counterF', kind: 'figure', spec: { role: 'counter' }, z: z.figure },
  { id: 'clerk', kind: 'figure', spec: { role: 'clerk' }, z: z.figure },
];

/** which floors are lit (1) and which are at the background weight (0.28) */
export const lit = (...on: number[]): Record<string, number> => Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`f${i}`, on.includes(i) ? 1 : 0.28]));
export const building = (...on: number[]): Pose => ({ x: 0, y: 0, props: lit(...on), strength: 'back' });

/** the cabinet and its four drawers at front-office size; opens = how far each drawer is out (0..1) */
export function cabinet(opens: [number, number, number, number], extra: Partial<Pose> = {}): Poses {
  const base: Pose = { s: SC, ...extra };
  const out: Poses = { cabinet: { ...base, x: CABINET.x, y: CABINET.y } };
  DRAWERS.forEach((d, i) => {
    const [dx, dy] = drawerAt(i), open = opens[i];
    out[d.id] = { ...base, x: CABINET.x + (dx + CAB.pull[0] * open) * SC, y: CABINET.y + (dy + CAB.pull[1] * open) * SC, props: { inner: open, words: 1 } };
  });
  return out;
}
/** the middle of drawer i's front panel, in the world (for a hand to reach) */
export const drawerFront = (i: number, open = 1): [number, number] => {
  const [dx, dy] = drawerAt(i);
  return [CABINET.x + (dx + CAB.pull[0] * open + 16) * SC, CABINET.y + (dy + CAB.pull[1] * open + CAB.ph * 0.15) * SC];
};

export const BALCONY_X = 990;
export const COUNTER_CLERK_X = 850;
/** the last frame of scene 0 = the first frame of scene 1 */
export const SC0_END: Poses = {
  building: building(0),
  customerF: { x: BALCONY_X, y: FLOORS[4] - 8, H: 76, flip: true, fig: 'wait', strength: 'back', op: 0.35 },
  counterF: { x: 846, y: FLOORS[4], H: 76, flip: true, fig: 'pin', strength: 'back', op: 0.35, handsW: [null, [826, FLOORS[4] - 66]] },
  board: { x: SPOT.counter.board.x, y: SPOT.counter.board.y, props: { n0: 1, n1: 1, n2: 1 }, strength: 'back', op: 0.35 },
  clerk: { x: 450, y: FLOORS[0], H: 76, flip: true, fig: 'wait' },
  car: { x: SPOT.car.x, y: FLOORS[0] - 52 },
  ...cabinet([0, 0, 0, 0]),
};
export const SC0_CAMERA: Camera = CAM.desk;
export const SC0_TEXTS: TextDef[] = [];
