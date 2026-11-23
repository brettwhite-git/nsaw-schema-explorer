// The copy rule: present what the data shows and never narrate gaps. Every sentence builder is run across the
// whole ontology, and the site and explorer sources are scanned for gap phrases in string literals.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CoreJson, DetailJson } from '../ontology/types';
import * as copy from '../explorer/data/copy';
import { buildCore, buildColumns, grainSentence, type CoreModel, type ColumnModel } from '../explorer/data';

const GAP = /\bno (key|NetSuite source|report column|header|subject area)|\bnot (in|a column)\b|say nothing|gives no|states no|isn['’]t in/i;

const root = path.resolve(__dirname, '..');
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(root, 'public/ontology', f), 'utf8')) as T;

let m: CoreModel;
let cm: ColumnModel;
beforeAll(() => {
  m = buildCore(read<CoreJson>('core.json'));
  cm = buildColumns(m, read<DetailJson>('columns.json'));
});

const bad: string[] = [];
const check = (where: string, s: string | null | string[]) => {
  for (const x of Array.isArray(s) ? s : [s]) if (x !== null && GAP.test(x)) bad.push(`${where}: ${x}`);
};

describe('copy builders never narrate a gap', () => {
  it('table-level builders, every table', () => {
    let some = 0;
    for (const t of m.tables) {
      const i = t.i;
      for (const s of [grainSentence(m, i), copy.keySourceSentence(m, i), copy.headerSentence(m, i), copy.linesSentence(m, i),
        copy.headerKeySentence(m, i), copy.sourceCoverageSentence(cm, i), copy.tableReadSentence(cm, i)]) { check(t.name, s); if (s) some++; }
      check(t.name, copy.alsoKeyedSentences(m, i));
    }
    expect(some).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });
  it('absent data gives null, never a sentence', () => {
    const named = new Set(m.entities.flatMap((e) => e.keys.map((k) => k.ti)));
    const t = m.tables.find((x) => !named.has(x.i))!;
    expect(grainSentence(m, t.i)).toBeNull();
    expect(copy.keySourceSentence(m, t.i)).toBeNull();
    expect(copy.headerSentence(m, t.i)).toBeNull();
    const empty = cm.tableCols.findIndex((cs) => cs.length > 0 && cs.every((c) => !cm.colSrc[c].length));
    if (empty >= 0) expect(copy.sourceCoverageSentence(cm, empty)).toBeNull();
  });
  it('column, field, area, dimension and comparison builders', () => {
    for (let c = 0; c < cm.pcName.length; c++) check(cm.pcName[c], copy.columnReadSentence(cm, c));
    for (let f = 0; f < cm.nfName.length; f++) {
      check(cm.nfName[f], copy.traceSentence(cm, f));
      check(cm.nfName[f], copy.traceProvenanceSentence(cm, f));
      check(cm.nfName[f], copy.traceAreasSentence(cm, f));
    }
    for (const s of m.subjectAreas) {
      check(s.label, copy.areaGrainSentence(m, s.i));
      for (const o of m.subjectAreas) check(`${s.label} / ${o.label}`, copy.compareSentence(m, s.i, o.i));
    }
    for (let c = 0; c < m.bus.columns.length; c++) check(`col ${c}`, copy.reachSentence(m, c));
    expect(bad).toEqual([]);
  });
});

// ------------------------------------------------------------------ source scan
const SCAN_DIRS = ['site', 'explorer'];
const SELF = path.resolve(__filename);
function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
/** String literals ('…', "…", `…`) with their line numbers. Comments are skipped. */
function literals(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const re = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g;
  let mt: RegExpExecArray | null;
  while ((mt = re.exec(src))) {
    if (mt[0].startsWith('/')) continue;
    out.push({ line: src.slice(0, mt.index).split('\n').length, text: mt[0].slice(1, -1) });
  }
  return out;
}

describe('source files carry no gap phrases', () => {
  it(`scans ${SCAN_DIRS.join(', ')}`, () => {
    const hits: string[] = [];
    for (const d of SCAN_DIRS) for (const f of files(path.join(root, d))) {
      if (path.resolve(f) === SELF) continue;
      for (const l of literals(fs.readFileSync(f, 'utf8'))) if (GAP.test(l.text)) hits.push(`${path.relative(root, f)}:${l.line}: ${l.text.slice(0, 120)}`);
    }
    expect(hits).toEqual([]);
  });
});
