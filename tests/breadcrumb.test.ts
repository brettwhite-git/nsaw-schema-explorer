import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CoreJson, DetailJson } from '../ontology/types';
import { buildColumns, buildCore, type ColumnModel, type CoreModel } from '../explorer/data';
import { crumbsFor } from '../site/components/Breadcrumb';

const root = path.resolve(__dirname, '..');
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(root, 'public/ontology', f), 'utf8')) as T;
let m: CoreModel;
let cm: ColumnModel;
beforeAll(() => { m = buildCore(read<CoreJson>('core.json')); cm = buildColumns(m, read<DetailJson>('columns.json')); });
const labels = (loc: string) => crumbsFor(m, cm, loc).map((c) => c.label);

describe('breadcrumb', () => {
  it('shows only where you are, the last crumb unlinked', () => {
    expect(labels('/')).toEqual(['Matrix']);
    expect(crumbsFor(m, cm, '/')[0].to).toBeUndefined();
    expect(labels('/area/sales-order')).toEqual(['Matrix', 'Sales Order']);
    const t = crumbsFor(m, cm, '/table/DW_NS_SALES_ORDER_LINES_F?area=sales-order');
    expect(t.map((c) => c.label)).toEqual(['Matrix', 'Sales Order', 'Sales Order Lines']);
    expect(t[1].to).toBe('/area/sales-order');
    expect(t[2].to).toBeUndefined();
  });
  it('omits the area crumb without ?area', () => {
    expect(labels('/table/DW_NS_SALES_ORDER_LINES_F')).toEqual(['Matrix', 'Sales Order Lines']);
    expect(labels('/field/customer/companyname')).toEqual(['Matrix', 'customer.companyname']);
  });
  it('a field opened from a table keeps the whole way back', () => {
    const c = crumbsFor(m, cm, '/field/transactions/tranid?from=DW_NS_SALES_ORDER_LINES_F&area=sales-order');
    expect(c.map((x) => x.label)).toEqual(['Matrix', 'Sales Order', 'Sales Order Lines', 'transactions.tranid']);
    expect(c[2].to).toBe('/table/DW_NS_SALES_ORDER_LINES_F?area=sales-order');
  });
  it('never changes with a selection inside a page', () => {
    expect(labels('/?a=sales-order&b=customer-invoice')).toEqual(['Matrix']);
    expect(labels('/area/sales-order?sel=fact:DW_NS_SALES_ORDER_LINES_F&view=grid')).toEqual(['Matrix', 'Sales Order']);
    expect(labels('/table/DW_NS_SALES_ORDER_LINES_F?col=TRANSACTION')).toEqual(labels('/table/DW_NS_SALES_ORDER_LINES_F'));
    expect(labels('/field/transactions/tranid?at=DW_NS_SALES_ORDER_F.TRANID&sa=sales-order')).toEqual(['Matrix', 'transactions.tranid']);
  });
  it('a table named like its area shows its physical name', () => {
    const c = crumbsFor(m, cm, '/table/DW_NS_SALES_ORDER_F?area=sales-order');
    expect(c[2]).toMatchObject({ label: 'DW_NS_SALES_ORDER_F', mono: true });
  });
});
