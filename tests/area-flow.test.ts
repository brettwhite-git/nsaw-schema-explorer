import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CoreJson } from '../ontology/types';
import {
  areaFlow, areaNeighbours, areasOfTable, buildCore, findTable, flowTable, hasModel, unslug, type CoreModel,
} from '../explorer/data';

const root = path.resolve(__dirname, '..');
const core = JSON.parse(fs.readFileSync(path.join(root, 'public/ontology/core.json'), 'utf8')) as CoreJson;
let m: CoreModel;
beforeAll(() => { m = buildCore(core); });
const sa = (slug: string) => unslug(m, slug)!;

describe('areaFlow', () => {
  it('Sales Order: 11 listed, 4 drawn, 33 related, 18 shared', () => {
    const f = areaFlow(m, sa('sales-order'));
    expect(f.listed).toBe(11);
    expect(f.facts.length).toBe(4);
    expect(f.tables.length).toBe(33);
    expect(f.shared).toBe(18);
    expect(f.others.length).toBe(7);
    expect(f.facts.map((x) => x.name)).toContain('DW_NS_SALES_ORDER_LINES_F');
  });
  it('Revenue Recognition: 39 listed, 16 drawn, 58 related, 32 shared', () => {
    const f = areaFlow(m, sa('order-to-cash-revenue-recognition'));
    expect([f.listed, f.facts.length, f.tables.length, f.shared]).toEqual([39, 16, 58, 32]);
    expect(f.facts.length + f.others.length).toBe(f.listed);
  });
  it('tables are ordered most facts first and indexed', () => {
    const f = areaFlow(m, sa('sales-order'));
    f.tables.forEach((d, i) => {
      expect(d.i).toBe(i);
      if (i > 0) expect(f.tables[i - 1].facts.length).toBeGreaterThanOrEqual(d.facts.length);
    });
    const cur = flowTable(f, findTable(m, 'DW_NS_CURRENCY_D')!)!;
    expect(cur.facts.length).toBe(4);
    expect(f.tables[0].facts.length).toBe(4);
  });
  it('every relation of every drawn fact is in the flow, and the counts agree', () => {
    for (const s of m.subjectAreas) {
      const f = areaFlow(m, s.i);
      let edges = 0;
      for (const x of f.facts) { expect(hasModel(m, x.table)).toBe(true); edges += x.rels.length; }
      expect(f.tables.reduce((n, d) => n + d.facts.length, 0)).toBe(edges);
      for (const t of f.others) expect(hasModel(m, t)).toBe(false);
    }
  });
  it('is cached per model and area', () => {
    expect(areaFlow(m, sa('sales-order'))).toBe(areaFlow(m, sa('sales-order')));
  });
});

describe('areasOfTable and areaNeighbours', () => {
  it('a fact lists the areas the bus matrix lists it under', () => {
    const t = findTable(m, 'DW_NS_SALES_ORDER_LINES_F')!;
    const as = areasOfTable(m, t);
    expect(as).toContain(sa('sales-order'));
    for (const x of as) expect(m.factsOfSa[x].includes(t) || m.rowSets[m.subjectAreas[x].row].has(m.tables[t].col)).toBe(true);
  });
  it('a shared dimension lists every area whose row has its column', () => {
    const t = findTable(m, 'DW_NS_CURRENCY_D')!;
    expect(areasOfTable(m, t).length).toBe(m.bus.columnSaCount[m.tables[t].col]);
  });
  it('neighbours sit in the same functional area', () => {
    const s = sa('sales-order');
    const { prev, next } = areaNeighbours(m, s);
    for (const x of [prev, next]) if (x !== null) expect(m.subjectAreas[x].fa).toBe(m.subjectAreas[s].fa);
    expect(prev !== null || next !== null).toBe(true);
  });
});
