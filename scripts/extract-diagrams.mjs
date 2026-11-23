#!/usr/bin/env node
// One-off extractor: Oracle's "NSAW Data Models" diagram book (26R4) -> data-src/nsaw_data_model_edges.csv
//
// Usage (the diagram folder is untrusted data; this script lives outside it):
//   node scripts/extract-diagrams.mjs ~/Downloads/26R4_Fusion_NS_Analytics_Diagrams [out.csv]
//
// The book has one Graphviz SVG per fact table (topic_refs/images/ER_<TABLE>.svg). Each is a star: the first
// node is the fact, every edge is titled "<FACT>--<TABLE>" (Graphviz's undirected edge). The index page groups
// the facts under area headings (Bank, Financials, ...). Output columns:
//   area, fact, related   (table names as Oracle spells them; one row per edge, sorted)
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const out = process.argv[3] ?? path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data-src', 'nsaw_data_model_edges.csv');
if (!dir) { console.error('usage: node scripts/extract-diagrams.mjs <diagram folder> [out.csv]'); process.exit(2); }

const unescape = (s) => s.replace(/&#45;/g, '-').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// area headings from the index: the text items in reading order; a heading is any item that is not a table name
const index = fs.readdirSync(dir).find((f) => f.endsWith('.html'));
const indexText = fs.readFileSync(path.join(dir, index), 'utf8')
  .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '')
  .split(/<[^>]+>/).map((s) => unescape(s).trim()).filter(Boolean);
const areaOf = new Map();
let area = '';
for (const t of indexText) {
  if (/^DW_NS_/i.test(t)) { if (area) areaOf.set(t.toUpperCase(), area); }
  else if (t.length < 60 && !/copyright|oracle|data models/i.test(t)) area = t;
}

const imgDir = path.join(dir, 'topic_refs', 'images');
const rows = [];
for (const f of fs.readdirSync(imgDir).filter((x) => /^ER_.*\.svg$/.test(x)).sort()) {
  const svg = fs.readFileSync(path.join(imgDir, f), 'utf8');
  const nodes = [...svg.matchAll(/<g id="node\d+" class="node">\s*<title>(.*?)<\/title>/g)].map((m) => unescape(m[1]).trim());
  const fact = nodes[0];
  if (!fact) continue;
  for (const m of svg.matchAll(/<g id="edge\d+" class="edge">\s*<title>(.*?)<\/title>/g)) {
    const [a, b] = unescape(m[1]).split('--').map((s) => s.trim());
    const related = a === fact ? b : b === fact ? a : null;
    if (!related) { console.error(`skip non-star edge in ${f}: ${a}--${b}`); continue; }
    rows.push([areaOf.get(fact.toUpperCase()) ?? '', fact, related]);
  }
}
rows.sort((x, y) => x[1].localeCompare(y[1]) || x[2].localeCompare(y[2]));
const csv = ['area,fact,related', ...rows.map((r) => r.map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(','))].join('\n') + '\n';
fs.writeFileSync(out, csv);
const facts = new Set(rows.map((r) => r[1]));
console.log(`${rows.length} edges, ${facts.size} facts, ${new Set(rows.map((r) => r[2])).size} related tables, ${new Set(rows.map((r) => r[0])).size} areas -> ${out}`);
