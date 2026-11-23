import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import type { CoreJson } from '../ontology/types';
import { buildCore, findTable, hasModel, inModel, modelArea, modelCounts, modelFactsOf, modelRelations, type CoreModel } from '../explorer/data';

// Reads the committed build output (npm run ontology) and the diagram extract it was built from.
const root = path.resolve(__dirname, '..');
const core = JSON.parse(fs.readFileSync(path.join(root, 'public/ontology/core.json'), 'utf8')) as CoreJson;
const rows = Papa.parse<{ area: string; fact: string; related: string }>(
  fs.readFileSync(path.join(root, 'data-src/nsaw_data_model_edges.csv'), 'utf8'), { header: true, skipEmptyLines: true },
).data;

let m: CoreModel;
beforeAll(() => { m = buildCore(core); });
const tab = (name: string) => findTable(m, name)!;

describe('relatesTo edges (Oracle NSAW Data Models diagrams)', () => {
  it('one explicit group, one edge per matched row', () => {
    const groups = core.edges.filter((g) => g.type === 'relatesTo');
    expect(groups.length).toBe(1);
    expect(groups[0].provenance).toBe('explicit');
    expect(groups[0].from).toBe('physicalTable');
    expect(groups[0].to).toBe('physicalTable');
    const matched = rows.filter((r) => findTable(m, r.fact) !== undefined && findTable(m, r.related) !== undefined).length;
    expect(groups[0].n).toBe(matched);
    expect(core.meta.dataModels!.matchedRows).toBe(matched);
    expect(matched + core.meta.dataModels!.unmatchedRows).toBe(rows.length);
    expect(modelCounts(m).relations).toBe(matched);
  });
  it('unmatched names are reported, not added as nodes', () => {
    const dm = core.meta.dataModels!;
    expect(dm.unmatchedFacts).toEqual(['DW_NS_ITEM_RECEIPT_INVENTORYASSIGNMENT_EF', 'DW_NS_PURCHASE_ORDER_INVENTORYASSIGNMENT_EF', 'DW_NS_SALESTEAM_CONTRIBUTION_TRXN_LINES_CF']); // gate:allow (table names, not a secret)
    expect(dm.unmatchedRelated).toEqual(['DW_NS_CASH_SALES_LINES_F', 'DW_NS_salesRole_D']);
    for (const n of [...dm.unmatchedFacts, ...dm.unmatchedRelated]) expect(findTable(m, n), n).toBeUndefined();
  });
  it('DW_NS_SALES_ORDER_LINES_F relates to 26 tables, among them a fact', () => {
    const t = tab('DW_NS_SALES_ORDER_LINES_F');
    expect(hasModel(m, t)).toBe(true);
    expect(modelArea(m, t)).not.toBe('');
    const rel = modelRelations(m, t);
    expect(rel.length).toBe(26);
    const names = rel.map((r) => r.name.toUpperCase());
    for (const n of ['DW_NS_ITEM_D', 'DW_NS_ENTITY_D', 'DW_NS_SUBSIDIARY_D', 'DW_NS_SALES_ORDER_NEXT_LINK_F']) expect(names, n).toContain(n);
    expect(rel.find((r) => r.name === 'DW_NS_SALES_ORDER_NEXT_LINK_F')!.isFact).toBe(true);
    for (let k = 1; k < rel.length; k++) {
      const a = rel[k - 1], b = rel[k];
      expect(a.reach > b.reach || (a.reach === b.reach && a.name.localeCompare(b.name) <= 0)).toBe(true);
    }
  });
  it('DW_NS_SUBSIDIARY_D: 185 diagrams draw it, 182 of their facts are tables in the ontology', () => {
    expect(rows.filter((r) => r.related.toLowerCase() === 'dw_ns_subsidiary_d').length).toBe(185);
    const s = tab('DW_NS_SUBSIDIARY_D');
    expect(inModel(m, s)).toBe(true);
    expect(hasModel(m, s)).toBe(false);
    expect(modelFactsOf(m, s).length).toBe(182);
  });
});
