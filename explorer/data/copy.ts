// Sentence builders for the explorer. The copy rule: say what the data shows. When the data is absent a builder
// returns null and the page leaves that line out. No builder narrates a gap. tests/copy-rule.test.ts enforces it.

import { grainOf, headerOf, keyOrder, linesOf } from './grain';
import { compare, reach } from './matrix';
import { fieldLabel } from './model';
import { fmt, plural } from './names';
import type { ColumnModel, CoreModel, GrainEntry } from './types';

// grainSentence ("One row per sales order transaction line.") lives in ./grain.

const list = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** "Stated in Oracle's Entity Key List as Sales Order Transaction Line." */
export function keySourceSentence(m: CoreModel, t: number): string | null {
  const g = grainOf(m, t)[0];
  return g ? `Stated in Oracle’s Entity Key List as ${g.entity}.` : null;
}

/** "The key list also names Sales Order Transaction Accounting Line, keyed by accountingbook + id + transaction." */
export function alsoKeyedSentence(g: GrainEntry): string {
  return `The key list also names ${g.entity}, keyed by ${keyOrder(g.cols).join(' + ')}.`;
}

/** One sentence per further key-list entry of a table (after the leading one). */
export const alsoKeyedSentences = (m: CoreModel, t: number): string[] => grainOf(m, t).slice(1).map(alsoKeyedSentence);

/** "Each row points to its header in DW_NS_SALES_ORDER_F: TRANSACTION here holds the header's ID." */
export function headerSentence(m: CoreModel, t: number): string | null {
  const h = headerOf(m, t);
  return h ? `Each row points to its header in ${m.tables[h.table].name}: ${h.col.toUpperCase()} here holds the header’s ID.` : null;
}

/** "Its lines live in DW_NS_SALES_ORDER_LINES_F, which points back through TRANSACTION." */
export function linesSentence(m: CoreModel, t: number): string | null {
  const ls = linesOf(m, t);
  if (!ls.length) return null;
  const col = (headerOf(m, ls[0])?.col ?? 'transaction').toUpperCase();
  return `Its lines live in ${list(ls.map((l) => m.tables[l].name))}, which ${ls.length === 1 ? 'points' : 'point'} back through ${col}.`;
}

/** "Oracle's Entity Key List gives one key, SalesOrdTransactions_id in Sales Order Transactions, to id in the header and to transaction in this table." */
export function headerKeySentence(m: CoreModel, t: number): string | null {
  const h = headerOf(m, t);
  return h ? `Oracle’s Entity Key List gives one key, ${h.key} in ${h.entity}, to id in the header and to ${h.col.toLowerCase()} in this table.` : null;
}

/** "Listed under 102 of 110 subject areas." */
export function reachSentence(m: CoreModel, col: number): string | null {
  const n = reach(m, col);
  return n ? `Listed under ${fmt(n)} of ${fmt(m.subjectAreas.length)} subject areas.` : null;
}

/** "Oracle's lineage lists 6 dimensions under only one of the two. The other 46 are listed under both." */
export function compareSentence(m: CoreModel, saA: number, saB: number): string | null {
  const c = compare(m, saA, saB);
  const nDiff = c.onlyA.length + c.onlyB.length;
  if (!nDiff && !c.both.length) return null;
  if (!nDiff) return `Oracle’s lineage lists the same ${plural(c.both.length, 'dimension')} under both areas.`;
  const lead = `Oracle’s lineage lists ${plural(nDiff, 'dimension')} under only one of the two.`;
  return c.both.length ? `${lead} The other ${fmt(c.both.length)} ${c.both.length === 1 ? 'is' : 'are'} listed under both.` : lead;
}

/** "Oracle's Entity Key List states the grain of 3 of its 5 fact tables." */
export function areaGrainSentence(m: CoreModel, sa: number): string | null {
  const facts = m.factsOfSa[sa];
  const n = facts.filter((t) => grainOf(m, t).length).length;
  if (!n) return null;
  return n === facts.length
    ? `Oracle’s Entity Key List states the grain of ${facts.length === 1 ? 'its fact table' : `all ${fmt(n)} of its fact tables`}.`
    : `Oracle’s Entity Key List states the grain of ${fmt(n)} of its ${plural(facts.length, 'fact table')}.`;
}

// ------------------------------------------------------------------ column level

/** "Oracle's lineage names a NetSuite source for all 15 columns." / "… for 12 of the 15 columns." */
export function sourceCoverageSentence(cm: ColumnModel, t: number): string | null {
  const cols = cm.tableCols[t];
  const n = cols.filter((c) => cm.colSrc[c].length).length;
  if (!n) return null;
  if (n === cols.length) return cols.length === 1 ? 'Oracle’s lineage names the NetSuite source of its one column.' : `Oracle’s lineage names a NetSuite source for all ${fmt(n)} columns.`;
  return `Oracle’s lineage names a NetSuite source for ${fmt(n)} of the ${plural(cols.length, 'column')}.`;
}

/** "Read in 12 subject areas through 116 report columns." */
export function tableReadSentence(cm: ColumnModel, t: number): string | null {
  const sas = cm.tableSas[t].length;
  if (!sas) return null;
  const nPres = cm.tableCols[t].reduce((a, c) => a + cm.physPres[c].length, 0);
  return `Read in ${plural(sas, 'subject area')} through ${plural(nPres, 'report column')}.`;
}

/** "66 report columns named Customer Company Name, in 48 subject areas." */
export function columnReadSentence(cm: ColumnModel, c: number): string | null {
  const pres = cm.physPres[c];
  if (!pres.length) return null;
  const names = new Set(pres.map((p) => cm.prcName[p]));
  const named = names.size === 1 ? ` named ${[...names][0]}` : ` under ${plural(names.size, 'name')}`;
  return `${plural(pres.length, 'report column')}${named}, in ${plural(cm.colSas[c].length, 'subject area')}.`;
}

/** "customer.companyname feeds 1 warehouse column, 66 report columns in 48 subject areas." */
export function traceSentence(cm: ColumnModel, f: number): string | null {
  const links = cm.fieldCols[f];
  if (!links.length) return null;
  let nPres = 0;
  for (const c of links) nPres += cm.physPres[c].length;
  const head = `${fieldLabel(cm, f)} feeds ${plural(links.length, 'warehouse column')}`;
  return nPres ? `${head}, ${plural(nPres, 'report column')} in ${plural(cm.fieldSas[f].length, 'subject area')}.` : `${head}.`;
}

/** "Oracle's lineage states all 15 links from NetSuite." */
export function traceProvenanceSentence(cm: ColumnModel, f: number): string | null {
  const n = cm.fieldCols[f].length;
  if (!n) return null;
  return n === 1 ? 'Oracle’s lineage states the one link from NetSuite.' : `Oracle’s lineage states all ${fmt(n)} links from NetSuite.`;
}

/** "The subject areas fall in 7 of 9 functional areas." */
export function traceAreasSentence(cm: ColumnModel, f: number): string | null {
  const m = cm.core;
  const fas = new Set(cm.fieldSas[f].map((s) => m.subjectAreas[s].fa).filter((x) => x >= 0));
  return fas.size ? `The subject areas fall in ${fmt(fas.size)} of ${fmt(m.functionalAreas.length)} functional areas.` : null;
}

/** Every table-level builder, for the copy-rule test and for pages that want them all. */
export const tableBuilders = { keySourceSentence, headerSentence, linesSentence, headerKeySentence } as const;
export const columnTableBuilders = { sourceCoverageSentence, tableReadSentence } as const;
