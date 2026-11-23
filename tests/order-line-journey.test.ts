import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Ontology } from '../ontology/load';
import type { CoreJson, DetailJson, NodeType } from '../ontology/types';
import ch01 from '../content/ch01';
import { bboxOf, buildSpec, WIDE_MIN } from '../figures/order-line-journey/layout';
import {
  FOCUS_BY_STEP, STEPS, STEP_COUNT, accentIds, breakLabel, focusOf, itemsAt, type Item, type LineItem, type Prov, type Spec,
} from '../figures/order-line-journey/model';
import { BUDGET_MS, schedule } from '../figures/order-line-journey/schedule';

const dir = path.resolve(__dirname, '../public/ontology');
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;
let o: Ontology;
beforeAll(() => {
  o = new Ontology(read<CoreJson>('core.json')).attach('columns', read<DetailJson>('columns.json')).attach('usedwith', read<DetailJson>('usedwith.json'));
});

const WIDTHS = [546, 620, 700];          // wide: the sticky column at 1440, the design width, a tablet
const PHONES = [309, 280];                // phone: 375 px viewport, the narrowest
const specs: Record<number, Spec> = {};
specs[720] = buildSpec(720);
for (const w of [...WIDTHS, ...PHONES]) specs[w] = buildSpec(w);
const byId = (s: Spec): Map<string, Item> => new Map(s.items.map((i) => [i.id, i]));
const lines = (s: Spec): LineItem[] => s.items.filter((i): i is LineItem => i.k === 'line');

describe('layouts', () => {
  it('wide from 540 px, phone below', () => {
    expect(WIDE_MIN).toBe(540);
    for (const w of WIDTHS) expect(specs[w].layout).toBe('wide');
    for (const w of PHONES) expect(specs[w].layout).toBe('phone');
  });
  it('is pure: same width, same spec', () => {
    expect(JSON.stringify(buildSpec(546))).toBe(JSON.stringify(buildSpec(546)));
  });
  it('wide and phone are the same figure: same ids, same steps, same accents, same provenance', () => {
    const ref = byId(specs[546]);
    for (const w of [620, 309, 280]) {
      const other = byId(specs[w]);
      expect([...other.keys()].sort()).toEqual([...ref.keys()].sort());
      for (const [id, a] of ref) {
        const b = other.get(id)!;
        expect(b.k, `${id} kind at ${w}`).toBe(a.k);
        expect(b.step, `${id} step at ${w}`).toBe(a.step);
        expect(b.acc ?? [], `${id} accent at ${w}`).toEqual(a.acc ?? []);
        expect(b.ref ?? null, `${id} ref at ${w}`).toEqual(a.ref ?? null);
        if (a.k === 'line') expect((b as LineItem).prov, `${id} provenance at ${w}`).toBe(a.prov);
      }
    }
  });
  it('every item has finite geometry inside the drawing', () => {
    for (const w of [...WIDTHS, ...PHONES]) {
      const s = specs[w];
      for (const it of s.items) {
        const b = bboxOf(it);
        if (!b) continue;
        for (const n of b) expect(Number.isFinite(n), `${it.id} at ${w}`).toBe(true);
        if (it.k === 'callout') continue;
        expect(b[0], `${it.id} left at ${w}`).toBeGreaterThanOrEqual(-1);
        expect(b[2], `${it.id} right at ${w}`).toBeLessThanOrEqual(s.W + 2);
        expect(b[1], `${it.id} top at ${w}`).toBeGreaterThanOrEqual(-1);
        expect(b[3], `${it.id} bottom at ${w}`).toBeLessThanOrEqual(s.H + 2);
      }
    }
  });
  it('the main shapes never overlap each other', () => {
    for (const w of [...WIDTHS, ...PHONES]) {
      const shapes = specs[w].items.filter((i) => ['form', 'rec', 'tag', 'hex', 'pill'].includes(i.k) || i.id === 'report' || i.id === 'srcid');
      for (let a = 0; a < shapes.length; a++) {
        for (let b = a + 1; b < shapes.length; b++) {
          const p = bboxOf(shapes[a])!, q = bboxOf(shapes[b])!;
          const hit = p[0] < q[2] - 0.5 && q[0] < p[2] - 0.5 && p[1] < q[3] - 0.5 && q[1] < p[3] - 0.5;
          expect(hit, `${shapes[a].id} overlaps ${shapes[b].id} at width ${w}`).toBe(false);
        }
      }
    }
  });
});

describe('the eight states', () => {
  it('has 8 steps, in step with the chapter copy', () => {
    expect(STEP_COUNT).toBe(8);
    expect(STEPS.length).toBe(8);
    expect(ch01.steps.map((s) => s.figureStep)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const s of STEPS) { expect(s.caption.length).toBeGreaterThan(10); expect(s.alt.length).toBeGreaterThan(40); }
  });
  it('exactly one accent group per step, and it is a real, distinct group', () => {
    expect(FOCUS_BY_STEP.length).toBe(8);
    expect(new Set(FOCUS_BY_STEP).size).toBe(8);
    for (let s = 0; s < 8; s++) expect(focusOf(s)).toBe(FOCUS_BY_STEP[s]);
    const s = specs[546];
    const valid = new Set<string>(FOCUS_BY_STEP);
    for (const it of s.items) for (const f of it.acc ?? []) expect(valid.has(f), `${it.id}: ${f}`).toBe(true);
    for (let step = 0; step < 8; step++) {
      const ids = accentIds(s.items, step);
      expect(ids.length, `nothing carries the accent at step ${step}`).toBeGreaterThan(0);
      // the group is introduced at its own step: something new is lit
      const present = new Set(itemsAt(s.items, step).map((i) => i.id));
      expect(ids.every((id) => present.has(id))).toBe(true);
      expect(ids.some((id) => byId(s).get(id)!.step === step), `step ${step} lights nothing new`).toBe(true);
    }
  });
  it('the accent follows the storyboard', () => {
    const s = specs[546];
    const at = (n: number) => new Set(accentIds(s.items, n));
    expect(at(0).has('ul-form-1') && at(0).has('stub')).toBe(true);
    expect(at(1).has('rec-1') && at(1).has('t1')).toBe(true);
    expect(at(2).has('tag-L') && at(2).has('thr-L')).toBe(true);
    expect(at(3).has('tag-L') && at(3).has('rowbox') && at(3).has('drawer-L')).toBe(true);
    expect(at(4).has('ul-id') && at(4).has('ul-tx') && at(4).has('book-col') && at(4).has('srcid')).toBe(true);
    expect(at(4).has('tag-L')).toBe(false);          // the line tag returns to ink
    expect(at(5).has('rec-0') && at(5).has('x87') && at(5).has('fan-1') && at(5).has('thr-F')).toBe(true);
    expect(at(6).has('pill-1') && at(6).has('thr-p1')).toBe(true);
    expect(at(6).has('pill-2') || at(6).has('pill-3')).toBe(false);
    // the final state is ONE thing: the return thread from the report number back to line 1 (table values stay ink)
    expect([...at(7)].sort()).toEqual(['bk-p3', 'bk-t1', 'bk-t2', 'bk-twin', 'rep-cell', 'rep-num', 'rep-p3', 'stub', 'ul-form-1']);
    for (const id of ['drawer-L', 'strip-L', 'rowbox', 'row-3', 'drawer-sec', 'ul-base-1', 'ul-base-2', 'ul-form-2', 'bk-t1r2']) expect(at(7).has(id), id).toBe(false);
  });
  it('the accent at every step is ONE connected thing (a thread, or one element with what it touches), not several', () => {
    for (const w of [546, 720, 309]) {
      const s = specs[w] ?? (specs[w] = buildSpec(w));
      for (let step = 0; step < 8; step++) {
        const present = itemsAt(s.items, step);
        const lit = new Set(accentIds(s.items, step));
        const A = present.filter((i) => lit.has(i.id));
        const shapes = present.filter((i) => !lit.has(i.id) && ['form', 'rec', 'tag', 'hex', 'pill', 'table', 'box', 'ghost'].includes(i.k));
        const touch = (a: Item, b: Item, pad: number) => {
          const p = bboxOf(a)!, q = bboxOf(b)!;
          return p[0] - pad < q[2] && q[0] - pad < p[2] && p[1] - pad < q[3] && q[1] - pad < p[3];
        };
        // clusters of unlit shapes that touch each other (a table with its strips, a tag with its drawer)
        const cl = shapes.map((_, i) => i);
        const find = (i: number): number => (cl[i] === i ? i : (cl[i] = find(cl[i])));
        for (let a = 0; a < shapes.length; a++) for (let b = a + 1; b < shapes.length; b++) if (touch(shapes[a], shapes[b], 2)) cl[find(a)] = find(b);
        const nodes = A.length + shapes.length;
        const adj = Array.from({ length: nodes }, () => [] as number[]);
        const link = (i: number, j: number) => { adj[i].push(j); adj[j].push(i); };
        for (let a = 0; a < A.length; a++) {
          for (let b = a + 1; b < A.length; b++) if (touch(A[a], A[b], 3)) link(a, b);
          for (let c = 0; c < shapes.length; c++) if (touch(A[a], shapes[c], 3)) link(a, A.length + c);
        }
        for (let a = 0; a < shapes.length; a++) for (let b = a + 1; b < shapes.length; b++) if (find(a) === find(b)) link(A.length + a, A.length + b);
        const seen = new Set<number>([0]);
        const stack = [0];
        while (stack.length) for (const n of adj[stack.pop()!]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
        const lost = A.filter((_, i) => !seen.has(i)).map((i) => i.id);
        expect(A.length, `step ${step} lights nothing at ${w}`).toBeGreaterThan(0);
        expect(lost, `step ${step} at ${w}: accent is not one connected thing`).toEqual([]);
      }
    }
  });
  it('things introduced step by step, as the storyboard says', () => {
    const m = byId(specs[546]);
    const expectStep: Record<string, number> = {
      form: 0, 'ul-form-1': 0, stub: 0,
      spine: 1, 'tick-0': 1, 'tick-4': 1, 'rec-0': 1, 'rec-1': 1, 'rec-2': 1, 'rec-3': 1, 'rec-4': 1, t1: 1, legend: 1,
      'thr-F': 2, 'tag-F': 2, 'thr-L': 2, 'tag-L': 2, 'thr-C': 2, 'tag-C': 2, 'strip-F': 2, 'strip-L': 2, 'strip-C': 2,
      'drawer-L': 3, rowbox: 3, 'lnk-C': 3, 'lnk-I': 3, 'lnk-D': 3, 'thr-I': 3, 'tag-I': 3, 'strip-I': 3, 'hex-D': 3,
      'ul-id': 4, 'ul-tx': 4, 'book-col': 4, 'ghost-row': 4, invented: 4, 'lnk-B': 4, 'tag-B': 4, srcid: 4, 'lead-src': 4,
      'gh-1': 5, 'gh-2': 5, 'gh-3': 5, 'fan-1': 5, 'fan-3': 5, x87: 5, x65: 5,
      'lnk-sec': 6, 'tag-sec': 6, 'drawer-sec': 6, head: 6, 'pill-1': 6, 'pill-2': 6, 'pill-3': 6, 'thr-p1': 6, 'thr-p3': 6,
      report: 7, 'rep-cell': 7, 'rep-p2': 7, 'rep-p3': 7, 'row-3': 7, 'bk-t2': 7, 'ul-form-2': 7,
    };
    for (const [id, step] of Object.entries(expectStep)) expect(m.get(id)?.step, id).toBe(step);
  });
  it('elements only accumulate: step N shows everything from steps 0 to N (callouts excepted)', () => {
    const s = specs[546];
    let prev = new Set<string>();
    for (let n = 0; n < 8; n++) {
      const now = new Set(itemsAt(s.items, n).filter((i) => !i.scoped).map((i) => i.id));
      for (const id of prev) expect(now.has(id), `${id} vanished at step ${n}`).toBe(true);
      expect(now.size, `step ${n} adds nothing`).toBeGreaterThan(prev.size);
      prev = now;
    }
  });
  it('callouts are scoped to their step and match the letters in the chapter copy', () => {
    const s = specs[546];
    for (const step of ch01.steps) {
      const want = (step.callouts ?? []).map((c) => c.letter);
      const got = s.items.filter((i) => i.k === 'callout' && i.step === step.figureStep).map((i) => (i as { letter: string }).letter).sort();
      expect(got, step.id).toEqual(want);
      for (const it of itemsAt(s.items, step.figureStep)) if (it.k === 'callout') expect(it.step).toBe(step.figureStep);
    }
  });
  it('draw order inside a step is defined, and every transition fits the 1.8 s budget when scaled', () => {
    for (const w of [546, 309]) {
      const s = specs[w];
      for (let n = 0; n < 8; n++) {
        const added = s.items.filter((i) => i.step === n);
        expect(added.length).toBeGreaterThan(0);
        for (const it of added) expect(Number.isInteger(it.ord) && it.ord >= 0, it.id).toBe(true);
        const { total } = schedule(added);
        expect(total / Math.max(1, Math.min(1, BUDGET_MS / total)) * Math.min(1, BUDGET_MS / total)).toBeLessThanOrEqual(BUDGET_MS + 1);
        // never squeezed below 40% of nominal speed
        expect(BUDGET_MS / total, `step ${n} is too long to scale`).toBeGreaterThan(0.4);
      }
    }
  });
  it('captions are the storyboard lines', () => {
    expect(STEPS[0].caption).toBe('One sales order as typed. Invented for the example.');
    expect(STEPS[2].caption).toBe('Rows land in tables named for what they hold. Table names drop the DW_NS_ prefix.');
    expect(STEPS[7].caption).toBe('The number, and the way back to the form. Values invented; the path is real.');
    expect(specs[546].captions.length).toBe(8);
  });
});

describe('provenance: the line says where the fact came from', () => {
  const expected: Record<string, Prov> = {
    // explicit: the data states it
    'thr-F': 'explicit', 'thr-L': 'explicit', 'thr-C': 'explicit', 'thr-I': 'explicit',
    'fan-1': 'explicit', 'fan-2': 'explicit', 'fan-3': 'explicit',
    'thr-p1': 'explicit', 'thr-p2': 'explicit', 'thr-p3': 'explicit', 'bk-p3': 'explicit', 'bk-t2': 'explicit',
    // inferred: stitched thread
    'lnk-C': 'inferred', 'lnk-I': 'inferred', 'lnk-D': 'inferred', 'lnk-B': 'inferred', 'lnk-sec': 'inferred', 'bk-twin': 'inferred',
    // illustrative: pencil
    stub: 'illustrative', spine: 'illustrative', 't1': 'illustrative', 'tick-0': 'illustrative', 'tick-1': 'illustrative', 'tick-2': 'illustrative',
    'tick-3': 'illustrative', 'tick-4': 'illustrative', 'lead-src': 'illustrative', 'rep-p2': 'illustrative', 'rep-p3': 'illustrative',
    'bk-t1': 'illustrative', 'bk-t1r2': 'illustrative',
  };
  it('every connection uses exactly one of the three styles, as the storyboard assigns it', () => {
    for (const w of [546, 309]) {
      const m = byId(specs[w]);
      for (const [id, prov] of Object.entries(expected)) expect((m.get(id) as LineItem).prov, `${id} at ${w}`).toBe(prov);
      for (const l of lines(specs[w])) expect(['explicit', 'inferred', 'illustrative']).toContain(l.prov);
    }
  });
  it('every fact-to-dimension link, the _SEC twin and the book link are stitched (inferred); nothing stitched is explicit', () => {
    const inferred = lines(specs[546]).filter((l) => l.prov === 'inferred' && !l.overlayOf).map((l) => l.id).sort();
    expect(inferred).toEqual(['lnk-B', 'lnk-C', 'lnk-D', 'lnk-I', 'lnk-sec']);
  });
  it('what Oracle documents and the lineage file does not contain is pencil, with its label', () => {
    const m = byId(specs[546]);
    expect((m.get('rec-2') as { pencil?: boolean }).pencil).toBe(true);          // transactionaccountingline
    expect((m.get('srcid') as { pencil?: boolean }).pencil).toBe(true);          // SOURCE_RECORD_ID
    expect((m.get('report') as { pencil?: boolean }).pencil).toBe(true);
    expect((m.get('rep-cell') as { pencil?: boolean }).pencil).toBe(true);
    const book = m.get('book-col') as { cols: { pencil?: boolean }[] };
    expect(book.cols.every((c) => c.pencil)).toBe(true);
    const ghost = m.get('ghost-row') as { rows: { pencil?: boolean }[] };
    expect(ghost.rows.every((r) => r.pencil)).toBe(true);
    expect(m.get('invented')).toBeDefined();
    expect((m.get('srcid') as { texts: { t: string }[] }).texts.map((t) => t.t)).toEqual(['SOURCE_RECORD_ID', '5120 | 1 | 1']);
    expect(['srcid-note-0', 'srcid-note-1'].some((id) => m.has(id))).toBe(true);
  });
  it('the backward thread keeps the style of each segment it covers', () => {
    const m = byId(specs[546]);
    for (const [over, under] of [['bk-p3', 'thr-p3'], ['bk-twin', 'lnk-sec'], ['bk-t2', 'thr-L'], ['bk-t1', 't1']] as const) {
      expect((m.get(over) as LineItem).overlayOf).toBe(under);
      expect((m.get(over) as LineItem).prov).toBe((m.get(under) as LineItem).prov);
    }
  });
});

describe('labels', () => {
  it('warehouse tags drop DW_NS_ and keep the full name', () => {
    for (const it of specs[546].items) {
      if (it.k !== 'tag') continue;
      expect(it.full.startsWith('DW_NS_')).toBe(true);
      expect(it.lines.join('')).toBe(it.full.replace(/^DW_NS_/, ''));
    }
  });
  it('the two-line label breaks as the storyboard says', () => {
    expect(breakLabel('SALES_ORDER_LINES_F_SEC')).toEqual(['SALES_ORDER_', 'LINES_F_SEC']);
    expect(breakLabel('SALES_ORDER_LINES_F')).toEqual(['SALES_ORDER_', 'LINES_F']);
    const tag = specs[546].items.find((i) => i.id === 'tag-sec');
    expect(tag && tag.k === 'tag' && tag.lines).toEqual(['SALES_ORDER_', 'LINES_F_SEC']);
  });
  it('hovers point at things that exist', () => {
    for (const w of [546, 309]) {
      const s = specs[w];
      const ids = new Set(s.items.map((i) => i.id));
      for (const [k, h] of Object.entries(s.hovers)) {
        for (const id of h.lit) expect(ids.has(id), `${k} lights ${id} at ${w}`).toBe(true);
        for (const t of h.tips ?? []) { expect(t.fromStep).toBeGreaterThanOrEqual(0); expect(t.fromStep).toBeLessThan(8); expect(t.tip.lines.length).toBeGreaterThan(0); }
      }
      const keys = new Set<string>();
      for (const it of s.items) {
        if (it.hk) keys.add(it.hk);
        if (it.k === 'table') { it.cols.forEach((c) => c.hk && keys.add(c.hk)); it.rows.forEach((r) => r.cells.forEach((c) => c.hk && keys.add(c.hk))); }
      }
      for (const k of keys) expect(s.hovers[k], `hover key ${k} at ${w}`).toBeDefined();
    }
  });
});

describe('every clickable tag opens an Atlas page that exists', () => {
  const clickable = specs[546].items.filter((i) => i.ref);
  it('there are clickable tags for every table, record and pill the storyboard names', () => {
    const keys = new Set(clickable.map((i) => `${i.ref!.type}:${i.ref!.key}`));
    for (const k of [
      'netsuiteRecord:transactions', 'netsuiteRecord:transactionline', 'netsuiteRecord:customer', 'netsuiteRecord:item',
      'entity:Sales Order Transaction Accounting Line',
      'physicalTable:DW_NS_SALES_ORDER_F', 'physicalTable:DW_NS_SALES_ORDER_LINES_F', 'physicalTable:DW_NS_CUSTOMER_D', 'physicalTable:DW_NS_ITEM_D',
      'physicalTable:DW_NS_DAY_D', 'physicalTable:DW_NS_ACCOUNTINGBOOK_D', 'physicalTable:DW_NS_SALES_ORDER_LINES_F_SEC',
      'presentationColumn:NetSuite - Sales Order::Customer::Customer Company Name',
      'presentationColumn:NetSuite - Sales Order::Transaction Lines - Base Currency Amounts::Line Amount in Base Currency',
      'subjectArea:NetSuite - Sales Order',
    ]) expect(keys.has(k), k).toBe(true);
  });
  it('reuses refs that chapter 1 already links to', () => {
    const chapter = new Set(ch01.steps.flatMap((s) => (s.threads ?? []).map((t) => `${t.to.type}:${t.to.key}`)));
    const mine = new Set(clickable.map((i) => `${i.ref!.type}:${i.ref!.key}`));
    for (const k of ['netsuiteRecord:transactions', 'netsuiteRecord:transactionline', 'netsuiteRecord:customer', 'physicalTable:DW_NS_SALES_ORDER_F',
      'physicalTable:DW_NS_SALES_ORDER_LINES_F', 'physicalTable:DW_NS_CUSTOMER_D', 'physicalTable:DW_NS_ITEM_D', 'physicalTable:DW_NS_DAY_D',
      'physicalTable:DW_NS_ACCOUNTINGBOOK_D', 'physicalTable:DW_NS_SALES_ORDER_LINES_F_SEC', 'entity:Sales Order Transaction Accounting Line', 'subjectArea:NetSuite - Sales Order',
      'presentationColumn:NetSuite - Sales Order::Customer::Customer Company Name'])
      expect(chapter.has(k) && mine.has(k), k).toBe(true);
  });
  for (const w of [546, 309]) {
    for (const it of buildSpec(w).items.filter((i) => i.ref)) {
      it_(w, it);
    }
  }
  function it_(w: number, item: Item) {
    it(`${item.id} at ${w}: ${item.ref!.type} ${item.ref!.key}`, () => {
      const r = item.ref!;
      expect(o.available(r.type as NodeType), `node type ${r.type} not loaded`).toBe(true);
      const i = o.find(r.type as NodeType, r.key);
      expect(i, 'does not resolve').toBeDefined();
      expect(o.key(r.type as NodeType, i!), 'key differs from the stored natural key').toBe(r.key);
    });
  }
});
