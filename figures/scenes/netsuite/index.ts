// Scene 1, "The front office". Ten clicks (docs/entry-story.md). The clerk does each thing: the form lands, the clerk
// tears it, files the cards, the slips and strings, the rename, then the calendar, the tapes and the parcels own the
// frame, the room is wide and tidy with the ledger's first line, and a copy of the amber card goes up the dumbwaiter.
import { SCENE1_WORDS } from '../../../content/scenes';
import { CAB, TAPE, drawerAt } from '../objects';
import { FLOORS, SPOT } from '../building';
import { emptyFurniture, type FurnitureState } from '../shared/furniture';
import { win } from '../shared/stage';
import { worldScene } from '../shared/worldscene';
import { spring, type BeatWorld, type EntityDef, type Pose, type Poses, type Stage, type TextDef, type WorldDef } from '../world';
import { CAM, DRAWERS, SC, SC0_END, CABINET, baseEntities, building, cabinet, drawerFront, z } from '../staged/common';

/** one block of timing for the scene (ms per click) */
export const BEATS1 = [
  { id: 'arrives', name: 'An order arrives', ms: 3400 },
  { id: 'tears', name: 'The clerk tears it into cards', ms: 3200 },
  { id: 'files', name: 'Each card goes in its own drawer', ms: 6200 },
  { id: 'slips', name: 'Every card carries a note', ms: 5000 },
  { id: 'rename', name: 'The clerk changes one card', ms: 4600 },
  { id: 'time', name: 'Question: last year', ms: 3800 },
  { id: 'people', name: 'Question: whose number', ms: 4400 },
  { id: 'systems', name: 'Question: other systems', ms: 3800 },
  { id: 'ledger', name: 'The room keeps today’s business running', ms: 4400 },
  { id: 'lift', name: 'A copy goes upstairs', ms: 5200 },
];
export const [K_ARRIVES, K_TEARS, K_FILES, K_SLIPS, K_RENAME, K_TIME, K_PEOPLE, K_SYSTEMS, K_LEDGER, K_LIFT] = BEATS1.map((_, i) => i);
const Q_BEATS = [K_TIME, K_PEOPLE, K_SYSTEMS];
export const Q_IN = 300, Q_IN_MS = 800, Q_OUT_MS = 600;
const F0 = FLOORS[0];

/* ---------------------------------------------------------------- the words (lines of the sheet's sentences) */
const LINES: string[][] = [
  [SCENE1_WORDS[0]],
  ['The clerk tears it into cards:', 'one for the order, one for each line.'],
  [SCENE1_WORDS[2]],
  ['Every card carries a note', 'saying where to find the others.'],
  ['When a customer changes their name,', 'the clerk changes one card.'],
  ['The cabinet was installed in January 2024.', 'Older orders live in the old system.'],
  ['Three people measure the same order', 'and read three numbers.'],
  ['Parcels arrive from the web store,', 'marketing and the old system.', 'The office has no drawer for them.'],
  [SCENE1_WORDS[8]],
  [SCENE1_WORDS[9]],
];
const narr = (i: number): TextDef => ({ id: `n1-${i}`, kind: 'serif', lines: LINES[i], x: 60, y: 716 - (LINES[i].length - 1) * 31.7, size: 26, tone: 'ink2', italic: true });
const texts: TextDef[] = LINES.map((_, i) => narr(i));
const tx = (i: number, delay = 500, dur = 1000): Record<string, { delay: number; dur: number }> => ({ [`n1-${i}`]: { delay, dur } });

/* ---------------------------------------------------------------------------------------------------- entities */
const U = (id: string, kind: EntityDef['kind'], spec: Record<string, unknown>, zz: number, space: 'world' | 'screen' = 'world'): EntityDef => ({ id, kind, spec, z: zz, space });
export const TAPES = [
  { id: 'tapeOrdered', word: 'ordered', stop: 1550.5, reading: '1,550.50', why: 'both lines placed', y: 330 },
  { id: 'tapeShipped', word: 'shipped', stop: 1240, reading: '1,240.00', why: 'only line 1 has shipped', y: 430 },
  { id: 'tapeInvoiced', word: 'invoiced', stop: 620, reading: '620.00', why: 'half of line 1 billed', y: 530 },
] as const;
export const PARCELS = [
  { id: 'parcelWeb', word: 'web store', x: 60 }, { id: 'parcelAnalytics', word: 'web analytics', x: 250 },
  { id: 'parcelMarketing', word: 'marketing', x: 440 }, { id: 'parcelOld', word: 'the old system', x: 630 },
] as const;
const entities: EntityDef[] = [
  ...baseEntities(),
  U('form', 'form', {}, z.card), U('orderCard', 'orderCard', {}, z.card + 1), U('line1', 'lineCard', { n: 1 }, z.card + 2), U('line2', 'lineCard', { n: 2 }, z.card + 3),
  U('customer', 'customerCard', {}, z.card + 4), U('item', 'itemCard', {}, z.card + 5), U('slipL', 'slip', { a: 'Order:', b: 'see card SO1041' }, z.card + 6),
  U('copy', 'lineCard', { n: 1 }, z.card + 7),
  { id: 'sOrder', kind: 'string', spec: {}, z: z.string }, { id: 'sCust', kind: 'string', spec: {}, z: z.string }, { id: 'sItem', kind: 'string', spec: {}, z: z.string },
  U('veil', 'veil', {}, z.screen - 1, 'screen'),
  U('calendar', 'calendar', {}, z.screen, 'screen'),
  U('barLine1', 'barSlip', { n: 1 }, z.screen + 1, 'screen'), U('barLine2', 'barSlip', { n: 2 }, z.screen + 1, 'screen'),
  ...TAPES.map((t) => U(t.id, 'tape', { word: t.word, stop: t.stop, reading: t.reading, why: t.why }, z.screen + 2, 'screen')),
  ...TAPES.map((t): EntityDef => ({ id: `plumb-${t.id}`, kind: 'string', spec: {}, z: z.screen, space: 'screen' })),
  ...PARCELS.map((p) => U(p.id, 'parcel', { word: p.word, sub: 'not in NetSuite' }, z.screen + 2, 'screen')),
  { id: 'floor', kind: 'string', spec: {}, z: z.screen, space: 'screen' },
];

/* ------------------------------------------------------------------------------------------------ pose helpers */
const clerk = (x: number, fig: string, extra: Partial<Pose> = {}): Pose => ({ x, y: F0, H: 76, flip: true, fig, ...extra });
const back = (p: Poses): Poses => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, strength: 'back' as const, op: 0.35 }]));
const room = (opens: [number, number, number, number] = [0, 0, 0, 0]): Poses => ({ building: building(0), car: { x: SPOT.car.x, y: F0 - 52, strength: 'back' }, ...cabinet(opens) });
const st = (at: number, poses: Poses, extra: Partial<Stage> = {}): Stage => ({ at, poses, ...extra });

/** where a card sits (world): desk, in a drawer, laid out for the slips */
const DESK = { form: [382, 606], order: [342, 606], line1: [396, 626], line2: [396, 646], customer: [344, 656], item: [370, 656] } as const;
const CHAIN = { line1: [342, 636], slip: [346, 656], order: [414, 618], customer: [498, 636], item: [342, 672] } as const;
const sprite = (pos: readonly number[], s: number, extra: Partial<Pose> = {}): Pose => ({ x: pos[0], y: pos[1], s, ...extra });
const inDrawer = (i: number): Pose => { const [x, y] = drawerFront(i, 1); return { x: x - 8, y: y - 4, s: 0.05, op: 0 }; };
const NOTES = { label: 1 };

/* ------------------------------------------------------------------------------------------------------ beats */
const deskCards = (o: Partial<Record<'order' | 'line1' | 'line2' | 'customer' | 'item', Pose>> = {}): Poses => ({
  orderCard: sprite(DESK.order, 0.11, { props: { ...NOTES }, ...o.order }),
  line1: sprite(DESK.line1, 0.11, { props: { sys: 1 }, ...o.line1 }),
  line2: sprite(DESK.line2, 0.11, { props: { sys: 1 }, ...o.line2 }),
  ...(o.customer ? { customer: o.customer } : {}), ...(o.item ? { item: o.item } : {}),
});
const beats: BeatWorld[] = [];
const B = (b: BeatWorld): void => { beats.push(b); };

// 1 an order arrives: the form lands on the desk; line 1 turns amber
B({
  poses: { ...room(), clerk: clerk(450, 'wait'), form: { x: DESK.form[0], y: 520, s: 0.11, dur: 1, props: { amber1: 0 } } }, texts: tx(0, 900),
  stages: [
    st(200, { ...room(), clerk: clerk(450, 'wait'), form: { x: DESK.form[0], y: DESK.form[1], s: 0.11, dur: 900, props: { amber1: 0 } } }),
    st(1500, { ...room(), clerk: clerk(450, 'receive', { dur: 900 }), form: { x: DESK.form[0], y: DESK.form[1], s: 0.11, props: { amber1: 1 }, dur: 900 } }),
  ],
});
// 2 the clerk tears the form along its perforations into cards
const tearHands = (a: [number, number], b: [number, number]): Pose['handsW'] => [a, b];
B({
  poses: { ...room(), clerk: clerk(450, 'tear', { handsW: tearHands([432, 640], [432, 626]) }), form: { x: DESK.form[0], y: DESK.form[1], s: 0.11, op: 0, props: { amber1: 1 }, dur: 300 }, ...deskCards({ order: { x: DESK.form[0], y: DESK.form[1], s: 0.11, sep: 0, props: { ...NOTES, label: 0 } }, line1: { x: DESK.form[0], y: DESK.form[1] + 33, s: 0.11, sep: 0, props: { sys: 0 } }, line2: { x: DESK.form[0], y: DESK.form[1] + 45, s: 0.11, sep: 0, props: { sys: 0 } } }) }, texts: tx(1, 400),
  stages: [st(900, { ...room(), clerk: clerk(450, 'tear', { handsW: tearHands([432, 650], [432, 626]) }), form: { x: DESK.form[0], y: DESK.form[1], s: 0.11, op: 0, props: { amber1: 1 } }, ...deskCards({ order: { x: DESK.order[0], y: DESK.order[1], s: 0.11, rot: -2.5, props: { label: 1 } }, line1: { x: DESK.line1[0], y: DESK.line1[1], s: 0.11, rot: 2, props: { sys: 1 } }, line2: { x: DESK.line2[0], y: DESK.line2[1], s: 0.11, rot: -1.5, props: { sys: 1 } } }) })],
});
// 3 the clerk files each card; the drawers open: orders, lines, customers, items
const filed = (cards: Partial<Record<string, Pose>>): Poses => ({ ...(cards as Poses) });
const hide = (i: number): Pose => ({ ...inDrawer(i) });
const fileHands = (i: number): Pose['handsW'] => { const [x, y] = drawerFront(i, 1); return i >= 2 ? [null, [x - 1, y]] : [[x - 6, y + 4], [x - 1, y]]; };
const FIGS = ['file', 'file', 'bend', 'crouch'], FX = [676, 676, 680, 686];
const files = (open: [number, number, number, number], who: number, cards: Poses, at?: number): Stage => ({ at: at ?? 0, poses: { ...room(open), clerk: { x: FX[who], y: F0, H: 76, flip: false, fig: FIGS[who], handsW: fileHands(who), dur: 700 }, ...cards } });
const resting = (extra: Poses = {}): Poses => ({ ...deskCards({ order: { x: DESK.order[0], y: DESK.order[1], s: 0.11, rot: -2.5 }, line1: { x: DESK.line1[0], y: DESK.line1[1], s: 0.11, rot: 2 }, line2: { x: DESK.line2[0], y: DESK.line2[1], s: 0.11, rot: -1.5 }, customer: { x: DESK.customer[0], y: DESK.customer[1], s: 0.11, props: { label: 1 } }, item: { x: DESK.item[0], y: DESK.item[1], s: 0.1, props: { label: 1 } } }), ...extra });
B({
  poses: { ...room(), clerk: clerk(450, 'tear', { handsW: tearHands([432, 650], [432, 626]) }), ...resting({ customer: { ...sprite(DESK.customer, 0.11, { props: { label: 1 }, draw: 0, op: 1 }) } as Pose, item: sprite(DESK.item, 0.1, { props: { label: 1 }, draw: 0 }) }) },
  texts: tx(2, 400), camera: { ...CAM.desk, cx: 520, s: 3.0, dur: 900 },
  stages: [
    st(300, { ...room(), clerk: { x: 676, y: F0, H: 76, flip: false, fig: 'file', handsW: fileHands(0), dur: 800 }, ...resting() }, { camera: { cx: 640, cy: 650, s: 4.0, delay: 300, dur: 1100 } }),
    files([1, 0, 0, 0], 0, { ...resting({ orderCard: { ...hide(0), props: { label: 1 } } }) }, 1500),
    files([0, 1, 0, 0], 1, { ...resting({ orderCard: { ...hide(0), props: { label: 1 } }, line1: { ...hide(1), props: { sys: 1 } }, line2: { ...hide(1), props: { sys: 1 } } }) }, 2600),
    files([0, 0, 1, 0], 2, { ...resting({ orderCard: { ...hide(0), props: { label: 1 } }, line1: { ...hide(1), props: { sys: 1 } }, line2: { ...hide(1), props: { sys: 1 } }, customer: { ...hide(2), props: { label: 1 } } }) }, 3700),
    files([0, 0, 0, 1], 3, { ...resting({ orderCard: { ...hide(0), props: { label: 1 } }, line1: { ...hide(1), props: { sys: 1 } }, line2: { ...hide(1), props: { sys: 1 } }, customer: { ...hide(2), props: { label: 1 } }, item: { ...hide(3), props: { label: 1 } } }) }, 4700),
    files([0, 0, 0, 0], 3, { ...resting({ orderCard: { ...hide(0), props: { label: 1 } }, line1: { ...hide(1), props: { sys: 1 } }, line2: { ...hide(1), props: { sys: 1 } }, customer: { ...hide(2), props: { label: 1 } }, item: { ...hide(3), props: { label: 1 } } }) }, 5500),
  ].map((s, i) => (i >= 2 ? { ...s, poses: { ...s.poses } } : s)),
});
void filed; void DRAWERS; void CAB; void drawerAt; void TAPE;
// helper for the clicks that follow: the card chain on the wall, the clerk behind
const chainCards = (nameNow: number, oldGone = nameNow, strike = 0, hl = 0): Poses => ({
  line1: sprite(CHAIN.line1, 0.16, { props: { sys: 1 } }),
  orderCard: sprite(CHAIN.order, 0.16, { props: { label: 1, slipC: 1, eyeNum: 1, nameNow, oldGone, strike, hl } }),
  customer: sprite(CHAIN.customer, 0.16, { props: { label: 1, nameNow, oldGone, strike, hl } }),
  item: sprite(CHAIN.item, 0.14, { strength: 'back', op: 0.6, props: { label: 1 } }),
});
const slipPose: Pose = { x: CHAIN.slip[0], y: CHAIN.slip[1], s: 0.16 };
const strings = (n: number): Poses => ({
  ...(n >= 1 ? { sOrder: { a: 'slipL.eye', b: 'orderCard.num', sag: 6, style: 'string' as const, dur: 800 } } : {}),
  ...(n >= 2 ? { sCust: { a: 'orderCard.slipC', b: 'customer.eye', sag: 4, style: 'string' as const, dur: 800 } } : {}),
  ...(n >= 3 ? { sItem: { a: 'line1.item', b: 'item.eye', sag: 3, style: 'light' as const, dur: 800 } } : {}),
});
const gone = (p: Poses): Poses => p;
// 4 every card carries a note: a slip on the amber card, strings from line to order to customer
B({
  poses: { ...room(), clerk: clerk(640, 'wait', { strength: 'back', op: 0.35 }), ...chainCards(0) }, texts: tx(3, 2600),
  camera: { ...CAM.cards, dur: 1400 },
  stages: [
    st(1500, { ...room(), clerk: clerk(640, 'wait', { strength: 'back', op: 0.35 }), ...chainCards(0), slipL: { ...slipPose, dur: 600 }, ...strings(1) }),
    st(2400, { ...room(), clerk: clerk(640, 'wait', { strength: 'back', op: 0.35 }), ...chainCards(0), slipL: slipPose, ...strings(2) }),
    st(3300, { ...room(), clerk: clerk(640, 'wait', { strength: 'back', op: 0.35 }), ...chainCards(0), slipL: slipPose, ...strings(3) }),
  ],
});
// 5 the clerk rewrites the name on one customer card; the order shows the new name
const rw = (extra: Partial<Pose> = {}): Pose => clerk(570, 'write', { handsW: [[548, 654], [545, 650]], ...extra });
B({
  poses: { ...room(), clerk: rw({ dur: 900 }), ...chainCards(0), slipL: slipPose, ...strings(3) }, texts: tx(4, 2600),
  stages: [
    st(1300, { ...room(), clerk: rw(), ...chainCards(0, 0, 1, 0), slipL: slipPose, ...strings(3) }),
    st(2300, { ...room(), clerk: rw(), ...chainCards(1, 1, 1, 1), slipL: slipPose, ...strings(3) }),
    st(3500, { ...room(), clerk: rw(), ...chainCards(1, 1, 0, 1), slipL: slipPose, ...strings(3) }),
  ],
});
void gone;
// 6 question 1 comes forward: a wall calendar, January 2024
const dimRoom = (): Poses => ({ ...room(), ...back({ clerk: clerk(640, 'wait') }) });
const veil = (): Poses => ({ veil: { x: 0, y: 0, op: 0.84, strength: 'back', delay: 100, dur: 700 } });
const cabBack = (): Poses => ({ ...veil(), ...dimRoom(), ...Object.fromEntries(Object.entries(cabinet([0, 0, 0, 0])).map(([k, v]) => [k, { ...v, strength: 'back' as const, op: 0.35 }])) });
B({
  poses: { ...cabBack(), calendar: { x: 440, y: 128, s: 0.92, props: { missing: 1 }, delay: 500, dur: 1500 } }, texts: tx(5, 1700), camera: { ...CAM.room, dur: 1200 },
});
// 7 question 2: three tapes against the same order
const barX = 190;
const bars = (): Poses => ({ barLine1: { x: barX, y: 170, delay: 200 }, barLine2: { x: barX + 1240 * TAPE.K + 6, y: 170, delay: 400 } });
const tapes = (len: number): Poses => Object.fromEntries(TAPES.flatMap((t, i) => [
  [t.id, { x: barX - TAPE.caseW, y: t.y, props: { len, reading: len }, delay: 500 + i * 400, dur: 1200 }],
  [`plumb-${t.id}`, { a: [barX + t.stop * TAPE.K, 266] as [number, number], b: [barX + t.stop * TAPE.K, t.y + 14] as [number, number], style: 'plumb' as const, draw: len, delay: 500 + i * 400 }],
]));
B({ poses: { ...cabBack(), ...bars(), ...tapes(1) }, texts: tx(6, 2800) });
// 8 question 3: parcels on the floor beside the cabinet
const parcels = (): Poses => Object.fromEntries(PARCELS.map((p, i) => [p.id, { x: p.x, y: 358, s: 0.7, delay: 200 + i * 250 }]));
B({ poses: { ...cabBack(), ...parcels(), floor: { a: [40, 490] as [number, number], b: [830, 490] as [number, number], style: 'plumb' as const, draw: 1, delay: 100 } }, texts: tx(7, 1800) });
// 9 wide on the room, tidy and busy; the ledger's first line is written
B({ poses: { ...room(), clerk: clerk(640, 'stand', { flip: false }) }, texts: tx(8, 800), camera: { ...CAM.wholeRoom, dur: 1300 } });
// 10 the clerk puts a copy of the amber card in the dumbwaiter; it rises
const carX = SPOT.car.x, carY = F0 - 52;
const copyHand = (p: Partial<Pose> = {}): Pose => ({ s: 0.12, attach: { to: 'clerk', hand: 1, dx: -2, dy: -3 }, props: { sys: 0 }, amber: true, ...p });
B({
  poses: { ...room(), clerk: { x: 640, y: F0, H: 76, flip: false, fig: 'carry', dur: 700 }, copy: copyHand({ draw: 0, delay: 200, dur: 600 }) }, texts: tx(9, 4200), camera: { ...CAM.shaft, dur: 1300 },
  stages: [
    st(900, { ...room(), clerk: { x: 560, y: F0, H: 76, flip: true, fig: 'carry', dur: 900 }, copy: copyHand() }),
    st(1900, { ...room(), clerk: { x: 354, y: F0, H: 76, flip: true, fig: 'carry', handsW: [null, [carX + 22, F0 - 40]], dur: 900 }, copy: copyHand() }),
    st(2900, { ...room(), clerk: { x: 354, y: F0, H: 76, flip: true, fig: 'wait', dur: 700 }, copy: { x: carX + 10, y: F0 - 36, s: 0.12, props: { sys: 0 }, amber: true, dur: 600 } }),
    st(3500, { ...room(), car: { x: carX, y: carY - 150, dur: 1700, strength: 'full', op: 0 }, clerk: { x: 354, y: F0, H: 76, flip: true, fig: 'wait' }, copy: { x: carX + 10, y: F0 - 36 - 150, s: 0.12, props: { sys: 0 }, amber: true, dur: 1700, op: 0 } }),
  ],
});
void drawerFront; void CABINET; void SC; void SC0_END;

const world: WorldDef = { entities, texts, beats, entry: { poses: SC0_END, texts: {}, camera: CAM.desk } };

/* ---------------------------------------------------------------------------------------------------- furniture */
function furniture(k: number, _t: number, lt: number): FurnitureState {
  const f = emptyFurniture();
  f.questions.forEach((q, i) => {
    q.write = 1; q.from = 'pinned'; q.to = 'pinned'; q.a = 0;
    const fb = Q_BEATS[i];
    if (k === fb) { q.to = 'forward'; q.a = spring(win(lt, [Q_IN, Q_IN_MS])); }
    else if (k === fb + 1) { q.from = 'forward'; q.to = 'pinned'; q.a = spring(win(lt, [0, Q_OUT_MS])); }
  });
  f.locator = { layer: 0, draw: 1 };
  f.legend = 1;
  if (k >= K_LEDGER && k < K_LIFT) f.ledger = [{ scene: 1, write: k === K_LEDGER ? win(lt, [700, 1800]) : 1, tuck: 0 }];
  if (k >= K_LIFT) f.ledger = [{ scene: 1, write: 1, tuck: k === K_LIFT ? spring(win(lt, [3900, 700])) : 1 }];
  return f;
}

const ALT = [
  'In the front office an order form lands on the clerk’s desk: SO1041, Harbor Supply Co., two lines. Line 1 turns amber. We follow this line.',
  'The clerk tears the form along its perforations into cards: one for the order, one for each line.',
  'The clerk files each card. The drawers open one after another: orders, lines, customers, items.',
  'The amber card carries a slip. A string runs from it to the order card and from the order card to the customer card. A lighter string runs to the item card.',
  'The clerk rewrites the name on the customer card. The old name is struck through and the new one written, on the customer card and on the order.',
  'The first pinned question comes forward. A wall calendar shows January 2024, when the cabinet was installed. Older orders live in the old system.',
  'The second question comes forward. Three tapes lie against the same order and stop at ordered 1,550.50, shipped 1,240.00 and invoiced 620.00.',
  'The third question comes forward. Parcels from the web store, web analytics, marketing and the old system sit on the floor beside the cabinet. The office has no drawer for them.',
  'The whole room, tidy and busy. The ledger’s first line is written: the number of kinds of record, filed as they happen.',
  'The clerk puts a copy of the amber card in the dumbwaiter, and it rises.',
];
const scene1 = worldScene({ id: 'front-office', index: 1, name: 'The front office', layer: 0, beats: BEATS1, world, alt: ALT, furniture });
export default scene1;
