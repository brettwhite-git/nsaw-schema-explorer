import { describe, it, expect } from 'vitest';
import { customers, filter, groupBy, hashJoin, march2026, orderLines, project, runWorkedExample, scan, ILLUSTRATIVE } from '../ontology/engine';

describe('relational engine, worked example (illustrative data)', () => {
  it('is flagged illustrative', () => expect(ILLUSTRATIVE).toBe(true));

  it('customer 88 sums to 1,550.50 and customer 41 to 2,171.00', () => {
    const { table } = runWorkedExample();
    const by = Object.fromEntries(table.rows.map((r) => [r.customer_id, r]));
    expect(by[88].total).toBe(1550.5);
    expect(by[88].lines).toBe(2);
    expect(by[41].total).toBe(2171);
    expect(by[93]).toBeUndefined();
  });

  it('the customer-93 line is kicked out of the inner join, with a probe step that says so', () => {
    const j = hashJoin(filter(orderLines, march2026).table, customers, 'customer_id', 'customer_id', 'inner');
    expect(j.table.rows.length).toBe(4);
    const kicked = j.trace.filter((s) => s.op === 'probe' && s.outcome === 'kicked-out');
    expect(kicked.length).toBe(1);
    expect(kicked[0]).toMatchObject({ op: 'probe', key: 93, matches: [] });
    expect(j.table.rows.some((r) => r.customer_id === 93)).toBe(false);
  });

  it('a left join keeps the unmatched line with nulls', () => {
    const j = hashJoin(orderLines, customers, 'customer_id', 'customer_id', 'left');
    const r93 = j.table.rows.find((r) => r.customer_id === 93)!;
    expect(r93.customer_name).toBeNull();
    expect(j.table.rows.length).toBe(5);
  });

  it('order numbers are the four from the brief', () => {
    expect([...new Set(orderLines.rows.map((r) => r.order_no))].sort()).toEqual(['SO1041', 'SO1057', 'SO1063', 'SO1070']);
  });

  it('group-by trace carries running totals row by row', () => {
    const j = hashJoin(orderLines, customers, 'customer_id', 'customer_id').table;
    const g = groupBy(j, ['customer_id'], [{ fn: 'sum', column: 'amount', as: 'total' }]);
    const steps = g.trace.filter((s) => s.op === 'group' && s.groupKey === '88');
    expect(steps.map((s) => (s as { sums: Record<string, number> }).sums.total)).toEqual([1240, 1550.5]);
    expect(g.trace.filter((s) => s.op === 'emit-group').length).toBe(2);
  });

  it('scan, filter and project trace every row', () => {
    expect(scan(orderLines).trace.length).toBe(5);
    const f = filter(orderLines, { label: 'amount > 1000', test: (r) => (r.amount as number) > 1000 });
    expect(f.trace.filter((s) => s.op === 'filter' && s.kept).length).toBe(2);
    expect(project(orderLines, ['order_no']).table.rows[0]).toEqual({ order_no: 'SO1041' });
  });
});
