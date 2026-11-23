// A tiny relational engine for teaching figures.
// Every operation returns { table, trace }. The trace is an ordered list of steps a figure can animate
// row by row: which input row matched which, which rows fell into which group, the running totals.
// Tables are small in-memory arrays. Nothing here touches the ontology.

export type Value = string | number | null;
export type Row = Record<string, Value>;

export interface Table {
  name: string;
  columns: string[];
  rows: Row[];
}

export interface Predicate {
  /** human text for the figure, e.g. "order_date in March 2026" */
  label: string;
  test: (row: Row) => boolean;
}

// ------------------------------------------------------------------ trace steps
export type Step =
  | { op: 'scan'; table: string; row: number }
  | { op: 'filter'; predicate: string; row: number; kept: boolean }
  | { op: 'build'; key: Value; buildRow: number; bucketSize: number }
  | { op: 'probe'; key: Value; probeRow: number; matches: number[]; outcome: 'matched' | 'kicked-out' | 'kept-unmatched' }
  | { op: 'emit'; probeRow: number; buildRow: number | null; outRow: number }
  | { op: 'group'; groupKey: string; row: number; created: boolean; count: number; sums: Record<string, number> }
  | { op: 'emit-group'; groupKey: string; outRow: number; count: number; sums: Record<string, number> }
  | { op: 'project'; row: number; outRow: number };

export interface Result {
  table: Table;
  trace: Step[];
}

const round2 = (x: number) => Math.round(x * 100) / 100;

// ------------------------------------------------------------------ operations
export function scan(t: Table): Result {
  return { table: { ...t, rows: t.rows.map((r) => ({ ...r })) }, trace: t.rows.map((_, row) => ({ op: 'scan', table: t.name, row })) };
}

export function filter(t: Table, p: Predicate): Result {
  const trace: Step[] = [];
  const rows: Row[] = [];
  t.rows.forEach((r, row) => {
    const kept = p.test(r);
    trace.push({ op: 'filter', predicate: p.label, row, kept });
    if (kept) rows.push({ ...r });
  });
  return { table: { name: `${t.name} where ${p.label}`, columns: t.columns, rows }, trace };
}

/**
 * Hash join. The build side is hashed first (one 'build' step per row), then the probe side streams through.
 * inner: unmatched probe rows are kicked out. left: unmatched probe rows are kept with nulls for the build columns.
 * Output columns: probe columns, then build columns (build key column dropped; name clashes get the build table name prefix).
 * Row indexes in steps refer to the input tables' rows; emit steps carry the output row index.
 */
export function hashJoin(
  probe: Table,
  build: Table,
  probeKey: string,
  buildKey: string,
  kind: 'inner' | 'left' = 'inner',
): Result {
  const trace: Step[] = [];
  const hash = new Map<Value, number[]>();
  build.rows.forEach((r, i) => {
    const k = r[buildKey];
    const bucket = hash.get(k) ?? [];
    bucket.push(i);
    hash.set(k, bucket);
    trace.push({ op: 'build', key: k, buildRow: i, bucketSize: bucket.length });
  });

  const buildCols = build.columns.filter((c) => c !== buildKey);
  const outName = (c: string) => (probe.columns.includes(c) ? `${build.name}.${c}` : c);
  const columns = [...probe.columns, ...buildCols.map(outName)];
  const rows: Row[] = [];

  probe.rows.forEach((pr, i) => {
    const matches = hash.get(pr[probeKey]) ?? [];
    const outcome = matches.length ? 'matched' : kind === 'inner' ? 'kicked-out' : 'kept-unmatched';
    trace.push({ op: 'probe', key: pr[probeKey], probeRow: i, matches: [...matches], outcome });
    if (matches.length) {
      for (const b of matches) {
        const out: Row = { ...pr };
        for (const c of buildCols) out[outName(c)] = build.rows[b][c];
        rows.push(out);
        trace.push({ op: 'emit', probeRow: i, buildRow: b, outRow: rows.length - 1 });
      }
    } else if (kind === 'left') {
      const out: Row = { ...pr };
      for (const c of buildCols) out[outName(c)] = null;
      rows.push(out);
      trace.push({ op: 'emit', probeRow: i, buildRow: null, outRow: rows.length - 1 });
    }
  });

  return { table: { name: `${probe.name} join ${build.name}`, columns, rows }, trace };
}

export interface Aggregate {
  /** 'sum' needs a numeric column; 'count' counts rows in the group */
  fn: 'sum' | 'count';
  column?: string;
  as: string;
}

/**
 * Group by one or more columns with sum/count. Groups come out in order of first appearance.
 * Each input row yields a 'group' step with the running totals AFTER adding that row.
 */
export function groupBy(t: Table, by: string[], aggs: Aggregate[]): Result {
  const trace: Step[] = [];
  const groups = new Map<string, { keys: Row; count: number; sums: Record<string, number> }>();
  t.rows.forEach((r, row) => {
    const gk = by.map((c) => String(r[c])).join(' | ');
    let g = groups.get(gk);
    const created = !g;
    if (!g) {
      g = { keys: Object.fromEntries(by.map((c) => [c, r[c]])), count: 0, sums: Object.fromEntries(aggs.filter((a) => a.fn === 'sum').map((a) => [a.as, 0])) };
      groups.set(gk, g);
    }
    g.count++;
    for (const a of aggs) {
      if (a.fn === 'sum') {
        const v = r[a.column!];
        if (typeof v !== 'number') throw new TypeError(`sum(${a.column}) needs numbers, got ${String(v)} at row ${row}`);
        g.sums[a.as] = round2(g.sums[a.as] + v);
      }
    }
    trace.push({ op: 'group', groupKey: gk, row, created, count: g.count, sums: { ...g.sums } });
  });

  const rows: Row[] = [];
  for (const [gk, g] of groups) {
    const out: Row = { ...g.keys };
    for (const a of aggs) out[a.as] = a.fn === 'count' ? g.count : g.sums[a.as];
    rows.push(out);
    trace.push({ op: 'emit-group', groupKey: gk, outRow: rows.length - 1, count: g.count, sums: { ...g.sums } });
  }
  return { table: { name: `${t.name} grouped by ${by.join(', ')}`, columns: [...by, ...aggs.map((a) => a.as)], rows }, trace };
}

export function project(t: Table, columns: string[]): Result {
  const trace: Step[] = [];
  const rows = t.rows.map((r, row) => {
    trace.push({ op: 'project', row, outRow: row });
    return Object.fromEntries(columns.map((c) => [c, r[c]])) as Row;
  });
  return { table: { name: t.name, columns, rows }, trace };
}

/** Run operations in sequence, feeding each result table to the next and concatenating traces (tagged by stage). */
export function pipeline(start: Table, stages: Array<{ name: string; run: (t: Table) => Result }>) {
  const out: { stage: string; table: Table; trace: Step[] }[] = [];
  let cur = start;
  for (const s of stages) {
    const r = s.run(cur);
    out.push({ stage: s.name, table: r.table, trace: r.trace });
    cur = r.table;
  }
  return { table: cur, stages: out };
}

// predicate helpers
export const eq = (col: string, v: Value): Predicate => ({ label: `${col} = ${v}`, test: (r) => r[col] === v });
export const between = (col: string, lo: string | number, hi: string | number, label?: string): Predicate => ({
  label: label ?? `${col} between ${lo} and ${hi}`,
  test: (r) => (r[col] as string | number) >= lo && (r[col] as string | number) <= hi,
});

// ------------------------------------------------------------------ worked example (ILLUSTRATIVE DATA, not from the NetSuite dataset)
// Assumptions: order numbers, item names, customer names and dates are invented. Fixed by the brief:
// customer 88 lines 1,240.00 + 310.50 (= 1,550.50); customer 41 lines 96.00 and 2,075.00; orders SO1041,
// SO1057, SO1063, SO1070; one line for customer 93 with no customer row. Chosen by us: SO1041 holds both of
// customer 88's lines, SO1057 and SO1063 are customer 41's, SO1070 is customer 93's single line (480.00);
// all five lines are dated March 2026 so the date filter keeps them all.
export const ILLUSTRATIVE = true;

export const customers: Table = {
  name: 'customers',
  columns: ['customer_id', 'customer_name'],
  rows: [
    { customer_id: 88, customer_name: 'Harbor Supply Co.' },
    { customer_id: 41, customer_name: 'Ridgeline Outfitters' },
  ],
};

export const orderLines: Table = {
  name: 'order_lines',
  columns: ['line_id', 'order_no', 'customer_id', 'item', 'order_date', 'amount'],
  rows: [
    { line_id: 1, order_no: 'SO1041', customer_id: 88, item: 'Pallet jack', order_date: '2026-03-04', amount: 1240.0 },
    { line_id: 2, order_no: 'SO1041', customer_id: 88, item: 'Shrink wrap', order_date: '2026-03-04', amount: 310.5 },
    { line_id: 3, order_no: 'SO1057', customer_id: 41, item: 'Work gloves', order_date: '2026-03-11', amount: 96.0 },
    { line_id: 4, order_no: 'SO1063', customer_id: 41, item: 'Forklift battery', order_date: '2026-03-18', amount: 2075.0 },
    { line_id: 5, order_no: 'SO1070', customer_id: 93, item: 'Label printer', order_date: '2026-03-25', amount: 480.0 },
  ],
};

export const march2026: Predicate = between('order_date', '2026-03-01', '2026-03-31', 'order_date in March 2026');

/** The figure's full run: scan lines -> filter March -> inner join customers -> group by customer, sum(amount). */
export function runWorkedExample() {
  return pipeline(orderLines, [
    { name: 'scan', run: scan },
    { name: 'filter', run: (t) => filter(t, march2026) },
    { name: 'join', run: (t) => hashJoin(t, customers, 'customer_id', 'customer_id', 'inner') },
    { name: 'group', run: (t) => groupBy(t, ['customer_id', 'customer_name'], [{ fn: 'sum', column: 'amount', as: 'total' }, { fn: 'count', as: 'lines' }]) },
  ]);
}
