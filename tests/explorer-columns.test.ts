import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CoreJson, DetailJson } from '../ontology/types';
import {
  buildCore, buildColumns, findTable, traceField, ledgerRows, reportFoldersReading, buildSearchIndex, extendSearchIndex,
  search, parseQuery, serializeQuery, areaSummary, tableSummary,
  type CoreModel, type ColumnModel, type SearchIndex,
} from '../explorer/data';

// Reads the committed build output (npm run ontology).
const dir = path.resolve(__dirname, '../public/ontology');
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;

let m: CoreModel;
let cm: ColumnModel;
let idx: SearchIndex;
beforeAll(() => {
  m = buildCore(read<CoreJson>('core.json'));
  cm = buildColumns(m, read<DetailJson>('columns.json'));
  idx = extendSearchIndex(buildSearchIndex(m), cm);
});
const tab = (name: string) => findTable(m, name)!;
const sa = (label: string) => m.subjectAreas.find((s) => s.label === label)!.i;

describe('impact trace', () => {
  it('customer.companyname: 1 warehouse column, 66 report columns, 48 subject areas in 6 of 9 functional areas', () => {
    const tr = traceField(m, cm, 'customer.companyname')!;
    expect(tr.totals).toEqual({ warehouseColumns: 1, reportColumns: 66, subjectAreas: 48, functionalAreas: 6, functionalAreasAll: 9 });
    expect(tr.functionalAreas.reduce((a, g) => a + g.areas.length, 0)).toBe(48);
    expect(tr.functionalAreas.flatMap((g) => g.areas).reduce((a, x) => a + x.reportColumns, 0)).toBe(66);
  });
  it('transactions.tranid: 66 / 146 / 84 in 8 of 9, facts first', () => {
    const tr = traceField(m, cm, 'Transactions.TranId')!;
    expect(tr.totals.warehouseColumns).toBe(66);
    expect(tr.totals.reportColumns).toBe(146);
    expect(tr.totals.subjectAreas).toBe(84);
    expect(tr.totals.functionalAreas).toBe(8);
    expect(tr.groups[0].role).toBe('fact');
    expect(tr.groups.reduce((a, g) => a + g.columns.length, 0)).toBe(66);
  });
  it('an unknown field gives null', () => {
    expect(traceField(m, cm, 'nope.nothing')).toBeNull();
  });
});

describe('table ledger', () => {
  it('DW_NS_SALES_ORDER_LINES_F: 15 rows, all stated, TRANSACTION is key and to header, 116 report columns, 12 areas', () => {
    const L = ledgerRows(m, cm, tab('DW_NS_SALES_ORDER_LINES_F'));
    expect(L.rows.length).toBe(15);
    expect(L.summary.withSource).toBe(15);
    expect(L.summary.reportColumns).toBe(116);
    expect(L.summary.subjectAreas).toBe(12);
    const tr = L.rows.find((r) => r.name.toUpperCase() === 'TRANSACTION')!;
    expect(tr.isKey).toBe(true);
    expect(tr.toHeader).toBe(true);
    expect(L.rows.filter((r) => r.toHeader).length).toBe(1);
    expect(L.rows[0].isKey).toBe(true);
    expect(L.rows.every((r) => r.sources.every((s) => cm.fieldByKey.has(s.key)))).toBe(true);
  });
  it('DW_NS_SALES_ORDER_LINES_F_SEC: 45 rows, no stated source, no grain, no header', () => {
    const t = tab('DW_NS_SALES_ORDER_LINES_F_SEC');
    const L = ledgerRows(m, cm, t);
    expect(L.rows.length).toBe(45);
    expect(L.summary.withSource).toBe(0);
    expect(L.fields).toEqual([]);
    expect(L.rows.some((r) => r.isKey || r.toHeader)).toBe(false);
    const s = tableSummary(m, cm, t);
    expect(s.grain).toEqual([]);
    expect(s.grainSentence).toBeNull();
    expect(s.header).toBeNull();
  });
});

describe('search', () => {
  it('grain:line type:fact order ranks DW_NS_SALES_ORDER_LINES_F first', () => {
    const r = search(idx, 'grain:line type:fact order', { limit: 5 });
    expect(r.results[0].kind).toBe('table');
    expect(r.results[0].label).toBe('DW_NS_SALES_ORDER_LINES_F');
    expect(r.results.length).toBe(5);
    expect(r.total).toBeGreaterThan(5);
  });
  it('exact table name and subject area rank first; tables above columns', () => {
    expect(search(idx, 'DW_NS_CUSTOMER_D').results[0].label).toBe('DW_NS_CUSTOMER_D');
    expect(search(idx, 'sales order').results[0]).toMatchObject({ kind: 'area', label: 'Sales Order' });
    expect(search(idx, 'is:field customer.companyname').results[0].label.toLowerCase()).toBe('customer.companyname');
    expect(search(idx, 'is:table customer').results.every((x) => x.kind === 'table')).toBe(true);
  });
  it('the core-only index already finds tables and areas', () => {
    const core = buildSearchIndex(m);
    expect(core.extended).toBe(false);
    expect(search(core, 'grain:line type:fact order').results[0].label).toBe('DW_NS_SALES_ORDER_LINES_F');
    expect(search(core, 'is:column transaction').total).toBe(0);
  });
  it('area and shared filters', () => {
    const r = search(idx, 'area:"Order to Cash" is:area');
    expect(r.total).toBeGreaterThan(0);
    const fa = m.functionalAreas.find((f) => f.name === 'Order to Cash');
    if (fa) expect(r.results.every((x) => fa.subjectAreas.includes(x.sa!))).toBe(true);
    expect(search(idx, 'shared:yes is:table customer').results.every((x) => x.reach >= 2)).toBe(true);
  });
  it('query chips round-trip', () => {
    for (const q of ['grain:line type:fact order', 'area:"Order to Cash" is:table customer', 'shared:yes  in:"Sales Order"   memo', 'foo:bar plain text', '']) {
      const p = parseQuery(q);
      expect(parseQuery(serializeQuery(p))).toEqual(p);
    }
    expect(parseQuery('area:"Order to Cash" item')).toEqual({ text: 'item', chips: [{ k: 'area', v: 'Order to Cash' }] });
    expect(serializeQuery({ text: 'item', chips: [{ k: 'area', v: 'Order to Cash' }] })).toBe('area:"Order to Cash" item');
  });
});

describe('area and table summaries', () => {
  it('Sales Order lists DW_NS_SALES_ORDER_LINES_F among its facts, with its grain', () => {
    const a = areaSummary(m, cm, sa('Sales Order'));
    const f = a.facts.find((x) => x.name === 'DW_NS_SALES_ORDER_LINES_F')!;
    expect(f).toBeDefined();
    expect(f.grain).toBe('One row per sales order transaction line.');
    expect(f.key).toEqual(['id', 'transaction']);
    expect(a.dimensions.length).toBe(50);
    expect(a.folders.length).toBeGreaterThan(0);
    expect(a.tablesRead.length).toBeGreaterThan(0);
    expect(areaSummary(m, null, sa('Sales Order')).tablesRead).toEqual([]);
  });
  it('DW_NS_EMPLOYEE_D: reach 102, report folders led by Created By User (82 areas)', () => {
    const s = tableSummary(m, cm, tab('DW_NS_EMPLOYEE_D'));
    expect(s.role).toBe('dimension');
    expect(s.dimension!.reach).toBe(102);
    expect(s.dimension!.folders[0]).toMatchObject({ name: 'Created By User', areas: 82 });
    expect(s.dimension!.facts.length).toBeGreaterThan(0);
    expect(reportFoldersReading(m, cm, tab('DW_NS_EMPLOYEE_D'), [sa('Sales Order')]).every((x) => x.areas === 1)).toBe(true);
  });
  it('a fact ranks dimension tables by how many of its areas list them', () => {
    const s = tableSummary(m, cm, tab('DW_NS_SALES_ORDER_LINES_F'));
    expect(s.fact!.areas.length).toBeGreaterThan(0);
    const ws = s.fact!.dimensions.map((d) => d.areas);
    expect(ws).toEqual([...ws].sort((a, b) => b - a));
    expect(s.header && m.tables[s.header.table].name).toBe('DW_NS_SALES_ORDER_F');
    expect(s.records.length).toBeGreaterThan(0);
    expect(s.readBy!.reduce((a, g) => a + g.areas.length, 0)).toBe(12);
  });
});
