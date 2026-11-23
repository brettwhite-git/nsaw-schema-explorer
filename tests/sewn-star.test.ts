import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Ontology } from '../ontology/load';
import type { CoreJson } from '../ontology/types';
import { finerGrain, nameOverlap, selectStar, UNIVERSAL_SHARE } from '../figures/sewn-star-data';

const dir = path.resolve(__dirname, '../public/ontology');
let o: Ontology;
let oCore: Ontology;
beforeAll(() => {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  oCore = new Ontology(read('core.json') as CoreJson);
  o = new Ontology(read('core.json') as CoreJson).attach('columns', read('columns.json'));
});

describe('sewn star data selection (real ontology)', () => {
  it('"NetSuite - Sales Order" is centred on the line fact, not the header, and Customer and Item are drawn', () => {
    const s = selectStar(o, 'NetSuite - Sales Order')!;
    expect(s.fact!.name).toBe('DW_NS_SALES_ORDER_LINES_F');
    const t = o.get('physicalTable', s.fact!.i);
    expect(t.role).toBe('fact');
    expect(t.isSecured).toBe(0);
    const names = s.dims.map((d) => d.name);
    expect(names).toContain('DW_NS_CUSTOMER_D');
    expect(names).toContain('DW_NS_ITEM_D');
    expect(s.rankedBy).toBe('columns');
  });
  it('the _SEC twin is never the centre; a header fact wins only when no line table matches', () => {
    for (let i = 0; i < o.count('subjectArea'); i++) {
      const s = selectStar(o, o.get('subjectArea', i).name)!;
      if (s.fact) expect(o.get('physicalTable', s.fact.i).isSecured).toBe(0);
    }
    expect(finerGrain('DW_NS_SALES_ORDER_LINES_F')).toBe(1);
    expect(finerGrain('DW_NS_SALES_ORDER_F')).toBe(0);
  });
  it('universal dimensions (90% or more of subject areas) are bundled, not ranked; the rest rank by columns fed here', () => {
    const s = selectStar(o, 'NetSuite - Sales Order')!;
    const n = o.count('subjectArea');
    expect(s.universal.length).toBeGreaterThan(5);
    for (const u of s.universal) expect(u.saCount).toBeGreaterThanOrEqual(UNIVERSAL_SHARE * 110);
    for (const d of s.dims) expect(d.saCount).toBeLessThan(UNIVERSAL_SHARE * 110);
    expect(s.universal.map((u) => u.name)).toEqual(expect.arrayContaining(['DW_NS_DAY_D', 'DW_NS_CURRENCY_D', 'DW_NS_LOCATION_D', 'DW_NS_DEPARTMENT_D']));
    const feeds = s.dims.map((d) => d.feeds);
    expect([...feeds].sort((a, b) => b - a)).toEqual(feeds);
    expect(feeds[0]).toBeGreaterThan(0);
    expect(n).toBe(110);
  });
  it('without columns.json it falls back to how widely shared, and says so', () => {
    const s = selectStar(oCore, 'NetSuite - Sales Order')!;
    expect(s.rankedBy).toBe('shared');
    expect(s.fact!.name).toBe('DW_NS_SALES_ORDER_LINES_F');
  });
  it('a subject area with no fact says so; the smallest and the largest still give sensible counts', () => {
    const all = Array.from({ length: o.count('subjectArea') }, (_, i) => selectStar(o, o.get('subjectArea', i).name)!);
    expect(all.some((s) => s.fact === null)).toBe(true);
    const sizes = all.map((s) => s.totalDims + s.universal.length);
    expect(Math.min(...sizes)).toBeLessThan(Math.max(...sizes));
    const small = all[sizes.indexOf(Math.min(...sizes))];
    expect(small.dims.length).toBeLessThanOrEqual(small.totalDims);
  });
  it('caps the non-universal dimensions at 8 and counts what is not drawn', () => {
    const s = selectStar(o, 'NetSuite - Sales Order')!;
    expect(s.dims).toHaveLength(8);
    expect(s.dims.length + s.notDrawn).toBe(s.totalDims);
    expect(new Set(s.dims.map((d) => d.i)).size).toBe(8);
    for (const d of s.dims) expect(o.get('physicalTable', d.i).role).toBe('dimension');
  });
  it('every drawn dimension really co-occurs with a fact in this subject area (bus matrix cell)', () => {
    const s = selectStar(o, 'NetSuite - Sales Order')!;
    const bm = o.busMatrix;
    const row = bm.rows.indexOf(s.subjectArea.i);
    const inRow = new Set(bm.cells[row].map((ci) => bm.columns[ci]));
    for (const d of s.dims) expect(inRow.has(d.i)).toBe(true);
  });
  it('a larger cap draws more and says less is missing', () => {
    const s = selectStar(o, 'NetSuite - Sales Order', 12)!;
    expect(s.dims).toHaveLength(12);
    expect(s.dims.length + s.notDrawn).toBe(s.totalDims);
  });
  it('a cap above the total draws everything and reports 0 not drawn', () => {
    const s = selectStar(o, 'NetSuite - Sales Order', 999)!;
    expect(s.notDrawn).toBe(0);
    expect(s.dims).toHaveLength(s.totalDims);
  });
  it('an unknown subject area is undefined; every real one has consistent counts', () => {
    expect(selectStar(o, 'No such subject area')).toBeUndefined();
    for (let i = 0; i < o.count('subjectArea'); i++) {
      const s = selectStar(o, o.get('subjectArea', i).name)!;
      expect(s.dims.length).toBeLessThanOrEqual(8);
      expect(s.dims.length + s.notDrawn).toBe(s.totalDims);
    }
  });
  it('name overlap: at least half of the label tokens', () => {
    expect(nameOverlap('Sales Order', 'DW_NS_SALES_ORDER_F')).toBe(1);
    expect(nameOverlap('Sales Order', 'DW_NS_CUSTOMER_D')).toBe(0);
    expect(nameOverlap('Sales Order', 'DW_NS_ORDER_FULFILLMENT_LINES_EF')).toBe(0.5);
  });
});
