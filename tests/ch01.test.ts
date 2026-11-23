import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Ontology } from '../ontology/load';
import type { CoreJson, DetailJson, NodeType } from '../ontology/types';
import ch01 from '../content/ch01';

const dir = path.resolve(__dirname, '../public/ontology');
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;

let o: Ontology;
beforeAll(() => {
  o = new Ontology(read<CoreJson>('core.json'))
    .attach('columns', read<DetailJson>('columns.json'))
    .attach('usedwith', read<DetailJson>('usedwith.json'));
});

const NOTE_MAX = 60;

describe('chapter 1 content contract', () => {
  it('identity', () => {
    expect(ch01.id).toBe('follow-one-order-line');
    expect(ch01.number).toBe(1);
    expect(ch01.figure).toBe('order-line-journey');
    expect(ch01.illustrativeNote).toBeTruthy();
    expect(ch01.steps.length).toBeGreaterThanOrEqual(7);
    expect(ch01.steps.length).toBeLessThanOrEqual(9);
  });
  it('step ids are unique', () => {
    const ids = ch01.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('figureSteps run 0..N in order', () => {
    expect(ch01.steps.map((s) => s.figureStep)).toEqual(ch01.steps.map((_, i) => i));
  });
  it('margin notes are short ASCII', () => {
    for (const s of ch01.steps) {
      if (s.note === undefined) continue;
      expect(s.note.length, s.id).toBeLessThanOrEqual(NOTE_MAX);
      expect(/^[\x20-\x7E]+$/.test(s.note), `${s.id} note not ASCII`).toBe(true);
    }
  });
  it('every step has a claim heading, 1-3 paragraphs, 1-3 threads', () => {
    for (const s of ch01.steps) {
      expect(s.heading.length, s.id).toBeGreaterThan(10);
      expect(s.body.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.body.length, s.id).toBeLessThanOrEqual(3);
      expect(s.threads?.length ?? 0, s.id).toBeGreaterThanOrEqual(1);
      expect(s.threads!.length, s.id).toBeLessThanOrEqual(3);
    }
  });
  it('callout letters are a, b, c... in order within a step', () => {
    for (const s of ch01.steps) (s.callouts ?? []).forEach((c, i) => expect(c.letter, s.id).toBe('abcdefgh'[i]));
  });
  it('no exclamation marks, no emoji, no em dashes in copy', () => {
    const all = JSON.stringify(ch01);
    expect(all).not.toMatch(/!/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/—/);
  });
  it('inline marks are balanced (backticks, asterisks)', () => {
    for (const s of ch01.steps) {
      const texts = [...s.body, ...(s.callouts ?? []).map((c) => c.text)];
      for (const t of texts) {
        expect((t.match(/`/g) ?? []).length % 2, t).toBe(0);
        expect((t.match(/\*/g) ?? []).length % 2, t).toBe(0);
      }
    }
  });
});

describe('chapter 1 threads resolve in the real ontology', () => {
  const threads = ch01.steps.flatMap((s) => (s.threads ?? []).map((t) => ({ step: s.id, ...t })));
  it('there are threads', () => expect(threads.length).toBeGreaterThanOrEqual(20));
  for (const t of threads) {
    it(`${t.step}: ${t.to.type} ${t.to.key}`, () => {
      expect(o.available(t.to.type as NodeType), `node type ${t.to.type} not loaded`).toBe(true);
      const i = o.find(t.to.type as NodeType, t.to.key);
      expect(i, 'does not resolve').toBeDefined();
      // keys must be written exactly as stored (case included)
      expect(o.key(t.to.type as NodeType, i!), 'key differs from the stored natural key').toBe(t.to.key);
    });
  }
});

describe('chapter 1 numbers quoted in copy match the data', () => {
  const copy = JSON.stringify(ch01);
  const tableOf = (n: string) => o.get('physicalTable', o.find('physicalTable', n)!);

  it('87 fact tables load from Transactions, 65 from TransactionLine (explicit loadedFrom edges)', () => {
    const n = (k: string) => o.neighbors({ type: 'netsuiteRecord', i: o.find('netsuiteRecord', k)! }, 'loadedFrom', 'in');
    expect(n('transactions').length).toBe(87);
    expect(n('transactions').every((x) => x.provenance === 'explicit' && o.get('physicalTable', x.ref.i).role === 'fact')).toBe(true);
    expect(n('transactionline').length).toBe(65);
    expect(copy).toContain('87 fact tables');
    expect(copy).toContain('65 from');
  });
  it('named siblings are among the 87; no DW_NS_TRANSACTIONS table', () => {
    const from = new Set(
      o.neighbors({ type: 'netsuiteRecord', i: o.find('netsuiteRecord', 'transactions')! }, 'loadedFrom', 'in').map((x) => o.get('physicalTable', x.ref.i).name),
    );
    for (const n of ['DW_NS_SALES_ORDER_F', 'DW_NS_CUSTOMER_INVOICE_F', 'DW_NS_CASH_SALE_F', 'DW_NS_JOURNAL_F']) expect(from.has(n), n).toBe(true);
    expect(o.find('physicalTable', 'DW_NS_TRANSACTIONS')).toBeUndefined();
  });
  it('NetSuite - Sales Order: 67 tables (11 fact, 50 dimension), 58 presentation tables, 623 columns, Order to Cash', () => {
    const sa = o.get('subjectArea', o.find('subjectArea', 'NetSuite - Sales Order')!);
    expect([sa.physicalTables, sa.facts, sa.dimensions, sa.presentationColumns]).toEqual([67, 11, 50, 623]);
    expect(67 - 11 - 50).toBe(6);
    expect(copy).toContain('67 warehouse tables: 11 fact tables, 50 dimension tables and six');
    expect(copy).toContain('623 columns');
    const fa = o.neighbors({ type: 'subjectArea', i: o.find('subjectArea', 'NetSuite - Sales Order')! }, 'inFunctionalArea');
    expect(o.get('functionalArea', fa[0].ref.i).name).toBe('Order to Cash');
  });
  it('110 subject areas; CUSTOMER_D in 49; calendar and currency in 108; COMPANYNAME in 48', () => {
    expect(o.count('subjectArea')).toBe(110);
    expect(tableOf('DW_NS_CUSTOMER_D').saCount).toBe(49);
    expect(tableOf('DW_NS_DAY_D').saCount).toBe(108);
    expect(tableOf('DW_NS_CURRENCY_D').saCount).toBe(108);
    expect(o.subjectAreasOfColumn(o.find('physicalColumn', 'DW_NS_CUSTOMER_D.COMPANYNAME')!).length).toBe(48);
    expect(copy).toContain('49 of the 110');
    expect(copy).toContain('108');
  });
  it('the line fact feeds 13 presentation columns in this subject area; amounts come from the _SEC twin', () => {
    const sa = o.find('subjectArea', 'NetSuite - Sales Order')!;
    const inSa = new Set<number>();
    for (const pt of o.neighbors({ type: 'subjectArea', i: sa }, 'contains')) for (const pc of o.neighbors(pt.ref, 'contains')) inSa.add(pc.ref.i);
    const fed = new Set<number>();
    const lf = o.find('physicalTable', 'DW_NS_SALES_ORDER_LINES_F')!;
    for (const c of o.neighbors({ type: 'physicalTable', i: lf }, 'contains'))
      for (const m of o.neighbors({ type: 'physicalColumn', i: c.ref.i }, 'mapsTo', 'in')) if (inSa.has(m.ref.i)) fed.add(m.ref.i);
    expect(fed.size).toBe(13);
    // stated-only build: the _SEC table is flagged secured by its suffix, but no name-paired twin edge is emitted
    const sec = o.find('physicalTable', 'DW_NS_SALES_ORDER_LINES_F_SEC')!;
    expect(o.get('physicalTable', sec).isSecured).toBe(1);
    expect(o.neighbors({ type: 'physicalTable', i: sec }, 'securedVariantOf')).toEqual([]);
    const pc = o.find('presentationColumn', 'NetSuite - Sales Order::Transaction Lines - Base Currency Amounts::Line Amount in Base Currency')!;
    const from = o.neighbors({ type: 'presentationColumn', i: pc }, 'mapsTo').map((m) => o.key('physicalColumn', m.ref.i));
    expect(from).toContain('DW_NS_SALES_ORDER_LINES_F_SEC.BASE_AMOUNT');
    expect(copy).toContain('feeds 13 of them');
  });
  it('explicit source edges used in copy', () => {
    const src = (col: string) =>
      o.neighbors({ type: 'physicalColumn', i: o.find('physicalColumn', col)! }, 'sourcedFrom').map((s) => {
        const f = o.get('netsuiteField', s.ref.i);
        return `${o.get('netsuiteRecord', f.record).name}.${f.name}:${s.provenance}`;
      });
    expect(src('DW_NS_SALES_ORDER_F.TRANID')).toContain('Transactions.tranid:explicit');
    expect(src('DW_NS_SALES_ORDER_LINES_F.CUSTOMER')).toContain('Transactions.entity:explicit');
    expect(src('DW_NS_SALES_ORDER_LINES_F.TRANSACTION')).toContain('TransactionLine.transaction:explicit');
    expect(src('DW_NS_CUSTOMER_D.COMPANYNAME')).toContain('customer.companyname:explicit');
  });
  it('grain keys: Oracle entity key list names accountingbook, transaction, transactionline on the line fact', () => {
    const e = o.get('entity', o.find('entity', 'Sales Order Transaction Accounting Line')!);
    expect(e.keys.map((k) => `${k.t}.${k.c}`).sort()).toEqual([
      'DW_NS_SALES_ORDER_LINES_F.accountingbook',
      'DW_NS_SALES_ORDER_LINES_F.id',
      'DW_NS_SALES_ORDER_LINES_F.transaction',
    ]);
  });
  it('things the copy says are NOT in the lineage file really are not', () => {
    for (const absent of ['SOURCE_RECORD_ID', 'ACCOUNTINGBOOK']) {
      for (const t of ['DW_NS_SALES_ORDER_LINES_F', 'DW_NS_SALES_ORDER_F']) {
        const cols = o.neighbors({ type: 'physicalTable', i: o.find('physicalTable', t)! }, 'contains').map((c) => o.key('physicalColumn', c.ref.i).split('.')[1]);
        expect(cols, `${t}.${absent}`).not.toContain(absent);
      }
    }
    // no source edge names the accounting line record
    expect(o.find('netsuiteRecord', 'transactionaccountingline')).toBeUndefined();
  });
  it('DAY_D has no NetSuite source and is flagged derived', () => {
    const t = o.find('physicalTable', 'DW_NS_DAY_D')!;
    expect(o.neighbors({ type: 'physicalTable', i: t }, 'loadedFrom').length).toBe(0);
    expect(o.get('physicalTable', t).derived).toBe(1);
  });
  it('customer, item, day, accounting book are listed under the Sales Order subject area with the line fact (stated by the lineage, no inferred usedWith)', () => {
    const lf = o.find('physicalTable', 'DW_NS_SALES_ORDER_LINES_F')!;
    expect(o.neighbors({ type: 'physicalTable', i: lf }, 'usedWith', 'out')).toEqual([]);
    expect(o.neighbors({ type: 'physicalTable', i: lf }, 'usedWith', 'in')).toEqual([]);
    const bm = o.busMatrix;
    expect(bm.provenance).toBe('explicit');
    const row = bm.rows.indexOf(o.find('subjectArea', 'NetSuite - Sales Order')!);
    expect(bm.facts[row]).toContain(lf);
    const dims = bm.cells[row].map((c) => o.get('physicalTable', bm.columns[c]).name);
    for (const n of ['DW_NS_CUSTOMER_D', 'DW_NS_ITEM_D', 'DW_NS_DAY_D', 'DW_NS_ACCOUNTINGBOOK_D']) expect(dims, n).toContain(n);
  });
});
