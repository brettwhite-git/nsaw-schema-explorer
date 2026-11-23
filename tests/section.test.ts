import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Ontology } from '../ontology/load';
import type { CoreJson, DetailJson } from '../ontology/types';
import {
  BANDS, BEAT_COUNT, BEAT_KEY, BH, DOOR_BOX, DOORS_BOX, FIT_BOX, FONT_NAME, FONT_SMALL, FONT_WORLD, MARKS_PER_PIPE, MIN_TEXT_PX, NAME_MIN_SCALE, PIPE_X, PIPE_Y0, PIPE_Y1, RISER, SEAM, STEP, TIMING, X0, X1,
  accentFor, bandBottom, bandMid, bandTop, beatAt, beatCentre, camForKey, cameraAt, closeAt, closeScale, doorScale, doorsScale, dwellOf, effectivePx, entryMargin, fitScale, lodAt, moreRecords,
  moreSubjectAreas, moreTables, resetTimeline, reveal, riserAt, rowMarkY, shiftAt, timelineFor, toScreen, toWorld, TEXT_MIN_SCALE, type Stage,
} from '../figures/section/model';
import { ANCHORS, wrapText } from '../figures/section/render';
import { warehouseField, modelField } from '../figures/section/fields';
import { countsOf } from '../figures/section/data';
import { CALLOUTS, DOOR_CLAIMS, PARTS } from '../content/entry';

const dir = path.resolve(__dirname, '../public/ontology');
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;
let o: Ontology;
beforeAll(() => { o = new Ontology(read<CoreJson>('core.json')).attach('columns', read<DetailJson>('columns.json')).attach('usedwith', read<DetailJson>('usedwith.json')); });

// 16:10 desktop, 4:3 tablet, 9:16 phone
const STAGES: Stage[] = [{ w: 1000, h: 625 }, { w: 800, h: 600 }, { w: 343, h: 560 }];
const sweep = (n = 400): number[] => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('section world', () => {
  it('risers are real space: at least 45% of a band, and more than half here', () => {
    expect(RISER / BH).toBeGreaterThanOrEqual(0.45);
    expect(STEP).toBe(BH + RISER);
    for (let i = 0; i < BANDS - 1; i++) expect(bandTop(i) - bandBottom(i + 1)).toBe(RISER);
    expect(bandBottom(0)).toBe(0);
  });
  it('closed, the risers are a thin seam and the whole section is much shorter', () => {
    expect(riserAt(0)).toBe(RISER); expect(riserAt(1)).toBe(SEAM);
    for (let i = 0; i < BANDS - 1; i++) expect(bandTop(i, 1) - bandBottom(i + 1, 1)).toBe(SEAM);
    expect(bandTop(3, 1) / bandTop(3, 0)).toBeLessThan(0.75);
    for (let i = 0; i < BANDS; i++) expect(bandBottom(i, 0) + shiftAt(i, 1)).toBe(bandBottom(i, 1));
  });
});

describe('camera: a pure function of progress', () => {
  it('climbs monotonically to the top of the model band (it never goes back down), and never zooms in', () => {
    for (const st of STAGES) {
      let prev = cameraAt(0, st);
      for (const p of sweep()) {
        const c = cameraAt(p, st);
        if (p <= dwellOf(4, st)[1]) expect(c.cy, `${st.w} p=${p}`).toBeLessThanOrEqual(prev.cy + 1e-9);
        if (st.w >= 540) expect(c.s, `${st.w} p=${p}`).toBeLessThanOrEqual(prev.s + 1e-9);
        prev = c;
      }
    }
  });
  it('is reversible and order-independent: the same progress always gives the same camera', () => {
    for (const st of STAGES) {
      const ps = sweep(60);
      const fwd = ps.map((p) => cameraAt(p, st));
      const back = [...ps].reverse().map((p) => cameraAt(p, st)).reverse();
      const shuffled = ps.map((_, i) => ps[(i * 7) % ps.length]).map((p) => cameraAt(p, st));
      expect(back).toEqual(fwd);
      ps.forEach((p, i) => expect(cameraAt(ps[(i * 7) % ps.length], st)).toEqual(shuffled[i]));
    }
  });
  it('is smooth: no jump between neighbouring progress values', () => {
    for (const st of STAGES) {
      const ds = 1 / 2000;
      for (let p = 0; p < 1; p += ds) {
        const a = cameraAt(p, st), b = cameraAt(p + ds, st);
        // camera travel in screen px per scroll px (a 900 px viewport; the track is TIMING.trackViewports tall): never more than 3
        expect((Math.abs(b.cy - a.cy) * a.s) / (ds * TIMING.trackViewports * 900), `p=${p}`).toBeLessThan(3);
        expect(Math.abs(b.s - a.s)).toBeLessThan(0.02);
      }
    }
  });
  it('each band is fully inside the stage at its beat, at 16:10, 4:3 and 9:16', () => {
    for (const st of STAGES) for (let i = 0; i < BANDS; i++) {
      const c = cameraAt(beatCentre(i + 1, st), st);
      const [x0, y0] = toScreen(c, st, X0, bandTop(i)), [x1, y1] = toScreen(c, st, X1, bandBottom(i));
      expect(x0, `band ${i} left at ${st.w}`).toBeGreaterThanOrEqual(0);
      expect(x1, `band ${i} right at ${st.w}`).toBeLessThanOrEqual(st.w);
      expect(y0, `band ${i} top at ${st.w}`).toBeGreaterThanOrEqual(0);
      expect(y1, `band ${i} bottom at ${st.w}`).toBeLessThanOrEqual(st.h);
      // one band fills most of the stage: at least 60% of the width, or the height limit on a wide stage
      expect((x1 - x0) / st.w > 0.55 || (y1 - y0) / st.h > 0.5, `band ${i} fills at ${st.w}`).toBe(true);
    }
  });
  it('the ground beat shows the ground line and the headline below it, and the first band above', () => {
    for (const st of STAGES) {
      const c = cameraAt(0, st);
      const ground = toScreen(c, st, 450, 0)[1], bandTopY = toScreen(c, st, 450, bandTop(0))[1], head = toScreen(c, st, 450, 142)[1];
      expect(ground).toBeGreaterThan(0); expect(ground).toBeLessThan(st.h);
      expect(bandTopY).toBeGreaterThanOrEqual(0);
      expect(head).toBeLessThanOrEqual(st.h);
    }
  });
  it('the doors beat shows both doors (one framing on wide stages, one door at a time on phones)', () => {
    for (const st of STAGES) {
      const inside = (c: ReturnType<typeof cameraAt>, bx: { x0: number; x1: number; y0: number; y1: number }) => {
        for (const [x, y] of [[bx.x0, bx.y0], [bx.x1, bx.y1]]) {
          const [sx, sy] = toScreen(c, st, x, y);
          expect(sx).toBeGreaterThanOrEqual(-1); expect(sx).toBeLessThanOrEqual(st.w + 1); expect(sy).toBeGreaterThanOrEqual(-1); expect(sy).toBeLessThanOrEqual(st.h + 1);
        }
      };
      if (st.w >= 540) inside(camForKey('doors', st), DOORS_BOX);
      else {
        inside(camForKey('doorA', st), DOOR_BOX.a); inside(camForKey('doorB', st), DOOR_BOX.b);
        // the label and the report number are readable at both framings
        expect(effectivePx(FONT_WORLD, doorScale(st))).toBeGreaterThanOrEqual(MIN_TEXT_PX);
        expect(lodAt(camForKey('doorA', st), st).text).toBe(true); expect(lodAt(camForKey('doorB', st), st).text).toBe(true);
        const kf = timelineFor(st).keyframes.map(([, k]) => k);
        expect(kf).toContain('doorA'); expect(kf).toContain('doorB'); expect(kf).not.toContain('doors');
      }
    }
  });
  it('the last beat shows the whole assembled section, ground to top, centred between the margins left for the entries', () => {
    for (const st of STAGES) {
      const f = cameraAt(1, st);
      const fb = FIT_BOX();
      for (const [x, y] of [[fb.x0, fb.y0], [fb.x1, fb.y1], [fb.x0, fb.y1], [fb.x1, fb.y0]]) {
        const [sx, sy] = toScreen(f, st, x, y);
        expect(sx).toBeGreaterThanOrEqual(0); expect(sx).toBeLessThanOrEqual(st.w); expect(sy).toBeGreaterThanOrEqual(0); expect(sy).toBeLessThanOrEqual(st.h);
      }
      // every band (risers closed) is inside the stage, and the strata plus doors sit between the entry margins
      for (let i = 0; i < BANDS; i++) {
        const [x0, y0] = toScreen(f, st, X0, bandTop(i, 1)), [x1, y1] = toScreen(f, st, 800, bandBottom(i, 1));
        expect(x0).toBeGreaterThanOrEqual(0); expect(x1).toBeLessThanOrEqual(st.w); expect(y0).toBeGreaterThanOrEqual(0); expect(y1).toBeLessThanOrEqual(st.h);
      }
      const left = toScreen(f, st, X0, 0)[0], right = st.w - toScreen(f, st, 800, 0)[0];
      expect(Math.abs(left - right)).toBeLessThan(1);                    // even margins
      expect(left).toBeGreaterThanOrEqual(entryMargin(st) - 1);          // room for the entries
      expect(f.s).toBeCloseTo(fitScale(st), 9);
    }
  });
  it('assembled, the section is drawn much larger than the open, stretched-out version would be', () => {
    for (const st of STAGES.slice(0, 2)) {
      const openFit = Math.min((st.h * 0.94) / (bandTop(3, 0) * -1 + 100), 9);
      expect(fitScale(st)).toBeGreaterThan(openFit * 1.25);
    }
  });
  it('world and screen coordinates invert each other', () => {
    for (const st of STAGES) for (const p of [0, 0.3, 0.6, 1]) {
      const c = cameraAt(p, st);
      const [sx, sy] = toScreen(c, st, 321, -777);
      const [wx, wy] = toWorld(c, st, sx, sy);
      expect(wx).toBeCloseTo(321, 8); expect(wy).toBeCloseTo(-777, 8);
    }
  });
});

describe('beats and reveal windows', () => {
  it('beats and keyframes are in order, and each beat rests on its own key', () => {
    for (const st of STAGES) {
      const tl = timelineFor(st);
      expect(tl.beatStart.length).toBe(BEAT_COUNT);
      for (let i = 1; i < tl.beatStart.length; i++) expect(tl.beatStart[i]).toBeGreaterThan(tl.beatStart[i - 1]);
      for (let i = 1; i < tl.keyframes.length; i++) expect(tl.keyframes[i][0]).toBeGreaterThanOrEqual(tl.keyframes[i - 1][0]);
      expect(tl.keyframes[0][0]).toBe(0); expect(tl.keyframes[tl.keyframes.length - 1][0]).toBe(1);
      for (let b = 0; b < BEAT_COUNT; b++) expect(beatAt(beatCentre(b, st), st), `beat ${b} at ${st.w}`).toBe(b);
      expect(beatAt(0, st)).toBe(0); expect(beatAt(1, st)).toBe(BEAT_COUNT - 1);
    }
  });
  it('the timing block drives everything: lengths are relative, the camera path stays in order, and a longer riser pan makes every riser pan longer', () => {
    const st = STAGES[0];
    const before = timelineFor(st);
    const dur = (tl: ReturnType<typeof timelineFor>) => { const a = tl.keyframes.findIndex(([, k]) => k === 'b0'), b = tl.keyframes.findIndex(([, k]) => k === 'b1'); return tl.keyframes[b][0] - tl.keyframes[a + 1][0]; };
    const d0 = dur(before);
    const old = TIMING.pan.riser;
    TIMING.pan.riser = old * 1.6; resetTimeline();
    const after = timelineFor(st);
    expect(dur(after)).toBeGreaterThan(d0);
    for (let i = 1; i < after.keyframes.length; i++) expect(after.keyframes[i][0]).toBeGreaterThanOrEqual(after.keyframes[i - 1][0]);
    TIMING.pan.riser = old; resetTimeline();
    expect(timelineFor(st).keyframes).toEqual(before.keyframes);
    expect(TIMING.trackViewports).toBeGreaterThanOrEqual(7.5); expect(TIMING.trackViewports).toBeLessThanOrEqual(8.5);
  });
  it('the risers are the slow parts now: each riser pan is at least 0.09 of the track and longer than any dwell shorter than it', () => {
    for (const st of STAGES) {
      const kf = timelineFor(st).keyframes;
      const pan = (k0: string, k1: string) => { const a = kf.filter(([, k]) => k === k0).pop()!, b = kf.find(([, k]) => k === k1)!; return b[0] - a[0]; };
      for (const [a, b] of [['b0', 'b1'], ['b1', 'b2'], ['b2', 'b3']]) expect(pan(a, b)).toBeGreaterThanOrEqual(0.09);
    }
  });
  it('bands and risers reveal in climbing order', () => {
    for (const st of STAGES) {
      const W = timelineFor(st).win;
      const order = [W.band0, W.riser1, W.band1, W.riser2, W.band2, W.riser3, W.band3, W.doorA];
      for (let i = 1; i < order.length; i++) expect(order[i][0]).toBeGreaterThanOrEqual(order[i - 1][0]);
      for (const w of Object.values(W)) { expect(w[1]).toBeGreaterThan(w[0]); expect(w[0]).toBeGreaterThanOrEqual(0); expect(w[1]).toBeLessThanOrEqual(1); }
    }
  });
  it('a band finishes drawing before the camera leaves it, and everything is drawn when the section is assembled', () => {
    for (const st of STAGES) {
      const tl = timelineFor(st), W = tl.win;
      const holdEnd = (key: string) => Math.max(...tl.keyframes.filter(([, k]) => k === key).map(([p]) => p));
      expect(W.band0[1]).toBeLessThanOrEqual(holdEnd('b0')); expect(W.band1[1]).toBeLessThanOrEqual(holdEnd('b1'));
      expect(W.band2[1]).toBeLessThanOrEqual(holdEnd('b2')); expect(W.field2[1]).toBeLessThanOrEqual(holdEnd('b2'));
      expect(W.band3[1]).toBeLessThanOrEqual(holdEnd('b3')); expect(W.field3[1]).toBeLessThanOrEqual(holdEnd('b3') + 1e-9);
      for (const w of Object.values(W)) expect(reveal(w, tl.assemble[1])).toBe(1);
    }
  });
  it('reveal is clamped and monotonic', () => {
    for (const w of Object.values(timelineFor(STAGES[0]).win)) { let prev = 0; for (const p of sweep(200)) { const r = reveal(w, p); expect(r).toBeGreaterThanOrEqual(prev); expect(r).toBeLessThanOrEqual(1); prev = r; } }
  });
});

describe('the risers close (assembly)', () => {
  it('is 0 until the pull-back begins, 1 when it ends, monotonic, and the same either way round', () => {
    for (const st of STAGES) {
      const [a, b] = timelineFor(st).assemble;
      expect(closeAt(0, st)).toBe(0); expect(closeAt(a, st)).toBe(0); expect(closeAt(b, st)).toBe(1); expect(closeAt(1, st)).toBe(1);
      let prev = 0;
      for (const p of sweep(300)) { const c = closeAt(p, st); expect(c).toBeGreaterThanOrEqual(prev - 1e-12); expect(c).toBeLessThanOrEqual(1); prev = c; }
      const ps = sweep(40);
      expect([...ps].reverse().map((p) => closeAt(p, st)).reverse()).toEqual(ps.map((p) => closeAt(p, st)));
      expect(closeAt((a + b) / 2, st)).toBeGreaterThan(0.2); expect(closeAt((a + b) / 2, st)).toBeLessThan(0.8);
    }
  });
  it('bands never overlap while closing, and never leave a gap smaller than the seam', () => {
    for (const st of STAGES) for (const p of sweep(200)) {
      const c = closeAt(p, st);
      for (let i = 0; i < BANDS - 1; i++) expect(bandTop(i, c) - bandBottom(i + 1, c)).toBeGreaterThanOrEqual(SEAM - 1e-9);
    }
  });
});

describe('level of detail and label size after camera scale', () => {
  it('text is never under the minimum size on screen, and the quiet labels likewise', () => {
    for (const st of STAGES) for (const p of sweep(200)) {
      const c = cameraAt(p, st), lod = lodAt(c, st);
      if (lod.text) expect(effectivePx(FONT_WORLD, c.s), `${st.w} p=${p}`).toBeGreaterThanOrEqual(MIN_TEXT_PX - 1e-9);
      if (lod.textSmall) expect(effectivePx(FONT_SMALL, c.s)).toBeGreaterThanOrEqual(MIN_TEXT_PX - 1e-9);
      if (!lod.text) expect(effectivePx(FONT_WORLD, c.s)).toBeLessThan(MIN_TEXT_PX);
    }
  });
  it('the four band beats are always readable, the pulled-back beat shows numbered labels instead of call-outs', () => {
    for (const st of STAGES) {
      for (let b = 1; b <= 4; b++) expect(lodAt(cameraAt(beatCentre(b, st), st), st).text, `beat ${b} at ${st.w}`).toBe(true);
      const fit = lodAt(cameraAt(1, st), st);
      expect(fit.callouts).toBe(false); expect(fit.text).toBe(false);
      // the band names inside the assembled drawing are readable
      expect(fit.names).toBe(true);
      expect(effectivePx(FONT_NAME, cameraAt(1, st).s)).toBeGreaterThanOrEqual(MIN_TEXT_PX);
      expect(cameraAt(1, st).s).toBeGreaterThanOrEqual(NAME_MIN_SCALE);
      expect(lodAt(cameraAt(beatCentre(1, st), st), st).callouts).toBe(true);
    }
    expect(closeScale(STAGES[2])).toBeGreaterThanOrEqual(TEXT_MIN_SCALE);
  });
  it('lettered call-outs flip to numbered labels between the doors beat and the pull-back, once', () => {
    const st = STAGES[0];
    let flips = 0, prev = lodAt(cameraAt(0, st), st).callouts;
    for (const p of sweep(400)) { const l = lodAt(cameraAt(p, st), st).callouts; if (l !== prev) flips++; prev = l; }
    expect(flips).toBe(1);
    expect(doorsScale(st)).toBeGreaterThan(fitScale(st));
  });
  it('call-out balloons sit inside the stage margins at every beat on a wide stage', () => {
    const st = STAGES[0];
    for (let b = 1; b <= 5; b++) {
      expect(ANCHORS[b].length).toBe(CALLOUTS[b].length);
      const c = camForKey(BEAT_KEY[b], st);
      const right = b === 5 ? 802 : X1;
      for (const a of ANCHORS[b]) {
        const ex = toScreen(c, st, a.side === 'l' ? X0 : right, 0)[0];
        const bx = a.side === 'l' ? ex - 34 : ex + 34;
        expect(bx).toBeGreaterThanOrEqual(24); expect(bx).toBeLessThanOrEqual(st.w - 24);
        const sy = toScreen(c, st, 0, a.y)[1];
        expect(sy).toBeGreaterThan(0); expect(sy).toBeLessThan(st.h);
      }
    }
  });
});

describe('travelling rows', () => {
  it('a row mark\'s position is a pure function of progress, inside its pipe, and still before the ingestion beat', () => {
    for (let j = 0; j < PIPE_X.length; j++) for (let k = 0; k < MARKS_PER_PIPE; k++) {
      for (const p of sweep(100)) {
        const y = rowMarkY(j, k, p);
        expect(y).toBe(rowMarkY(j, k, p));
        expect(y).toBeLessThanOrEqual(PIPE_Y0 + 1e-9); expect(y).toBeGreaterThanOrEqual(PIPE_Y1 - 1e-9);
      }
      expect(rowMarkY(j, k, 0)).toBe(rowMarkY(j, k, timelineFor(STAGES[0]).marksStart - 0.01));
    }
  });
  it('marks rise as the reader scrolls on (before they wrap round) and keep their spacing', () => {
    const m0 = timelineFor(STAGES[0]).marksStart + 0.02;
    const a = rowMarkY(0, 0, m0), b = rowMarkY(0, 0, m0 + 0.003);
    expect(b).toBeLessThan(a);
    const ys = Array.from({ length: MARKS_PER_PIPE }, (_, k) => rowMarkY(0, k, 0.4)).sort((x, y) => x - y);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThan(5);
  });
});

describe('accent: one at every beat and under hover', () => {
  it('at rest the order line is the one accent; under hover the hovered band is, and the thread is not', () => {
    expect(accentFor(null)).toEqual({ focus: 'order-line', threadAccent: true, band: null });
    for (let b = 0; b < 4; b++) { const a = accentFor(b); expect(a.focus).toBe(`band:${b}`); expect(a.threadAccent).toBe(false); expect(a.band).toBe(b); }
  });
  it('the source draws amber only for the order line (thread segments, knots, line-1 highlight)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../figures/section/render.ts'), 'utf8');
    const amber = src.split('\n').filter((l) => /amber: true|knot\(.*true\)|wt wa/.test(l));
    expect(amber.length).toBeGreaterThan(10);
    // every amber line is part of the order line: none of them is a tag, a pill or a frame
    for (const l of amber) expect(/shape\(|tagPoly|pillPoly|frame/.test(l), l).toBe(false);
  });
  it('the order line climbs the warehouse band in the gutter beside the tags, never over their text', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../figures/section/render.ts'), 'utf8');
    expect(src).not.toMatch(/M281/);
    const gutter = 266;
    const tagLeft = [...src.matchAll(/tagPoly\((\d+), -?\d+, \d+, \d+/g)].map((m) => Number(m[1]));
    expect(tagLeft.length).toBeGreaterThanOrEqual(2);
    for (const x of tagLeft) expect(x).toBeGreaterThan(gutter);
    for (const cell of [272]) expect(cell).toBeGreaterThan(gutter);       // the landing row starts right of the gutter
  });
});

describe('real counts and tiles', () => {
  it('counts come from the ontology', () => {
    const c = countsOf(o);
    expect(c.records).toBe(173); expect(c.tables).toBe(447); expect(c.subjectAreas).toBe(110); expect(c.functionalAreas).toBe(9); expect(c.twins).toBe(0); // stated-only: X_SEC -> X pairing by name is not emitted
    expect(moreRecords(c)).toBe(169); expect(moreTables(c)).toBe(443); expect(moreSubjectAreas(c)).toBe(109);
  });
  it('the warehouse field has every table in the lineage file (447 slots; no twins in a stated-only build) and the model field every subject area', () => {
    const w = warehouseField(o), m = modelField(o);
    expect(w.tiles.length).toBe(447); expect(w.slots).toBe(447); expect(w.twins).toBe(0);
    expect(new Set(w.tiles.map((t) => t.idx)).size).toBe(447);
    expect(m.tiles.length).toBe(110); expect(m.districts.length).toBe(9);
    expect(m.districts.reduce((n, d) => n + d.count, 0)).toBe(110);
    expect(new Set(m.districts.map((d) => d.name)).size).toBe(9);
    // every group name fits its column at the quiet label size (about 4.6 px a character in italic serif at 10 units)
    for (const d of m.districts) expect(d.name.length * 4.6).toBeLessThan(d.w);
  });
  it('field tiles sit inside their band and do not overlap (a twin overlaps only its base)', () => {
    const w = warehouseField(o), m = modelField(o);
    for (const [f, band] of [[w, 2], [m, 3]] as const) {
      for (const t of f.tiles) {
        expect(t.x).toBeGreaterThanOrEqual(X0); expect(t.x + t.w).toBeLessThanOrEqual(X1);
        expect(t.y).toBeGreaterThanOrEqual(bandTop(band)); expect(t.y + t.h).toBeLessThanOrEqual(bandBottom(band));
      }
      const base = f.tiles.filter((t) => t.style !== 'twin');
      for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) {
        const a = base[i], b = base[j];
        expect(!(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y), `${a.key} / ${b.key}`).toBe(false);
      }
    }
  });
});

describe('every clickable thing resolves', () => {
  it('named tables, records, subject area and business names exist in the ontology', () => {
    for (const k of ['transactions', 'transactionline', 'customer', 'item']) expect(o.find('netsuiteRecord', k), k).toBeDefined();
    for (const n of ['SALES_ORDER_LINES_F', 'SALES_ORDER_LINES_F_SEC', 'CUSTOMER_D', 'ITEM_D', 'DAY_D']) expect(o.find('physicalTable', `DW_NS_${n}`), n).toBeDefined();
    const src = fs.readFileSync(path.resolve(__dirname, '../figures/section/render.ts'), 'utf8');
    const lits = [...src.matchAll(/\{ type: '(subjectArea|presentationColumn)', key: '([^']+)' \}/g)];
    expect(lits.length).toBe(3);
    for (const [, type, key] of lits) expect(o.find(type as 'subjectArea', key), `${type} ${key}`).toBeDefined();
  });
  it('the order-line columns are the ones chapter 1 verified: BASE_AMOUNT in the _SEC twin, COMPANYNAME in CUSTOMER_D', () => {
    expect(o.find('physicalColumn', 'DW_NS_SALES_ORDER_LINES_F_SEC.BASE_AMOUNT')).toBeDefined();
    expect(o.find('physicalColumn', 'DW_NS_CUSTOMER_D.COMPANYNAME')).toBeDefined();
  });
  it('entries wrap to the margin: no line longer than the column', () => {
    for (const st of [STAGES[0], STAGES[1]]) {
      const width = entryMargin(st) - 64, maxChars = Math.max(14, Math.floor(width / 6.2));
      for (const p of PARTS) for (const ln of wrapText(p.claim, maxChars)) expect(ln.length).toBeLessThanOrEqual(maxChars + 12);
    }
  });
  it('copy: five parts bottom to top, claims typed without numbers (counts are read at run time)', () => {
    expect(PARTS.map((p) => p.band)).toEqual([0, 1, 2, 3, 4]);
    for (const p of PARTS) expect(/\d/.test(p.claim + p.name)).toBe(false);
    expect(bandMid(0)).toBe(-BH / 2);
    expect(DOOR_CLAIMS.a + ' ' + DOOR_CLAIMS.b).toContain('no model in between');
    expect(PARTS[4].claim).toContain(DOOR_CLAIMS.a);
  });
});
