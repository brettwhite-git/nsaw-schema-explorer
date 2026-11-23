import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CoreJson, DetailJson } from '../ontology/types';
import {
  buildCore, buildColumns, findTable, findField, compare, reach, colOf, grainOf, headerOf, linesOf, grainSentence,
  slug, unslug, prettyTable, matrixColumns, matrixRows, dimensionReach, factsInSameAreas, fmt, plural,
  type CoreModel, type ColumnModel,
} from '../explorer/data';

// Reads the committed build output (npm run ontology).
const dir = path.resolve(__dirname, '../public/ontology');
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;

let m: CoreModel;
let cm: ColumnModel;
beforeAll(() => {
  m = buildCore(read<CoreJson>('core.json'));
  cm = buildColumns(m, read<DetailJson>('columns.json'));
});

const sa = (label: string) => m.subjectAreas.find((s) => s.label === label)!.i;
const tab = (name: string) => findTable(m, name)!;

describe('core model', () => {
  it('110 subject areas in 9 functional areas, every area has one', () => {
    expect(m.subjectAreas.length).toBe(110);
    expect(m.functionalAreas.length).toBe(9);
    expect(m.subjectAreas.every((s) => s.fa >= 0)).toBe(true);
    expect(m.functionalAreas.reduce((a, f) => a + f.subjectAreas.length, 0)).toBe(110);
  });
  it('table lookup is case-insensitive', () => {
    expect(findTable(m, 'dw_ns_customer_d')).toBe(findTable(m, 'DW_NS_CUSTOMER_D'));
    expect(m.tables[tab('DW_NS_SALES_ORDER_LINES_F')].role).toBe('fact');
    expect(m.tables[tab('DW_NS_SALES_ORDER_F_SEC')].isSecured).toBe(true);
  });
});

describe('bus matrix', () => {
  it('Sales Order vs Customer Invoice: 46 both, 4 only A, 2 only B', () => {
    const c = compare(m, sa('Sales Order'), sa('Customer Invoice'));
    expect(c.both.length).toBe(46);
    expect(c.onlyA.length).toBe(4);
    expect(c.onlyB.length).toBe(2);
  });
  it('DW_NS_EMPLOYEE_D is listed under 102 of 110 subject areas', () => {
    const col = colOf(m, tab('DW_NS_EMPLOYEE_D'));
    expect(col).toBeGreaterThanOrEqual(0);
    expect(reach(m, col)).toBe(102);
    const per = dimensionReach(m, col);
    expect(per.reduce((a, p) => a + p.has, 0)).toBe(102);
    expect(per.reduce((a, p) => a + p.total, 0)).toBe(110);
  });
  it('head columns plus bands cover every column once', () => {
    const { head, bands } = matrixColumns(m);
    expect(head.length).toBeGreaterThanOrEqual(29);
    const all = [...head, ...bands.flatMap((b) => b.cols)];
    expect(all.length).toBe(m.bus.columns.length);
    expect(new Set(all).size).toBe(all.length);
  });
  it('rows group by functional area in matrix order', () => {
    const g = matrixRows(m);
    expect(g.reduce((a, x) => a + x.rows.length, 0)).toBe(110);
    expect(new Set(g.map((x) => x.fa)).size).toBe(g.length);
  });
  it('facts in the same areas as Employee are counted per area', () => {
    const fs = factsInSameAreas(m, colOf(m, tab('DW_NS_EMPLOYEE_D')));
    expect(fs.length).toBeGreaterThan(0);
    expect(fs[0].areas).toBeLessThanOrEqual(102);
  });
});

describe('DW_NS_SALES_ORDER_LINES_F', () => {
  it('15 columns, 12 subject areas, 116 report columns', () => {
    const t = tab('DW_NS_SALES_ORDER_LINES_F');
    expect(cm.tableCols[t].length).toBe(15);
    expect(cm.tableSas[t].length).toBe(12);
    expect(cm.tableCols[t].reduce((a, c) => a + cm.physPres[c].length, 0)).toBe(116);
  });
  it('grain: id + transaction first, from the key list', () => {
    const t = tab('DW_NS_SALES_ORDER_LINES_F');
    const g = grainOf(m, t);
    expect(g[0].cols).toEqual(['id', 'transaction']);
    expect(g[0].grain).toBe('line');
    expect(g[0].missing).toEqual([]);
    expect(grainSentence(m, t)).toBe('One row per sales order transaction line.');
  });
  it('header DW_NS_SALES_ORDER_F, linked on transaction', () => {
    const t = tab('DW_NS_SALES_ORDER_LINES_F');
    const h = headerOf(m, t)!;
    expect(m.tables[h.table].name).toBe('DW_NS_SALES_ORDER_F');
    expect(h.col.toLowerCase()).toBe('transaction');
    expect(linesOf(m, h.table)).toContain(t);
  });
  it('a _SEC table borrows no grain or header: only tables the key list names have either', () => {
    const named = new Set(m.entities.flatMap((e) => e.keys.map((k) => k.ti)));
    for (const t of m.tables) {
      if (named.has(t.i)) continue;
      expect(grainOf(m, t.i), t.name).toEqual([]);
      expect(grainSentence(m, t.i), t.name).toBeNull();
      expect(headerOf(m, t.i), t.name).toBeUndefined();
    }
    const s = findTable(m, 'DW_NS_SALES_ORDER_LINES_F_SEC');
    if (s !== undefined && !named.has(s)) expect(grainOf(m, s)).toEqual([]);
  });
});

describe('field traces', () => {
  const trace = (key: string) => {
    const f = findField(cm, key)!;
    const pres = cm.fieldCols[f].reduce((a, c) => a + cm.physPres[c].length, 0);
    return [cm.fieldCols[f].length, pres, cm.fieldSas[f].length];
  };
  it('customer.companyname -> 1 warehouse column, 66 report columns, 48 subject areas', () => expect(trace('customer.companyname')).toEqual([1, 66, 48]));
  it('transactions.tranid -> 66 / 146 / 84', () => expect(trace('transactions.tranid')).toEqual([66, 146, 84]));
  it('field keys are case-insensitive', () => expect(findField(cm, 'CUSTOMER.CompanyName')).toBe(findField(cm, 'customer.companyname')));
});

describe('names', () => {
  it('subject-area slugs are unique and round-trip for all 110', () => {
    const slugs = m.subjectAreas.map((s) => slug(m, s.i));
    expect(new Set(slugs).size).toBe(110);
    for (const s of m.subjectAreas) expect(unslug(m, slug(m, s.i))).toBe(s.i);
    expect(slug(m, sa('Sales Order'))).toBe('sales-order');
    expect(unslug(m, 'Sales Order')).toBe(sa('Sales Order'));
  });
  it('pretty table names', () => {
    expect(prettyTable(m, 'DW_NS_EMPLOYEE_D')).toMatch(/^Employee/);
    expect(prettyTable(m, 'DW_NS_CUSTOMER_D_SEC')).toBe(prettyTable(m, 'DW_NS_CUSTOMER_D'));
  });
  it('fmt and plural', () => {
    expect(fmt(12345)).toBe('12,345');
    expect(plural(1, 'area')).toBe('1 area');
    expect(plural(3, 'entry', 'entries')).toBe('3 entries');
  });
});
