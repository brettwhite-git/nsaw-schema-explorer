#!/usr/bin/env node
/**
 * build-ontology.mjs : raw sources -> typed ontology JSON in public/ontology/.
 *
 *   npm run ontology
 *
 * Inputs (all in the repo, no workbook needed):
 *   data-src/25R4_NS_Semantic_Model_Lineage ... .csv     presentation -> physical lineage
 *   data-src/ns_source_edges.csv, data-src/nsaw_derived.csv   (extracted once by scripts/extract-workbook.py)
 *   data-src/25R4_NS_Data_Augmentation_Entity_Key_List ... .csv  entity keys
 *   data-src/25R4_Fusion_NS_Analytics_Tables.html      doc groups
 *   ontology/functionalAreas.ts, ontology/naming.ts    curated rules + name inference (bundled with esbuild, single source of truth)
 *
 * Outputs:
 *   core.json      small, always loaded: nodes of the smaller types, summaries, bus matrix, small edge groups
 *   columns.json   lazy: column-level nodes + their edges (mapsTo, sourcedFrom, ...)
 *   usedwith.json  lazy: fact x dimension co-occurrence pairs
 *
 * Provenance on every edge group: explicit (a source row says so) | inferred (our rule) | curated (hand-authored rule in repo).
 * See ontology/types.ts for the JSON shape.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const OUT = P('public', 'ontology');
const LINEAGE = P('data-src', '25R4_NS_Semantic_Model_Lineage - 25R4_NS_Semantic_Model_Lineage.csv');
const KEYS = P('data-src', '25R4_NS_Data_Augmentation_Entity_Key_List - Sheet1.csv');
const DOCS = P('data-src', '25R4_Fusion_NS_Analytics_Tables.html');
const SRC_EDGES = P('data-src', 'ns_source_edges.csv');
const DERIVED = P('data-src', 'nsaw_derived.csv');

// STATED_ONLY: emit only what Oracle's files state. Flip to false to restore the inferred layers
// (name-guessed sourcedFrom / loadedFrom, concepts + instanceOf, securedVariantOf + baseTable, entityOf, readsFrom,
// usedWith, bus-matrix saPairs). Every inferred block below is gated on this one switch.
const STATED_ONLY = true;

const SCHEMA_VERSION = 1;
const PROV = { explicit: 0, inferred: 1, curated: 2 };
const PROV_NAMES = ['explicit', 'inferred', 'curated'];

// ---------------------------------------------------------------- helpers
const text = (f) => fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
function csv(f) {
  const r = Papa.parse(text(f), { header: true, skipEmptyLines: true });
  if (r.errors.length) throw new Error(`${f}: ${JSON.stringify(r.errors.slice(0, 3))}`);
  return r.data.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), (v ?? '').trim()])));
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const cmpCI = (a, b) => cmp(a.toLowerCase(), b.toLowerCase()) || cmp(a, b);
const pairKey = (a, b) => a * 4194304 + b; // ids stay far below 2^22
const addTo = (m, k, v) => { let s = m.get(k); if (!s) m.set(k, (s = new Set())); s.add(v); return s; };

async function loadTs() {
  // Bundle ontology/naming.ts + ontology/functionalAreas.ts in memory so the build uses the app's own rules, not a copy.
  const res = await build({
    stdin: { contents: "export * from './ontology/naming'; export * from './ontology/functionalAreas';", resolveDir: ROOT, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'));
}

const T = await loadTs();
const { parsePhysicalTableType, isSecuredTable, isNsawGeneratedTable, inferRecordType, inferFieldName, getFunctionalArea, groupByFunctionalArea } = T;

// ---------------------------------------------------------------- read lineage
const raw = csv(LINEAGE);
const stats = { csvRows: raw.length, nanRowsDropped: 0, dwNsRows: 0, sqlRows: 0, aliasRows: 0 };
const lineage = []; // {sa, pt, pc, kind:'dw'|'sql'|'alias', tbl, col}
for (const r of raw) {
  const tbl = r['Physical Table'], col = r['Physical Column'];
  if (tbl === 'NaN' || col === 'NaN' || !tbl || !col) { stats.nanRowsDropped++; continue; }
  const kind = tbl.startsWith('DW_NS_') ? 'dw' : tbl.startsWith('Dim_DW_NS_') ? 'alias' : 'sql';
  if (kind === 'dw') stats.dwNsRows++; else if (kind === 'alias') stats.aliasRows++; else stats.sqlRows++;
  lineage.push({ sa: r['Subject Area'], pt: r['Presentation Table'], pc: r['Presentation Column'], kind, tbl, col });
}

// ---------------------------------------------------------------- subject areas / functional areas
const saNames = [...new Set(lineage.map((r) => r.sa))].sort(cmpCI);
const saIdx = new Map(saNames.map((n, i) => [n, i]));
const faGroups = groupByFunctionalArea(saNames.map((name) => ({ name, presentationTables: [], recordCount: 0 })));
const faNames = faGroups.map((g) => g.name);
const faIdx = new Map(faNames.map((n, i) => [n, i]));
const saFa = saNames.map((n) => faIdx.get(getFunctionalArea(n)));

// ---------------------------------------------------------------- concepts + presentation tables
const conceptNames = [...new Set(lineage.map((r) => r.pt))].sort(cmpCI);
const conceptIdx = new Map(conceptNames.map((n, i) => [n, i]));
const ptKeys = [...new Set(lineage.map((r) => r.sa + '\u0000' + r.pt))]
  .map((k) => { const [sa, pt] = k.split('\u0000'); return { sa: saIdx.get(sa), concept: conceptIdx.get(pt), key: k }; })
  .sort((a, b) => a.sa - b.sa || a.concept - b.concept);
const ptIdx = new Map(ptKeys.map((p, i) => [p.key, i]));

// ---------------------------------------------------------------- physical tables (union of sources, case-insensitive)
const SRC = { lineage: 1, workbook: 2, docs: 4 };
const tReg = new Map(); // lower -> {name, src, preview}
function regTable(name, bit, preview = false) {
  const k = name.toLowerCase();
  let t = tReg.get(k);
  if (!t) tReg.set(k, (t = { name, src: 0, preview: false }));
  t.src |= bit; if (preview) t.preview = true;
  return t;
}
for (const r of lineage) if (r.kind === 'dw') regTable(r.tbl, SRC.lineage);
const srcEdgesRaw = csv(SRC_EDGES);
const derivedRaw = csv(DERIVED);
for (const e of srcEdgesRaw) regTable(e.physical_table, SRC.workbook);
for (const d of derivedRaw) regTable(d.physical_table, SRC.workbook);

// docs index: heading -> tables (only DW_NS_ tables are NetSuite)
const docHtml = text(DOCS);
const docGroupNames = [];
const docMembers = []; // [groupIdx, tableName, preview]
let docsSkippedNonNs = 0;
for (const part of docHtml.split('<li class="topicref topichead">').slice(1)) {
  const name = part.match(/^([^<]*)/)[1].trim();
  const gi = docGroupNames.push(name) - 1;
  for (const m of part.matchAll(/<a href="[^"]*">([^<]*)<\/a>/g)) {
    let t = m[1].trim(); const preview = /\(Preview\)/i.test(t);
    t = t.replace(/\s*\(Preview\)\s*$/i, '');
    if (!t.startsWith('DW_NS_')) { docsSkippedNonNs++; continue; }
    regTable(t, SRC.docs, preview);
    docMembers.push([gi, t.toLowerCase()]);
  }
}

const tList = [...tReg.values()].sort((a, b) => cmpCI(a.name, b.name));
const tIdx = new Map(tList.map((t, i) => [t.name.toLowerCase(), i]));
const tByName = (n) => tIdx.get(n.toLowerCase());

// ---------------------------------------------------------------- sql sources
const sqlTexts = [...new Set(lineage.filter((r) => r.kind !== 'dw').map((r) => r.tbl))].sort(cmp);
const sqlIdx = new Map(sqlTexts.map((t, i) => [t, i]));
const sqlKind = sqlTexts.map((t) => (t.startsWith('Dim_DW_NS_') ? 'alias' : 'sql'));

// ---------------------------------------------------------------- physical columns
// Registry of (table, column) for DW_NS tables and (sql, column) for sql sources.
const colReg = new Map(); // key -> {tbl, sql, name, src}
const ckey = (t, s, n) => `${t}|${s}|${n.toLowerCase()}`;
function regCol(t, s, name, bit) {
  const k = ckey(t, s, name);
  let c = colReg.get(k);
  if (!c) colReg.set(k, (c = { tbl: t, sql: s, name, src: 0 }));
  c.src |= bit; return c;
}
for (const r of lineage) {
  if (r.kind === 'dw') regCol(tByName(r.tbl), -1, r.col, SRC.lineage);
  else regCol(-1, sqlIdx.get(r.tbl), r.col, SRC.lineage);
}
for (const e of srcEdgesRaw) regCol(tByName(e.physical_table), -1, e.physical_column, SRC.workbook);
for (const d of derivedRaw) regCol(tByName(d.physical_table), -1, d.physical_column, SRC.workbook);
const cList = [...colReg.values()].sort((a, b) => (a.tbl - b.tbl) || (a.sql - b.sql) || cmpCI(a.name, b.name));
const cIdx = new Map(cList.map((c, i) => [ckey(c.tbl, c.sql, c.name), i]));
const colOf = (tbl, name) => cIdx.get(ckey(tbl, -1, name));

// ---------------------------------------------------------------- roles + derived (single definition)
const tableNsawPattern = tList.map((t) => isNsawGeneratedTable(t.name));
const flaggedCols = new Set();
for (const d of derivedRaw) flaggedCols.add(colOf(tByName(d.physical_table), d.physical_column));
// column.derived: 0 none | 1 flagged in nsaw_derived.csv | 2 table matched by isNsawGeneratedTable | 3 both
const colDerived = cList.map((c, i) => (flaggedCols.has(i) ? 1 : 0) | (c.tbl >= 0 && tableNsawPattern[c.tbl] ? 2 : 0));
const isDerivedCol = (i) => colDerived[i] !== 0;

// ---------------------------------------------------------------- nodes: presentation columns
const nameTab = new Map(); const strings = [];
const sid = (s) => { let i = nameTab.get(s); if (i === undefined) { i = strings.length; strings.push(s); nameTab.set(s, i); } return i; };
const pcMap = new Map(); // `${pt}|${name}` -> {pt, name}
for (const r of lineage) {
  const p = ptIdx.get(r.sa + '\u0000' + r.pt);
  const k = p + '|' + r.pc;
  if (!pcMap.has(k)) pcMap.set(k, { pt: p, name: r.pc });
}
const pcList = [...pcMap.values()].sort((a, b) => a.pt - b.pt || cmpCI(a.name, b.name) || cmp(a.name, b.name));
const pcIdx = new Map(pcList.map((c, i) => [c.pt + '|' + c.name, i]));

// ---------------------------------------------------------------- mapsTo + aggregates from lineage
const mapsSet = new Set(); const mapsPairs = [];
const colSA = new Map(), colConcept = new Map(), colPT = new Map();
const tblSA = new Map(), tblConcept = new Map(), tblPT = new Map(), tblRows = new Map();
const saTables = saNames.map(() => new Set());
const sqlSA = new Map();
const conceptTblCount = conceptNames.map(() => new Map());
const conceptHasDw = new Set();
const ptCols = ptKeys.map(() => new Set()), ptPhys = ptKeys.map(() => new Set());
for (const r of lineage) {
  const p = ptIdx.get(r.sa + '\u0000' + r.pt), pc = pcIdx.get(p + '|' + r.pc);
  const sa = saIdx.get(r.sa), con = conceptIdx.get(r.pt);
  const ci = r.kind === 'dw' ? colOf(tByName(r.tbl), r.col) : cIdx.get(ckey(-1, sqlIdx.get(r.tbl), r.col));
  const mk = pairKey(pc, ci);
  if (!mapsSet.has(mk)) { mapsSet.add(mk); mapsPairs.push(pc, ci); }
  addTo(colSA, ci, sa); addTo(colConcept, ci, con); addTo(colPT, ci, p);
  ptCols[p].add(r.pc);
  if (r.kind === 'dw') {
    const ti = tByName(r.tbl);
    addTo(tblSA, ti, sa); addTo(tblConcept, ti, con); addTo(tblPT, ti, p);
    tblRows.set(ti, (tblRows.get(ti) || 0) + 1);
    saTables[sa].add(ti); ptPhys[p].add(ti); conceptHasDw.add(con);
    const m = conceptTblCount[con]; m.set(ti, (m.get(ti) || 0) + 1);
  } else {
    addTo(sqlSA, sqlIdx.get(r.tbl), sa);
  }
}

// ---------------------------------------------------------------- NetSuite records / fields / sourcedFrom
const recReg = new Map(); // lower -> {name, type, explicit}
const fldReg = new Map(); // `${recLower}.${fieldLower}` -> {rec, name, explicit}
function regRecord(name, type, explicit) {
  const k = name.toLowerCase(); let r = recReg.get(k);
  if (!r) recReg.set(k, (r = { key: k, name, type: null, explicit: false }));
  if (explicit) { if (!r.explicit) r.name = name; r.explicit = true; if (type) r.type = type; }
  return r;
}
function regField(rec, name, explicit) {
  const k = rec.key + '.' + name.toLowerCase(); let f = fldReg.get(k);
  if (!f) fldReg.set(k, (f = { key: k, rec, name, explicit: false }));
  if (explicit) { if (!f.explicit) f.name = name; f.explicit = true; }
  return f;
}
const sourcedPairs = new Map(); // `${col}|${fieldKey}` -> explicit?(0/1 prov)
const explicitCols = new Set();
for (const e of srcEdgesRaw) {
  const rec = regRecord(e.ns_record, e.ns_record_type, true);
  const f = regField(rec, e.ns_field, true);
  const ci = colOf(tByName(e.physical_table), e.physical_column);
  sourcedPairs.set(ci + '|' + f.key, PROV.explicit); explicitCols.add(ci);
}
const stat = { inferredEdges: 0, inferredSkippedNoRecord: 0 };
const loadedFrom = new Map(); // `${tbl}|${recKey}` -> prov (explicit wins)
// name-guessed sourcedFrom (inferRecordType / inferFieldName): skipped entirely when STATED_ONLY,
// so no NetSuite record or field exists only because of a guess.
for (let ci = 0; !STATED_ONLY && ci < cList.length; ci++) {
  const c = cList[ci];
  if (c.tbl < 0 || isDerivedCol(ci)) continue;
  const tname = tList[c.tbl].name;
  if (explicitCols.has(ci)) continue;
  const rt = inferRecordType(tname);
  if (!rt) { stat.inferredSkippedNoRecord++; continue; }
  const rec = regRecord(rt, null, false);
  const f = regField(rec, inferFieldName(c.name), false);
  sourcedPairs.set(ci + '|' + f.key, PROV.inferred); stat.inferredEdges++;
}
// table -> record (loadedFrom)
for (const [k, prov] of sourcedPairs) {
  const [ci, fk] = k.split('|'); const ti = cList[+ci].tbl; const rk = fldReg.get(fk).rec.key;
  const kk = ti + '|' + rk; const cur = loadedFrom.get(kk);
  if (cur === undefined || prov < cur) loadedFrom.set(kk, prov);
}

const recList = [...recReg.values()].sort((a, b) => cmpCI(a.name, b.name));
const recIdx = new Map(recList.map((r, i) => [r.key, i]));
const fldList = [...fldReg.values()].sort((a, b) => recIdx.get(a.rec.key) - recIdx.get(b.rec.key) || cmpCI(a.name, b.name));
const fldIdx = new Map(fldList.map((f, i) => [f.key, i]));

// ---------------------------------------------------------------- entities (key list)
const keyRows = csv(KEYS);
const entMap = new Map();
for (const r of keyRows) {
  const n = r['Entity Name'];
  let e = entMap.get(n);
  if (!e) entMap.set(n, (e = { name: n, domainCode: r['Domain Code'], keys: [], seen: new Set() }));
  const sig = [r['Entity Keys'], r['Table Name'], r['Table Column']].join('|');
  if (e.seen.has(sig)) continue; e.seen.add(sig);
  const ti = tByName(r['Table Name']);
  const ci = ti === undefined ? undefined : colOf(ti, r['Table Column']);
  e.keys.push({ k: r['Entity Keys'], t: r['Table Name'], c: r['Table Column'], ti: ti ?? -1, ci: ci ?? -1 });
}
const entList = [...entMap.values()].sort((a, b) => cmpCI(a.name, b.name));

// ---------------------------------------------------------------- derived summaries per table
const tCols = tList.map(() => []);
cList.forEach((c, i) => { if (c.tbl >= 0) tCols[c.tbl].push(i); });
const tRole = tList.map((t) => parsePhysicalTableType(t.name));
const tSecured = tList.map((t) => isSecuredTable(t.name));
// X_SEC -> X is a pairing by name (inferred): not emitted when STATED_ONLY.
const tBase = tList.map((t, i) => (!STATED_ONLY && tSecured[i] ? tByName(t.name.slice(0, -4)) : undefined));

// ---------------------------------------------------------------- usedWith + bus matrix
const isFactRole = (r) => r === 'fact' || r === 'enhanced';
const used = new Map(); // pairKey(fact, dim) -> SA count
const saFacts = saNames.map(() => []);
const saDims = saNames.map(() => []);
saTables.forEach((set, sa) => {
  const facts = [...set].filter((t) => isFactRole(tRole[t])).sort((a, b) => a - b);
  const dims = [...set].filter((t) => tRole[t] === 'dimension').sort((a, b) => a - b);
  saFacts[sa] = facts; saDims[sa] = dims;
  for (const f of facts) for (const d of dims) used.set(pairKey(f, d), (used.get(pairKey(f, d)) || 0) + 1);
});
const dimSA = new Map();
saDims.forEach((ds, sa) => ds.forEach((d) => addTo(dimSA, d, sa)));
const busCols = [...dimSA.entries()].filter(([, s]) => s.size >= 2)
  .sort((a, b) => b[1].size - a[1].size || cmp(tList[a[0]].name, tList[b[0]].name)).map(([t]) => t);
const busColIdx = new Map(busCols.map((t, i) => [t, i]));
const saOrder = saNames.map((_, i) => i).sort((a, b) => saFa[a] - saFa[b] || cmpCI(saNames[a], saNames[b]));
const busRows = saOrder.map((sa) => saDims[sa].filter((d) => busColIdx.has(d)).map((d) => busColIdx.get(d)).sort((a, b) => a - b));
// subject-area pairs by shared conformed (non-derived) dimensions
const conformed = busCols.filter((t) => !tableNsawPattern[t]);
const pairs = { a: [], b: [], shared: [] };
{
  const sets = saNames.map((_, sa) => new Set(saDims[sa].filter((d) => conformed.includes(d))));
  for (let a = 0; a < saNames.length; a++) for (let b = a + 1; b < saNames.length; b++) {
    let n = 0; for (const d of sets[a]) if (sets[b].has(d)) n++;
    if (n >= 3) { pairs.a.push(a); pairs.b.push(b); pairs.shared.push(n); }
  }
}

// ---------------------------------------------------------------- sql reads
const readsFrom = { pairs: [], prov: [] };
sqlTexts.forEach((t, si) => {
  const targets = new Set();
  if (STATED_ONLY) return; // readsFrom is found by name in the SQL text: inferred
  if (sqlKind[si] === 'alias') targets.add(t.replace(/^Dim_/, ''));
  else for (const m of t.matchAll(/\bDW_NS_[A-Za-z0-9_]+/g)) targets.add(m[0]);
  for (const n of [...targets].sort()) { const ti = tByName(n); if (ti !== undefined) { readsFrom.pairs.push(si, ti); readsFrom.prov.push(PROV.inferred); } }
});

// ---------------------------------------------------------------- assemble nodes
function topN(map, n) { return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([k]) => k); }
const size = (m, k) => (m.get(k) ? m.get(k).size : 0);

const core = {
  schema: SCHEMA_VERSION,
  meta: {
    provenanceLegend: {
      explicit: 'A source row states it directly (lineage CSV, workbook extract, entity key list, Oracle table index).',
      inferred: STATED_ONLY
        ? 'Computed by a naming rule or co-occurrence. Not emitted in this build (statedOnly).'
        : 'Computed by a naming rule or co-occurrence in this build. Plausible, not verified.',
      curated: 'Hand-authored rule kept in the repo (config/functionalAreas.ts).',
    },
    provenanceCodes: PROV_NAMES,
    sources: {
      lineage: { file: path.basename(LINEAGE), sha: sha(LINEAGE) },
      workbookExtract: { files: ['data-src/ns_source_edges.csv', 'data-src/nsaw_derived.csv'], sha: [sha(SRC_EDGES), sha(DERIVED)], note: 'Extracted once from Data_Lineage_NS_NSDI_4.0.xlsx by scripts/extract-workbook.py' },
      entityKeys: { file: path.basename(KEYS), sha: sha(KEYS) },
      docs: { file: path.basename(DOCS), sha: sha(DOCS) },
    },
    ingest: { ...stats, docsSkippedNonNs },
    derivedDefinition: 'A physical column is derived when it is flagged in nsaw_derived.csv (code 1) OR its table matches isNsawGeneratedTable (code 2); 3 = both. Table.derivedRule says which fired.',
    roleDefinition: 'parsePhysicalTableType() after stripping a trailing _SEC; isSecured is a separate flag.',
    files: { columns: 'columns.json', usedwith: 'usedwith.json' },
    statedOnly: STATED_ONLY,
    statedOnlyNote: STATED_ONLY
      ? 'Only relationships stated in Oracle\'s files are emitted. Dropped: name-guessed sourcedFrom/loadedFrom and their NetSuite records/fields, concepts + instanceOf, securedVariantOf (and physicalTable.baseTable), entityOf, readsFrom, usedWith (usedwith.json is empty), busMatrix.saPairs. Kept naming conventions that are not relationships: table role by suffix, isSecured (_SEC), derived by isNsawGeneratedTable.'
      : undefined,
  },
  nodes: {},
  edges: [],
  busMatrix: null,
};
const N = core.nodes;

N.functionalArea = { n: faNames.length, cols: {
  name: faNames,
  subjectAreaCount: faNames.map((_, i) => saFa.filter((x) => x === i).length),
  provenance: faNames.map(() => 'curated'),
} };

N.subjectArea = { n: saNames.length, cols: {
  name: saNames,
  label: saNames.map((n) => n.replace(/^NetSuite\s*-\s*/i, '')),
  presentationTables: saNames.map((_, sa) => ptKeys.filter((p) => p.sa === sa).length),
  presentationColumns: saNames.map(() => 0), // filled below
  physicalTables: saTables.map((s) => s.size),
  facts: saFacts.map((f) => f.length),
  dimensions: saDims.map((d) => d.length),
  sqlSources: saNames.map((_, sa) => [...sqlSA.values()].filter((s) => s.has(sa)).length),
} };
pcList.forEach((c) => { N.subjectArea.cols.presentationColumns[ptKeys[c.pt].sa]++; });

if (!STATED_ONLY) N.concept = { n: conceptNames.length, cols: {
  name: conceptNames,
  saCount: conceptNames.map((_, c) => new Set(ptKeys.filter((p) => p.concept === c).map((p) => p.sa)).size),
  tableCount: conceptNames.map((_, c) => ptKeys.filter((p) => p.concept === c).length),
  columnNames: conceptNames.map(() => 0),
  physicalTables: conceptTblCount.map((m) => m.size),
  topPhysical: conceptTblCount.map((m) => topN(m, 3)),
  hasDwNs: conceptNames.map((_, c) => (conceptHasDw.has(c) ? 1 : 0)),
} };
if (!STATED_ONLY) {
  const cn = conceptNames.map(() => new Set());
  pcList.forEach((c) => cn[ptKeys[c.pt].concept].add(c.name));
  N.concept.cols.columnNames = cn.map((s) => s.size);
}

N.presentationTable = { n: ptKeys.length, cols: {
  sa: ptKeys.map((p) => p.sa),
  name: ptKeys.map((p) => conceptNames[p.concept]),
  ...(STATED_ONLY ? {} : { concept: ptKeys.map((p) => p.concept) }),
  columns: ptCols.map((s) => s.size),
  physicalTables: ptPhys.map((s) => s.size),
} };

N.physicalTable = { n: tList.length, cols: {
  name: tList.map((t) => t.name),
  role: tRole,
  isSecured: tSecured.map((b) => (b ? 1 : 0)),
  baseTable: tBase.map((b) => (b === undefined ? -1 : b)),
  derived: tableNsawPattern.map((b) => (b ? 1 : 0)),
  derivedRule: tList.map((t, i) => {
    const flagged = tCols[i].some((c) => flaggedCols.has(c));
    return tableNsawPattern[i] ? (flagged ? 'both' : 'pattern') : flagged ? 'flagged-columns' : null;
  }),
  src: tList.map((t) => t.src),
  preview: tList.map((t) => (t.preview ? 1 : 0)),
  columns: tCols.map((a) => a.length),
  mappedColumns: tCols.map((a) => a.filter((c) => cList[c].src & SRC.lineage).length),
  derivedColumns: tCols.map((a) => a.filter(isDerivedCol).length),
  saCount: tList.map((_, i) => size(tblSA, i)),
  presentationTables: tList.map((_, i) => size(tblPT, i)),
  ...(STATED_ONLY ? {} : { conceptCount: tList.map((_, i) => size(tblConcept, i)) }),
  lineageRows: tList.map((_, i) => tblRows.get(i) || 0),
} };

N.docGroup = { n: docGroupNames.length, cols: {
  name: docGroupNames,
  tableCount: docGroupNames.map((_, g) => docMembers.filter((m) => m[0] === g).length),
} };

N.sqlSource = { n: sqlTexts.length, cols: {
  kind: sqlKind,
  text: sqlTexts,
  label: sqlTexts.map((t) => { const s = t.replace(/\s+/g, ' '); return s.length > 72 ? s.slice(0, 69) + '...' : s; }),
  saCount: sqlTexts.map((_, i) => size(sqlSA, i)),
  columns: sqlTexts.map((_, i) => cList.filter((c) => c.sql === i).length),
} };

// netsuite records: reach through columns -> presentation
const recTables = recList.map(() => new Set()), recSA = recList.map(() => new Set()), recSAx = recList.map(() => new Set()),
  recCon = recList.map(() => new Set()), recFields = recList.map(() => 0), recFieldsX = recList.map(() => 0), recCols = recList.map(() => new Set());
for (const [k, prov] of sourcedPairs) {
  const [ci, fk] = k.split('|'); const f = fldReg.get(fk); const ri = recIdx.get(f.rec.key);
  recTables[ri].add(cList[+ci].tbl); recCols[ri].add(+ci);
  for (const sa of colSA.get(+ci) || []) { recSA[ri].add(sa); if (prov === PROV.explicit) recSAx[ri].add(sa); }
  for (const c of colConcept.get(+ci) || []) recCon[ri].add(c);
}
fldList.forEach((f) => { const ri = recIdx.get(f.rec.key); recFields[ri]++; if (f.explicit) recFieldsX[ri]++; });
N.netsuiteRecord = { n: recList.length, cols: {
  name: recList.map((r) => r.name),
  key: recList.map((r) => r.key),
  recordType: recList.map((r) => r.type),
  explicit: recList.map((r) => (r.explicit ? 1 : 0)),
  fieldCount: recFields,
  explicitFieldCount: recFieldsX,
  tableCount: recTables.map((s) => s.size),
  columnCount: recCols.map((s) => s.size),
  saReach: recSA.map((s) => s.size),
  saReachExplicit: recSAx.map((s) => s.size),
  ...(STATED_ONLY ? {} : { conceptReach: recCon.map((s) => s.size) }),
} };

N.entity = { n: entList.length, cols: {
  name: entList.map((e) => e.name),
  domainCode: entList.map((e) => e.domainCode),
  keys: entList.map((e) => e.keys),
  resolvedKeys: entList.map((e) => e.keys.filter((k) => k.ci >= 0).length),
} };

// ---------------------------------------------------------------- edges
function group(type, from, to, pairsArr, prov, extra = {}) {
  const g = { type, from, to, n: pairsArr.length / 2, pairs: pairsArr };
  if (Array.isArray(prov)) {
    const uniq = new Set(prov);
    if (uniq.size === 1) g.provenance = PROV_NAMES[prov[0]]; else { g.provenance = 'mixed'; g.prov = prov; }
  } else g.provenance = prov;
  return Object.assign(g, extra);
}
const flat = (arr) => arr.flat();

core.edges.push(group('inFunctionalArea', 'subjectArea', 'functionalArea', flat(saNames.map((_, i) => [i, saFa[i]])), 'curated'));
core.edges.push(group('contains', 'subjectArea', 'presentationTable', flat(ptKeys.map((p, i) => [p.sa, i])), 'explicit'));
if (!STATED_ONLY) core.edges.push(group('instanceOf', 'presentationTable', 'concept', flat(ptKeys.map((p, i) => [i, p.concept])), 'inferred',
  { note: 'Merged by identical presentation-table name across subject areas. Same name does not guarantee same meaning.' }));
{
  const sec = []; tBase.forEach((b, i) => { if (b !== undefined) sec.push(i, b); });
  if (!STATED_ONLY) core.edges.push(group('securedVariantOf', 'physicalTable', 'physicalTable', sec, 'inferred', { note: 'X_SEC -> X by name.' }));
}
core.edges.push(group('inDocGroup', 'physicalTable', 'docGroup', flat(docMembers.map(([g, t]) => [tIdx.get(t), g]).sort((a, b) => a[0] - b[0] || a[1] - b[1])), 'explicit'));
{
  const lf = [...loadedFrom.entries()].map(([k, prov]) => { const [t, rk] = k.split('|'); return [+t, recIdx.get(rk), prov]; }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  core.edges.push(group('loadedFrom', 'physicalTable', 'netsuiteRecord', flat(lf.map((x) => [x[0], x[1]])), lf.map((x) => x[2])));
}
{
  const eo = []; entList.forEach((e, i) => { const r = recIdx.get(e.domainCode.toLowerCase()); if (r !== undefined) eo.push(i, r); });
  if (!STATED_ONLY) core.edges.push(group('entityOf', 'entity', 'netsuiteRecord', eo, 'inferred', { note: 'Entity Domain Code matched case-insensitively to a NetSuite record name.' }));
}
if (!STATED_ONLY) core.edges.push(group('readsFrom', 'sqlSource', 'physicalTable', readsFrom.pairs, readsFrom.prov,
  { note: 'alias: Dim_ prefix stripped; sql: DW_NS_ names found in the text.' }));

core.busMatrix = {
  note: STATED_ONLY
    ? 'rows = subject areas (ordered by functional area, then name); columns = dimension tables the lineage lists under 2+ subject areas (most shared first). cells[i] lists the dimension tables the lineage lists under subject area i; facts[i] the fact tables. It says which tables a subject area uses, nothing about how they join.'
    : 'rows = subject areas (ordered by functional area, then name); columns = dimension tables used in 2+ subject areas (most shared first). cells[i] lists the column indexes present in row i. Co-occurrence in one subject area, NOT a verified join.',
  provenance: STATED_ONLY ? 'explicit' : 'inferred',
  rows: saOrder,
  columns: busCols,
  columnSaCount: busCols.map((t) => dimSA.get(t).size),
  columnDerived: busCols.map((t) => (tableNsawPattern[t] ? 1 : 0)),
  cells: busRows,
  facts: saOrder.map((sa) => saFacts[sa]),
  ...(STATED_ONLY ? {} : { saPairs: { note: 'Subject-area pairs sharing >= 3 conformed (non-derived) dimensions.', ...pairs } }),
};

// ---------------------------------------------------------------- columns.json (lazy)
const sourcedList = [...sourcedPairs.entries()].map(([k, prov]) => { const [c, f] = k.split('|'); return [+c, fldIdx.get(f), prov]; })
  .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const columns = {
  schema: SCHEMA_VERSION,
  strings,
  nodes: {
    presentationColumn: { n: pcList.length, strCols: ['name'], cols: { pt: pcList.map((c) => c.pt), name: pcList.map((c) => sid(c.name)) } },
    physicalColumn: { n: cList.length, strCols: ['name'], cols: {
      table: cList.map((c) => c.tbl), sql: cList.map((c) => c.sql), name: cList.map((c) => sid(c.name)),
      derived: colDerived, src: cList.map((c) => c.src),
      saCount: cList.map((_, i) => size(colSA, i)), ...(STATED_ONLY ? {} : { conceptCount: cList.map((_, i) => size(colConcept, i)) }),
    } },
    netsuiteField: { n: fldList.length, strCols: ['name'], cols: {
      record: fldList.map((f) => recIdx.get(f.rec.key)), name: fldList.map((f) => sid(f.name)), explicit: fldList.map((f) => (f.explicit ? 1 : 0)),
    } },
  },
  edges: [
    group('contains', 'presentationTable', 'presentationColumn', flat(pcList.map((c, i) => [c.pt, i])), 'explicit'),
    group('contains', 'physicalTable', 'physicalColumn', flat(cList.map((c, i) => (c.tbl >= 0 ? [c.tbl, i] : [])).filter((x) => x.length)), 'explicit'),
    group('contains', 'sqlSource', 'physicalColumn', flat(cList.map((c, i) => (c.sql >= 0 ? [c.sql, i] : [])).filter((x) => x.length)), 'explicit'),
    group('contains', 'netsuiteRecord', 'netsuiteField', flat(fldList.map((f, i) => [recIdx.get(f.rec.key), i])), fldList.map((f) => (f.explicit ? PROV.explicit : PROV.inferred))),
    group('mapsTo', 'presentationColumn', 'physicalColumn', mapsPairs, 'explicit'),
    group('sourcedFrom', 'physicalColumn', 'netsuiteField', flat(sourcedList.map((x) => [x[0], x[1]])), sourcedList.map((x) => x[2])),
    group('keyedBy', 'entity', 'physicalColumn', flat(entList.flatMap((e, i) => e.keys.filter((k) => k.ci >= 0).map((k) => [i, k.ci]))), 'explicit',
      { note: 'Entity key list: the entity\'s own key column, not a foreign key.' }),
  ],
};
const usedPairs = [...used.entries()].map(([k, w]) => [Math.floor(k / 4194304), k % 4194304, w]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const usedwith = {
  schema: SCHEMA_VERSION,
  // co-occurrence pairs are inferred: the file stays (lazy loaders expect it) but is empty when STATED_ONLY
  edges: STATED_ONLY ? [] : [group('usedWith', 'physicalTable', 'physicalTable', flat(usedPairs.map((x) => [x[0], x[1]])), 'inferred',
    { weight: usedPairs.map((x) => x[2]), note: 'Fact and dimension appear in the same subject area. weight = number of subject areas. Not a verified join.' })],
};

// ---------------------------------------------------------------- write + report
fs.mkdirSync(OUT, { recursive: true });
const files = { 'core.json': core, 'columns.json': columns, 'usedwith.json': usedwith };
let totRaw = 0, totGz = 0;
const sizes = {};
for (const [f, obj] of Object.entries(files)) {
  const s = JSON.stringify(obj);
  fs.writeFileSync(path.join(OUT, f), s);
  const gz = zlib.gzipSync(s, { level: 9 }).length;
  sizes[f] = { raw: s.length, gzip: gz }; totRaw += s.length; totGz += gz;
}

const nodeCount = (t, f) => (N[t] || columns.nodes[t]).n;
const lineageTables = tList.filter((t) => t.src & SRC.lineage).length;
core.meta.counts = {
  subjectAreas: saNames.length,
  functionalAreas: faNames.length,
  ...(STATED_ONLY ? {} : { concepts: conceptNames.length, conceptsWithDwNsLineage: conceptHasDw.size }),
  presentationTables: ptKeys.length,
  presentationColumns: pcList.length,
  physicalTables: tList.length,
  physicalTablesInLineage: lineageTables,
  physicalColumns: cList.filter((c) => c.tbl >= 0).length,
  physicalColumnsInLineage: cList.filter((c) => c.tbl >= 0 && c.src & SRC.lineage).length,
  sqlSources: sqlTexts.length,
  sqlColumns: cList.filter((c) => c.sql >= 0).length,
  netsuiteRecords: recList.length, explicitNetsuiteRecords: recList.filter((r) => r.explicit).length,
  netsuiteFields: fldList.length,
  entities: entList.length,
  docGroups: docGroupNames.length,
  explicitSourceEdges: sourcedList.filter((x) => x[2] === PROV.explicit).length,
  ...(STATED_ONLY ? {} : { inferredSourceEdges: sourcedList.filter((x) => x[2] === PROV.inferred).length }),
  derivedColumnsFlagged: flaggedCols.size,
  derivedFlaggedTables: new Set([...flaggedCols].map((c) => cList[c].tbl)).size,
  securedTables: tSecured.filter(Boolean).length,
  ...(STATED_ONLY ? {} : { usedWithPairs: usedPairs.length }),
  busMatrixColumns: busCols.length,
  entityKeysResolved: entList.reduce((n, e) => n + e.keys.filter((k) => k.ci >= 0).length, 0),
  entityKeysTotal: entList.reduce((n, e) => n + e.keys.length, 0),
};
core.meta.sizes = undefined;
// rewrite core with counts (sizes are reported to stdout / build log only, so the file does not depend on its own size)
{
  const s = JSON.stringify(core);
  fs.writeFileSync(path.join(OUT, 'core.json'), s);
  sizes['core.json'] = { raw: s.length, gzip: zlib.gzipSync(s, { level: 9 }).length };
  totRaw = 0; totGz = 0; for (const v of Object.values(sizes)) { totRaw += v.raw; totGz += v.gzip; }
}

console.log('ontology counts');
for (const [k, v] of Object.entries(core.meta.counts)) console.log(`  ${k.padEnd(28)} ${v}`);
console.log('ingest', JSON.stringify(core.meta.ingest));
console.log('inference', JSON.stringify(stat));
console.log('roles', JSON.stringify(tRole.reduce((m, r) => ((m[r] = (m[r] || 0) + 1), m), {})));
console.log('files (raw / gzip bytes)');
for (const [f, v] of Object.entries(sizes)) console.log(`  ${f.padEnd(14)} ${String(v.raw).padStart(9)} ${String(v.gzip).padStart(9)}`);
console.log(`  ${'TOTAL'.padEnd(14)} ${String(totRaw).padStart(9)} ${String(totGz).padStart(9)}`);
