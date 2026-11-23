import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Ontology } from '../ontology/load';
import type { CoreJson } from '../ontology/types';
import { SCENES } from '../figures/scenes';
import type { AnyScene } from '../figures/scenes/contract';
import { PlayerCore, sceneProgress } from '../figures/scenes/player';
import { resolveNames, RECORD_KEYS, FALLBACK_NAMES } from '../figures/scenes/order/data';
import { QUESTIONS, currentGeom, ledgerText, pinSlot, pinnedness, restFurniture, stageQuestionBoxes, reservedZones } from '../figures/scenes/shared/furniture';
import { inside, metrics, overlaps, stageFor, zonesFor } from '../figures/scenes/shared/stage';
import { spring, endPoses, cameraEnd, project, type EState } from '../figures/scenes/world';
import { onScreen, type SW } from '../figures/scenes/shared/worldscene';
import { TYPE } from '../figures/scenes/objects';
import { LOOKS } from '../figures/scenes/figures';
import scene1 from '../figures/scenes/netsuite';
import scene0 from '../figures/scenes/scene0';
import { K_ARRIVES, K_TEARS, K_FILES, K_SLIPS, K_RENAME, K_TIME, K_PEOPLE, K_SYSTEMS, K_LEDGER, K_LIFT } from '../figures/scenes/netsuite';

const dir = path.resolve(__dirname, '../public/ontology');
let o: Ontology;
beforeAll(() => { o = new Ontology(JSON.parse(fs.readFileSync(path.join(dir, 'core.json'), 'utf8')) as CoreJson); });
const names = resolveNames();
const stage = stageFor(1200);
const m = metrics(stage);
const zones = zonesFor(m);
const MARGIN = 16;

const finished = (s: AnyScene, k: number): SW => s.at(s.layout(stage, names), s.beats[k].to - 1e-9, names) as SW;
const things = (s: SW): EState[] => s.world.entities.filter((e) => e.kind !== 'string' && e.kind !== 'building');
const SCREEN = { x: 0, y: 0, w: 1200, h: 780 };
const vis = (s: SW): EState[] => things(s).filter((e) => e.op >= 0.9 && e.draw >= 0.9 && overlaps(onScreen(e, s.world.camera), SCREEN));
const full = (s: SW): EState[] => vis(s).filter((e) => e.strength === 'full');
const top = (e: EState): string => e.parent ?? e.id;
const AMBER = (e: EState): boolean => (e.kind === 'lineCard' && e.spec.n === 1) || (e.kind === 'barSlip' && e.spec.n === 1) || (e.kind === 'form' && (e.props.amber1 ?? 0) > 0.5) || e.amber;
const amberThings = (s: SW): string[] => things(s).filter((e) => e.op > 0.3 && e.draw > 0.3 && e.strength === 'full' && AMBER(e)).map((e) => e.id);
const frames = SCENES.flatMap((sc, si) => sc.beats.map((_, k) => ({ name: `scene ${si} click ${k + 1}`, sc, k })));

describe('scenes and beats', () => {
  it('two scenes, ordered contiguous beats from 0 to 1; six clicks and ten clicks', () => {
    expect(SCENES.map((s) => s.id)).toEqual(['counter', 'front-office']);
    SCENES.forEach((s, i) => {
      expect(s.index).toBe(i); expect(s.beats[0].from).toBe(0); expect(s.beats[s.beats.length - 1].to).toBeCloseTo(1, 12);
      for (let k = 1; k < s.beats.length; k++) expect(s.beats[k].from).toBe(s.beats[k - 1].to);
      expect(s.duration).toBe(s.beats.reduce((a, b) => a + b.ms, 0));
    });
    expect(SCENES[0].beats.length).toBe(6); expect(SCENES[1].beats.length).toBe(10);
  });
  it('springs overshoot under 1% and land exactly', () => { let max = 0; for (let i = 0; i <= 1000; i++) max = Math.max(max, spring(i / 1000)); expect(max).toBeLessThan(1.01); expect(spring(1)).toBe(1); });
  it('a scene is a pure function of progress', () => {
    const L = scene1.layout(stage, names);
    for (const p of [0, 0.13, 0.5, 0.77, 1]) expect(JSON.stringify(scene1.at(L, p, names))).toBe(JSON.stringify(scene1.at(L, p, names)));
  });
  it('every stage inside a click starts before the click ends', () => {
    for (const sc of [scene0, scene1]) sc.world.beats.forEach((b, k) => b.stages?.forEach((st) => expect(st.at, `${sc.id} click ${k + 1}`).toBeLessThan(sc.beats[k].ms)));
  });
});

describe('player state machine', () => {
  const info = SCENES.map((s) => ({ beats: s.beats }));
  const mk = (instant = false) => new PlayerCore(info, instant);
  it('next plays a beat to its end, then the next; back lands on finished frames only', () => {
    const c = mk(); c.next(); expect(c.state.playing).toBe(true); c.tick(1000); expect(c.state.u).toBeGreaterThan(0); expect(c.state.u).toBeLessThan(1);
    c.next(); expect(c.state).toMatchObject({ scene: 0, beat: 0, u: 1, playing: false });
    c.next(); expect(c.state).toMatchObject({ scene: 0, beat: 1, u: 0, playing: true });
    c.tick(1e6); expect(c.state.u).toBe(1); c.back(); expect(c.state).toMatchObject({ scene: 0, beat: 0, u: 1 }); c.back(); expect(c.state).toMatchObject({ scene: 0, beat: 0, u: 0 });
  });
  it('walks the whole piece: sixteen stops, every one a finished frame', () => {
    const c = mk(true); const seen: string[] = [];
    for (let i = 0; i < 60 && !c.isLast(); i++) { c.next(); seen.push(`${c.state.scene}.${c.state.beat}`); expect(c.state.u).toBe(1); }
    expect(seen.length).toBe(16); expect(seen[5]).toBe('0.5'); expect(seen[6]).toBe('1.0'); expect(seen[15]).toBe('1.9');
    for (let i = 0; i < 15; i++) { c.back(); expect(c.state.u).toBe(1); }
  });
  it('back crosses scenes; scroll stays in a beat; jump and skip behave; reduced motion is instant', () => {
    const c = mk(); c.goto(1, 0, 0.3); c.back(); expect(c.state).toMatchObject({ scene: 0, beat: 5, u: 1 });
    c.goto(1, 2, 0.5); c.scroll(5); expect(c.state).toMatchObject({ beat: 2, u: 1 }); c.scroll(-9); expect(c.state).toMatchObject({ beat: 2, u: 0 });
    expect(c.jump(0)).toBe(true); expect(c.jump(5)).toBe(false); c.skip(); expect(c.state).toMatchObject({ scene: 0, beat: 5, u: 1 });
    c.jump(1); c.skip(); expect(c.state).toMatchObject({ scene: 1, beat: 9, u: 1 }); expect(c.isLast()).toBe(true);
    const r = mk(true); r.next(); expect(r.state).toMatchObject({ u: 1, playing: false });
    const b = SCENES[1].beats[3]; expect(sceneProgress(SCENES[1].beats, { scene: 1, beat: 3, u: 1 })).toBe(b.to);
  });
});

describe('the hand-off: scene 0 ends on the frame scene 1 begins with', () => {
  it.each([stage, stageFor(880), stageFor(343)])('stage %#', (st) => {
    const a = scene0.at(scene0.layout(st, names), 1, names) as SW, b = scene1.at(scene1.layout(st, names), 0, names) as SW;
    expect(b.world.camera).toEqual(a.world.camera);
    const sig = (s: SW) => JSON.stringify(s.world.entities.filter((e) => e.id !== 'form' && e.op > 0.01).map((e) => [e.id, +e.x.toFixed(2), +e.y.toFixed(2), +e.s.toFixed(3), +e.op.toFixed(3), e.props ? Object.entries(e.props).filter(([k]) => k.startsWith('f')).map(([k, v]) => [k, +v.toFixed(2)]) : 0]).sort());
    // everything on stage at the end of scene 0 is on stage at the start of scene 1, in the same place
    const A = JSON.parse(sig(a)) as unknown[][], B = JSON.parse(sig(b)) as unknown[][];
    expect(B).toEqual(A);
    const mm = metrics(st);
    a.furniture.questions.forEach((q, i) => { const g0 = currentGeom(mm, i, q), g1 = currentGeom(mm, i, b.furniture.questions[i]); expect(g1.x).toBeCloseTo(g0.x, 6); expect(g1.y).toBeCloseTo(g0.y, 6); expect(pinnedness(q)).toBe(1); expect(pinnedness(b.furniture.questions[i])).toBe(1); });
  });
});

describe('the pinned notes', () => {
  it('short forms of two to four words in a corner clear of the narration', () => {
    QUESTIONS.forEach((q, i) => { const sl = pinSlot(i); expect(q.short.split(' ').length).toBeLessThanOrEqual(4); expect(sl.y + sl.h).toBeLessThanOrEqual(64); expect(sl.x + sl.w).toBeLessThanOrEqual(1200 - 24); expect(q.short.length * 19 * 0.52 + 44).toBeLessThan(sl.w); });
  });
});

describe.each(frames)('finished frame: $name', ({ sc, k }) => {
  const s = finished(sc, k);
  const L = sc.layout(stage, names);
  it('nothing visible is cut by the edge of the stage (the building itself is the backdrop)', () => {
    for (const e of full(s)) { const r = onScreen(e, s.world.camera); expect(inside(r, 1200, 780, 0), `${e.id} ${JSON.stringify(r)}`).toBe(true); }
    for (const b of sc.boxes(L, s)) if (b.kind === 'text') expect(inside(b.rect, 1200, 780, MARGIN), b.id).toBe(true);
  });
  it('nothing touches the furniture zones or a question brought forward', () => {
    const zs = reservedZones(zones);
    for (const e of full(s)) for (const z of zs.filter((q) => q.id !== 'zone:ledger' || s.furniture.ledger.length)) expect(overlaps(onScreen(e, s.world.camera), z.rect), `${e.id} vs ${z.id}`).toBe(false);
    for (const b of sc.boxes(L, s)) if (b.kind === 'text') for (const z of zs) expect(overlaps(b.rect, z.rect), `${b.id} vs ${z.id}`).toBe(false);
    for (const q of stageQuestionBoxes(m, s.furniture)) for (const b of sc.boxes(L, s)) if (b.kind === 'text') expect(overlaps(b.rect, q.rect), `${b.id} vs ${q.id}`).toBe(false);
  });
  it('no more than five things at full strength; at most one amber thing', () => {
    expect(new Set(full(s).filter((e) => e.kind !== 'car' || sc === scene1).map(top)).size, full(s).map((e) => e.id).join()).toBeLessThanOrEqual(5);
    expect(amberThings(s).length).toBeLessThanOrEqual(1);
  });
  it('no two things at full strength overlap, except a worker and what the worker handles', () => {
    const f = full(s);
    const handled = new Set(['form', 'orderCard', 'line1', 'line2', 'customer', 'item', 'slipL', 'cabinet', 'dOrders', 'dLines', 'dCust', 'dItems', 'copy', 'car', 'board']);
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
      const a = f[i], b = f[j];
      if (top(a) === top(b) || a.parent === b.id || b.parent === a.id) continue;
      if ((a.kind === 'figure' && handled.has(b.id)) || (b.kind === 'figure' && handled.has(a.id))) continue;
      if (a.kind === 'figure' && b.kind === 'figure') continue;
      if ((a.id === 'car' && b.id === 'copy') || (a.id === 'copy' && b.id === 'car')) continue;
      expect(overlaps(onScreen(a, s.world.camera), onScreen(b, s.world.camera)), `${a.id} vs ${b.id}`).toBe(false);
    }
  });
  it('every hand meets its target', () => {
    for (const e of things(s).filter((x) => x.kind === 'figure' && x.solved && x.handsW)) {
      e.handsW!.forEach((w, i) => { if (!w) return; const h = e.solved!.J.hands[i]; expect(Math.hypot(h[0] - w[0], h[1] - w[1]), `${e.id} hand ${i}`).toBeLessThan(2); });
    }
    void LOOKS;
  });
  it('the camera frames the action: the worker or the cards in focus are on the stage', () => {
    const v = vis(s).filter((e) => e.kind === 'figure' || e.kind.endsWith('Card') || e.kind === 'lineCard' || e.kind === 'calendar' || e.kind === 'tape' || e.kind === 'parcel' || e.kind === 'cabinet');
    expect(v.length).toBeGreaterThan(0);
  });
});

describe('the camera', () => {
  const LIT_ROOM: [number, number][] = [[250, 950]];
  it('each click frames the right place: the counter for the questions, the front office for scene 1', () => {
    const c0 = scene0.world.beats.map((_, i) => cameraEnd(scene0.world, i)), c1 = scene1.world.beats.map((_, i) => cameraEnd(scene1.world, i));
    for (let i = 1; i <= 4; i++) { expect(c0[i].cy).toBeLessThan(300); expect(c0[i].cx).toBeGreaterThan(900); expect(c0[i].s).toBeGreaterThan(3); }
    expect(c0[0].s).toBeLessThan(1.2); expect(c0[5].cy).toBeGreaterThan(600);
    for (const c of c1) { expect(c.cy).toBeGreaterThan(600); expect(c.cy).toBeLessThan(700); expect(c.cx).toBeGreaterThan(LIT_ROOM[0][0]); expect(c.cx).toBeLessThan(LIT_ROOM[0][1]); }
  });
  it.each([[1280, 800], [1280, 720]])('on a %i x %i stage the design box fits whole, so every frame is framed the same', (w, h) => {
    const mm = metrics({ w, h });
    expect(mm.ox).toBeGreaterThanOrEqual(0); expect(mm.oy).toBeGreaterThanOrEqual(0); expect(mm.k).toBeGreaterThan(0.9);
    // the focus of the click stays inside the design box at every finished frame
    for (const sc of [scene0, scene1]) sc.beats.forEach((_, k) => {
      const fr = sc.at(sc.layout({ w, h }, names), sc.beats[k].to - 1e-9, names) as SW;
      const focus = fr.world.entities.filter((e) => e.kind === 'figure' && e.strength === 'full' && e.op > 0.9);
      for (const e of focus) { const p = project(fr.world.camera, e.x, e.y - 40); expect(p[0]).toBeGreaterThan(0); expect(p[0]).toBeLessThan(1200); expect(p[1]).toBeGreaterThan(0); expect(p[1]).toBeLessThan(780); }
    });
  });
  it('lines and text keep their size on screen: a string is drawn at a width that cancels the zoom', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../figures/scenes/world/view.ts'), 'utf8');
    expect(src).toMatch(/1 \/ this\.cam\.s/); expect(src).toMatch(/data-c|consts/);
  });
});

describe('the lit floor: the building at dusk', () => {
  it('scene 0 lights the counter room and dims the others; the light comes on downstairs at the end', () => {
    const lit = (s: SW) => Object.entries(s.world.entities.find((e) => e.id === 'building')!.props).filter(([k, v]) => k.startsWith('f') && v === 1).map(([k]) => k);
    expect(lit(finished(scene0, 0))).toEqual(['f4']); expect(lit(finished(scene0, 5))).toEqual(['f0']); expect(lit(finished(scene1, 0))).toEqual(['f0']);
  });
});

describe('staging, click by click', () => {
  const at = (k: number) => finished(scene1, k);
  const ids = (s: SW) => things(s).filter((e) => e.op > 0.5).map((e) => e.id);
  it('the one amber thing is the line we follow: the form line, its card, the bar, the copy that goes upstairs', () => {
    for (const k of [K_ARRIVES, K_TEARS, K_SLIPS, K_RENAME, K_PEOPLE]) expect(amberThings(at(k)).length, `click ${k + 1}`).toBe(1);
    const mid = scene1.at(scene1.layout(stage, names), scene1.beats[K_LIFT].from + 0.7 * (scene1.beats[K_LIFT].to - scene1.beats[K_LIFT].from), names) as SW;
    expect(amberThings(mid).length).toBe(1);
    for (const k of [K_TIME, K_SYSTEMS]) expect(amberThings(at(k)).length).toBe(0);
  });
  it('the form lands, the clerk tears it into cards, files them, and the drawers read orders, lines, customers, items', () => {
    expect(ids(at(K_ARRIVES))).toContain('form'); expect(ids(at(K_TEARS))).toEqual(expect.arrayContaining(['orderCard', 'line1', 'line2']));
    expect(ids(at(K_TEARS))).not.toContain('form');
    expect(ids(at(K_FILES))).toEqual(expect.arrayContaining(['dOrders', 'dLines', 'dCust', 'dItems']));
    expect(things(at(K_FILES)).filter((e) => /Card$/.test(e.kind) && e.op > 0.5).length).toBe(0);
  });
  it('in clicks 6 to 8 the clerk and the cabinet step back so the calendar, the tapes or the parcels own the frame', () => {
    for (const k of [K_TIME, K_PEOPLE, K_SYSTEMS]) for (const id of ['clerk', 'cabinet']) { const e = things(at(k)).find((x) => x.id === id)!; expect(e.strength, `${id} click ${k + 1}`).toBe('back'); }
    expect(ids(at(K_TIME))).toContain('calendar'); expect(ids(at(K_SYSTEMS)).filter((i) => i.startsWith('parcel')).length).toBe(4);
  });
  it('the three tapes keep stable ids and read ordered 1,550.50, shipped 1,240.00, invoiced 620.00', () => {
    const t = things(at(K_PEOPLE)).filter((e) => e.kind === 'tape');
    expect(t.map((e) => [e.id, e.spec.word, e.spec.reading])).toEqual([['tapeOrdered', 'ordered', '1,550.50'], ['tapeShipped', 'shipped', '1,240.00'], ['tapeInvoiced', 'invoiced', '620.00']]);
    expect(1240 + 310.5).toBe(1550.5);
  });
  it('the ledger is written in click 9 and tucks to a tab in click 10', () => {
    for (let k = 0; k < K_LEDGER; k++) expect(at(k).furniture.ledger.length).toBe(0);
    expect(at(K_LEDGER).furniture.ledger[0]).toMatchObject({ scene: 1, write: 1, tuck: 0 }); expect(at(K_LIFT).furniture.ledger[0].tuck).toBe(1);
    expect(restFurniture(2).ledger[0]).toMatchObject({ scene: 1, tuck: 1 });
  });
  it('the copy of the amber card rises: it ends above where it began', () => {
    const a = finished(scene1, K_LEDGER), b = scene1.beats[K_LIFT];
    const z = scene1.at(scene1.layout(stage, names), b.from + 0.85 * (b.to - b.from), names) as SW;
    expect(things(z).find((e) => e.id === 'car')!.y).toBeLessThan(things(a).find((e) => e.id === 'car')!.y - 30);
  });
});

describe('the slip chain is the data path: line -> order -> customer; the item tie is invented', () => {
  const poses = endPoses(scene1.world, K_SLIPS) as Record<string, { a?: string; b?: string; style?: string; strength?: string }>;
  it('line 1 carries a slip to its order, the order to its customer; the item string is light and its card at the background weight', () => {
    expect([poses.sOrder.a, poses.sOrder.b]).toEqual(['slipL.eye', 'orderCard.num']); expect([poses.sCust.a, poses.sCust.b]).toEqual(['orderCard.slipC', 'customer.eye']);
    expect(poses.sOrder.style).toBe('string'); expect(poses.sCust.style).toBe('string'); expect(poses.sItem.style).toBe('light'); expect(poses.item.strength).toBe('back');
    const slip = scene1.world.entities.find((e) => e.id === 'slipL')!; expect(slip.spec).toMatchObject({ a: 'Order:', b: 'see card SO1041' });
  });
  it('the real ontology has the records', () => { for (const key of Object.values(RECORD_KEYS)) { const i = o.find('netsuiteRecord', key); expect(i, key).toBeDefined(); expect(o.get('netsuiteRecord', i!).explicit, key).toBe(1); } });
  it('renaming the customer once changes what the order reads, on both cards', () => {
    const a = finished(scene1, K_SLIPS), b = finished(scene1, K_RENAME);
    const now = (s: SW, id: string) => things(s).find((e) => e.id === id)!.props.nameNow;
    expect([now(a, 'customer'), now(a, 'orderCard'), now(b, 'customer'), now(b, 'orderCard')]).toEqual([0, 0, 1, 1]);
    const mid = scene1.at(scene1.layout(stage, names), scene1.beats[K_RENAME].from + 0.6 * (scene1.beats[K_RENAME].to - scene1.beats[K_RENAME].from), names) as SW;
    expect(things(mid).find((e) => e.id === 'customer')!.props.strike).toBeGreaterThan(0.5);
  });
});

describe('records are real', () => {
  it('names and the count of 173 come from the ontology', () => {
    const real = resolveNames(o);
    expect([real.header, real.line, real.customer, real.item]).toEqual(['Transactions', 'TransactionLine', 'customer', 'item']); expect(FALLBACK_NAMES.header).toBe(real.header);
    let explicit = 0; for (let i = 0; i < o.count('netsuiteRecord'); i++) if (o.get('netsuiteRecord', i).explicit) explicit++;
    expect(real.count).toBe(explicit); expect(real.count).toBe(173); expect(ledgerText(1, real.count)).toMatch(/^173 /); expect(ledgerText(1, null)).not.toMatch(/\d/);
  });
});

describe('type for a room, and rulebook checks on the source', () => {
  const root = path.resolve(__dirname, '../figures/scenes');
  const files: string[] = [];
  const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(ts|css)$/.test(f.name)) files.push(p); } };
  walk(root);
  const src = (f: string) => fs.readFileSync(f, 'utf8');
  it('the scale: primary labels at least 22, secondary at least 13', () => { expect(TYPE.primary).toBeGreaterThanOrEqual(22); expect(TYPE.label).toBeGreaterThanOrEqual(22); expect(TYPE.secondary).toBeGreaterThanOrEqual(13); });
  it('no text in an object, the building or a scene is set below 13 design px; narration is 26', () => {
    for (const f of ['objects/index.ts', 'building/index.ts', 'netsuite/index.ts', 'scene0/index.ts']) for (const mt of src(path.join(root, f)).matchAll(/size: (\d+(?:\.\d+)?)\b/g)) expect(Number(mt[1]), `${f}: size ${mt[1]}`).toBeGreaterThanOrEqual(13);
    for (const t of [...scene0.world.texts, ...scene1.world.texts]) if (t.kind === 'serif') expect(t.size).toBeGreaterThanOrEqual(26);
  });
  it('nothing is random; no hex colours in code; no keyframes, filters or arrows', () => {
    for (const f of files) { expect(src(f), f).not.toMatch(/Math\.random/); if (f.endsWith('.ts')) { expect(src(f), f).not.toMatch(/#[0-9a-fA-F]{6}\b/); expect(src(f), f).not.toMatch(/@keyframes|\.animate\(|marker-end|arrowhead/i); expect(src(f), f).not.toMatch(/\.style\.(filter|background)\b/); } }
  });
  it('figures are one solid shape: no joint outlines are drawn (the cut ring is the only stroke)', () => {
    const f = src(path.join(root, 'figures/index.ts'));
    expect(f).not.toMatch(/stroke: 'var\(--ink\)'/); expect(f).toMatch(/run\('legN', true\)/);
  });
});
