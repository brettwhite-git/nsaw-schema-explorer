import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Ontology } from '../ontology/load';
import type { CoreJson, DetailJson } from '../ontology/types';
import { parsePhysicalTableType, isSecuredTable } from '../types';

// Reads the committed build output. Run `npm run ontology` after changing sources.
const dir = path.resolve(__dirname, '../public/ontology');
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;

let o: Ontology;
beforeAll(() => {
  o = new Ontology(read<CoreJson>('core.json'))
    .attach('columns', read<DetailJson>('columns.json'))
    .attach('usedwith', read<DetailJson>('usedwith.json'));
});

describe('ontology counts', () => {
  it('subject areas', () => expect(o.count('subjectArea')).toBe(110));
  it('DW_NS physical tables in the lineage CSV', () => {
    expect(o.core.meta.counts.physicalTablesInLineage).toBe(447);
    const lineage = Array.from({ length: o.count('physicalTable') }, (_, i) => o.get('physicalTable', i)).filter((t) => t.src & 1);
    expect(lineage.length).toBe(447);
  });
  it('physical (table, column) pairs in the lineage CSV', () => expect(o.core.meta.counts.physicalColumnsInLineage).toBe(6641));
  it('stated-only: no concept layer (merging presentation tables by name is inferred); tables carry their own name', () => {
    expect(o.core.meta.statedOnly).toBe(true);
    expect(o.available('concept')).toBe(false);
    expect(o.core.meta.counts.concepts).toBeUndefined();
    expect(o.core.meta.counts.conceptsWithDwNsLineage).toBeUndefined();
    expect(o.count('presentationTable')).toBe(3698);
    const names = new Set(Array.from({ length: o.count('presentationTable') }, (_, i) => o.get('presentationTable', i).name));
    expect(names.size).toBe(398); // distinct presentation-table names, stated by the lineage file
  });
  it('explicit source edges: 2,410 NetSuite -> DW column edges (+364 NSAW_DERIVED columns = the 2,774 workbook rows)', () => {
    expect(o.core.meta.counts.explicitSourceEdges).toBe(2410);
    expect(o.core.meta.counts.derivedColumnsFlagged).toBe(364);
    expect(2410 + 364).toBe(2774);
    const groups = o.edgeGroups('sourcedFrom');
    expect(groups.length).toBe(1);
    expect(groups[0].provenance).toBe('explicit');
    expect(groups[0].n).toBe(2410);
  });
  it('stated-only: NetSuite records and fields are only the ones the workbook names', () => {
    expect(o.count('netsuiteRecord')).toBe(173);
    expect(o.core.meta.counts.explicitNetsuiteRecords).toBe(173);
    expect(o.count('netsuiteField')).toBe(1222);
    for (let i = 0; i < o.count('netsuiteRecord'); i++) expect(o.get('netsuiteRecord', i).explicit).toBe(1);
    for (let i = 0; i < o.count('netsuiteField'); i++) expect(o.get('netsuiteField', i).explicit).toBe(1);
    const lf = o.edgeGroups('loadedFrom');
    expect(lf.length).toBe(1);
    expect(lf[0].provenance).toBe('explicit');
    expect(lf[0].n).toBe(328);
  });
  it('stated-only: no edge group is inferred, and no mixed group holds an inferred code', () => {
    const inferred = o.core.meta.provenanceCodes.indexOf('inferred');
    for (const g of o.edgeGroups()) {
      expect(g.provenance, g.type).not.toBe('inferred');
      if (g.provenance === 'mixed') expect(g.prov!.includes(inferred), g.type).toBe(false);
    }
    for (const t of ['instanceOf', 'securedVariantOf', 'entityOf', 'readsFrom', 'usedWith'] as const) expect(o.edgeGroups(t), t).toEqual([]);
    expect(o.busMatrix.provenance).toBe('explicit');
    expect(o.busMatrix.saPairs).toBeUndefined();
    for (let i = 0; i < o.count('physicalTable'); i++) expect(o.get('physicalTable', i).baseTable).toBe(-1);
  });
  it('only NaN rows are dropped; SQL-derived and alias rows are kept', () => {
    const ing = o.core.meta.ingest;
    expect(ing.nanRowsDropped).toBe(120);
    expect(ing.dwNsRows).toBe(50536);
    expect(ing.dwNsRows + ing.sqlRows + ing.aliasRows + ing.nanRowsDropped).toBe(ing.csvRows);
    expect(o.count('sqlSource')).toBe(10);
  });
  it('every edge group carries a provenance', () => {
    for (const g of o.edgeGroups()) {
      expect(['explicit', 'inferred', 'curated', 'mixed']).toContain(g.provenance);
      if (g.provenance === 'mixed') expect(g.prov!.length).toBe(g.n);
      expect(g.pairs.length).toBe(g.n * 2);
    }
  });
});

describe('physical table roles', () => {
  it('_SEC no longer masks the type', () => {
    expect(parsePhysicalTableType('DW_NS_SALES_ORDER_F_SEC')).toBe('fact');
    expect(parsePhysicalTableType('DW_NS_CUSTOMER_D_SEC')).toBe('dimension');
    expect(parsePhysicalTableType('DW_NS_X_EF_SEC')).toBe('enhanced');
    expect(parsePhysicalTableType('DW_NS_FOO_SEC')).toBe('security');
    expect(isSecuredTable('DW_NS_SALES_ORDER_F_SEC')).toBe(true);
    expect(isSecuredTable('DW_NS_SALES_ORDER_F')).toBe(false);
  });
  it('suffix rules', () => {
    expect(parsePhysicalTableType('DW_NS_ACCOUNT_CF_DH')).toBe('hierarchy');
    expect(parsePhysicalTableType('DW_NS_ACCOUNT_DH')).toBe('hierarchy');
    expect(parsePhysicalTableType('DW_NS_PROCUREMENT_SPEND_CF')).toBe('calculated');
    expect(parsePhysicalTableType('DW_NS_ISSUE_CASE_MAP_G')).toBe('global');
    expect(parsePhysicalTableType('DW_NS_X_P')).toBe('prediction');
  });
  it('187 secured tables, and none is labelled "security" any more', () => {
    const tables = Array.from({ length: o.count('physicalTable') }, (_, i) => o.get('physicalTable', i));
    const secured = tables.filter((t) => t.isSecured);
    expect(secured.length).toBe(187);
    expect(secured.every((t) => t.name.endsWith('_SEC'))).toBe(true);
    expect(tables.filter((t) => t.role === 'security').length).toBe(0);
    expect(secured.filter((t) => t.role === 'fact').length).toBeGreaterThan(100);
  });
  it('derived is one definition: flagged column OR isNsawGeneratedTable, rule recorded', () => {
    const day = o.find('physicalTable', 'DW_NS_DAY_D');
    const t = Array.from({ length: o.count('physicalTable') }, (_, i) => o.get('physicalTable', i));
    for (const x of t) {
      if (x.derived) expect(['pattern', 'both']).toContain(x.derivedRule);
      if (x.derivedRule === 'flagged-columns') expect(x.derived).toBe(0);
    }
    expect(t.some((x) => x.derivedRule === 'flagged-columns')).toBe(true);
    void day;
  });
});

describe('known trace: customer.companyname -> DW_NS_CUSTOMER_D.COMPANYNAME -> "Customer Company Name"', () => {
  it('resolves explicitly through the whole chain', () => {
    const col = o.find('physicalColumn', 'DW_NS_CUSTOMER_D.COMPANYNAME')!;
    expect(col).toBeDefined();

    const src = o.neighbors({ type: 'physicalColumn', i: col }, 'sourcedFrom');
    expect(src.length).toBe(1);
    expect(src[0].provenance).toBe('explicit');
    const field = o.get('netsuiteField', src[0].ref.i);
    expect(field.name).toBe('companyname');
    expect(o.get('netsuiteRecord', field.record).name).toBe('customer');

    const pcs = o.neighbors({ type: 'physicalColumn', i: col }, 'mapsTo', 'in');
    const named = pcs.filter((n) => o.get('presentationColumn', n.ref.i).name === 'Customer Company Name');
    expect(named.every((n) => n.provenance === 'explicit')).toBe(true);
    const sas = new Set(named.map((n) => o.get('presentationTable', o.get('presentationColumn', n.ref.i).pt).sa));
    expect(sas.size).toBeGreaterThanOrEqual(45);
    expect(sas.size).toBeLessThanOrEqual(52);
    expect(o.subjectAreasOfColumn(col).length).toBeGreaterThanOrEqual(sas.size);
  });
  it('record summary reflects reach', () => {
    const r = o.find('netsuiteRecord', 'customer')!;
    const n = o.get('netsuiteRecord', r);
    expect(n.explicit).toBe(1);
    expect(n.saReachExplicit).toBeGreaterThan(40);
  });
});

describe('bus matrix', () => {
  it('is rectangular and consistent', () => {
    const b = o.busMatrix;
    expect(b.rows.length).toBe(110);
    expect(b.cells.length).toBe(110);
    expect(b.columns.length).toBe(b.columnSaCount.length);
    for (const row of b.cells) for (const c of row) expect(c).toBeLessThan(b.columns.length);
    b.columns.forEach((t, c) => {
      expect(o.get('physicalTable', t).role).toBe('dimension');
      expect(b.cells.filter((r) => r.includes(c)).length).toBe(b.columnSaCount[c]);
    });
  });
});
