// Shared stage furniture, pure model: the three pinned questions, the ledger, the locator, the legend.
// A scene returns a FurnitureState for each progress value; the player never invents one. States compose:
// `restFurniture(n)` is the furniture once scenes before n are finished (what scene n starts from).
import { lerp, type Box, type Metrics, type Rect, type Zones } from './stage';
import { LEDGER, QUESTION_LINES, QUESTION_SHORT } from '../../../content/scenes';

export type Pose = 'center' | 'pinned' | 'forward';

export interface Question {
  id: 'time' | 'people' | 'systems';
  /** the customer's own words, in the lines they are written in (hand-broken) */
  lines: [string, string];
  /** the scene that answers it (the pinned note jumps there) */
  answeredIn: number;
  /** the short form on the pinned paper note (two to four words) */
  short: string;
  /** a few words for the phone badge */
  tag: string;
}

export const QUESTIONS: Question[] = [
  { id: 'time', lines: QUESTION_LINES[0], answeredIn: 3, short: QUESTION_SHORT[0], tag: 'time' },
  { id: 'people', lines: QUESTION_LINES[1], answeredIn: 4, short: QUESTION_SHORT[1], tag: 'people' },
  { id: 'systems', lines: QUESTION_LINES[2], answeredIn: 2, short: QUESTION_SHORT[2], tag: 'systems' },
];

export interface QState {
  /** how much of the note is written, 0..1 */
  write: number;
  from: Pose;
  to: Pose;
  /** 0 = at `from`, 1 = at `to` */
  a: number;
  /** the ink tick, drawn 0..1 */
  tick: number;
}
/** write: how much of the line is written; tuck: 0 = the slip is out on the desk, 1 = it is a thin tab */
export interface LedgerEntry { scene: number; write: number; tuck: number }
export interface FurnitureState {
  questions: [QState, QState, QState];
  ledger: LedgerEntry[];
  /** the layer the locator marks (0 = ground) and how much of it is drawn */
  locator: { layer: number; draw: number };
  legend: number;
}

export const LAYERS = ['NetSuite', 'Ingestion', 'Warehouse', 'Model', 'Doors'] as const;
export const WRITE_AVG = 0.38; // Caveat: average advance per character, in em (for box estimates)

export const ledgerText = (scene: number, count: number | null): string => (scene === 1 ? LEDGER(count) : '');

export const idleQ = (): QState => ({ write: 0, from: 'pinned', to: 'pinned', a: 0, tick: 0 });
export const emptyFurniture = (): FurnitureState => ({ questions: [idleQ(), idleQ(), idleQ()], ledger: [], locator: { layer: 0, draw: 0 }, legend: 0 });

/** furniture once the scenes before `scene` are finished (scene 0 starts from nothing) */
export function restFurniture(scene: number): FurnitureState {
  if (scene <= 0) return emptyFurniture();
  const f = emptyFurniture();
  f.questions = [0, 1, 2].map(() => ({ write: 1, from: 'pinned', to: 'pinned', a: 0, tick: 0 })) as FurnitureState['questions'];
  f.locator = { layer: 0, draw: 1 };
  f.legend = 1;
  for (let s = 1; s < scene; s++) f.ledger.push({ scene: s, write: 1, tuck: 1 });
  return f;
}

export interface PoseGeom { x: number; y: number; size: number }
/** the paper note a pinned question is: slot i in the top-right corner (design units) */
export const PIN = { x0: 536, y: 20, w: 200, h: 38, gap: 8 };
export const pinSlot = (i: number): Rect => ({ x: PIN.x0 + i * (PIN.w + PIN.gap), y: PIN.y, w: PIN.w, h: PIN.h });
export function poseGeom(m: Metrics, i: number, pose: Pose): PoseGeom {
  const { X, Y, F } = m;
  if (pose === 'center') return { x: X(60), y: Y(24 + i * 106), size: F(36) };
  if (pose === 'forward') return { x: X(60), y: Y(42), size: F(30) };
  const sl = pinSlot(i);
  return { x: X(sl.x + 16), y: Y(sl.y + 8), size: F(14) };
}

/** The pose a note is at, mid-move. Going forward the note travels up and left from the corner; coming back it
 *  drops and slides home. Size follows the move. */
export function currentGeom(m: Metrics, i: number, q: QState): PoseGeom {
  const a = poseGeom(m, i, q.from), b = poseGeom(m, i, q.to);
  return { x: lerp(a.x, b.x, q.a), y: lerp(a.y, b.y, q.a), size: lerp(a.size, b.size, q.a) };
}

/** how pinned a note is (1: the paper note with its short form; 0: the handwritten sentence) */
export function pinnedness(q: QState): number {
  const sm = (v: number): number => { const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t); };
  if (q.from === 'pinned' && q.to === 'pinned') return 1;
  if (q.to === 'pinned') return sm((q.a - 0.55) / 0.45);
  if (q.from === 'pinned') return 1 - sm(q.a / 0.4);
  return 0;
}

/** estimated box of a written question at a geometry */
export function questionRect(i: number, g: PoseGeom): Rect {
  const chars = Math.max(...QUESTIONS[i].lines.map((l) => l.length));
  return { x: g.x, y: g.y, w: chars * g.size * WRITE_AVG, h: 2 * g.size * 1.2 };
}

/** the one thing every scene must keep clear of: the furniture zones that are always reserved */
export function reservedZones(z: Zones): Box[] {
  return [
    { id: 'zone:pins', kind: 'zone', rect: z.pins },
    { id: 'zone:locator', kind: 'zone', rect: z.locator },
    { id: 'zone:ledger', kind: 'zone', rect: z.ledger },
    { id: 'zone:legend', kind: 'zone', rect: z.legend },
  ];
}

/** question notes that are NOT at rest in the pin: they are on the stage, so scene elements must keep clear of them */
export function stageQuestionBoxes(m: Metrics, f: FurnitureState): Box[] {
  const out: Box[] = [];
  f.questions.forEach((q, i) => {
    if (q.write <= 0) return;
    const atPin = q.from === 'pinned' && q.to === 'pinned' || (q.a === 0 && q.from === 'pinned') || (q.a === 1 && q.to === 'pinned');
    if (atPin) return;
    out.push({ id: `question:${i}`, kind: 'question', rect: questionRect(i, currentGeom(m, i, q)) });
  });
  return out;
}
