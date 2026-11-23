import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as copy from '../content/scenes';
import scene0 from '../figures/scenes/scene0';
import scene1 from '../figures/scenes/netsuite';

/** the "Words on screen" column of a scene's click table in docs/entry-story.md */
function sheetWords(scene: 0 | 1): string[] {
  const doc = fs.readFileSync(path.resolve(__dirname, '../docs/entry-story.md'), 'utf8');
  const start = doc.indexOf(scene === 0 ? '## Scene 0.' : '## Scene 1.');
  const end = doc.indexOf('\n---', start);
  const rows = doc.slice(start, end).split('\n').filter((l) => /^\| \d+ \|/.test(l));
  return rows.map((r) => { const cells = r.split('|').map((c) => c.trim()); return cells[3].replace(/^"|"$/g, ''); });
}
const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
const worlds = (s: unknown): { texts: { id: string; lines: string[] }[] } => (s as { world: { texts: { id: string; lines: string[] }[] } }).world;

describe('on-screen words equal the sheets', () => {
  it('scene 0: the six clicks say exactly the sheet', () => { expect([...copy.SCENE0_WORDS]).toEqual(sheetWords(0)); });
  it('scene 1: the ten clicks say exactly the sheet', () => { expect([...copy.SCENE1_WORDS]).toEqual(sheetWords(1)); });
  it('the three questions are the sheet’s clicks 2 to 4 of scene 0, joined from their written lines', () => {
    copy.QUESTION_LINES.forEach((l, i) => expect(l.join(' ')).toBe(copy.SCENE0_WORDS[i + 1]));
  });
  it('the scenes draw those words: every narration line joined equals its sheet sentence', () => {
    const t0 = worlds(scene0).texts, t1 = worlds(scene1).texts;
    for (const i of [0, 4, 5]) expect(t0.find((t) => t.id === `n0-${i}`)!.lines.join(' ')).toBe(copy.SCENE0_WORDS[i]);
    copy.SCENE1_WORDS.forEach((w, i) => expect(t1.find((t) => t.id === `n1-${i}`)!.lines.join(' ')).toBe(w));
  });
  it('the ledger line is the sheet’s, with the count from the data', () => { expect(copy.LEDGER(173)).toBe('173 kinds of record, filed as they happen.'); });
  it('the pinned short forms are the sheet’s', () => { expect([...copy.QUESTION_SHORT]).toEqual(['Last year?', 'Whose number?', 'Other systems?']); });
});

describe('the Voice rule: on-screen copy is narration', () => {
  const BANNED: [RegExp, string][] = [[/, not /i, '"X, not Y"'], [/\brather than\b/i, 'rather than'], [/\binstead of\b/i, 'instead of'], [/\bif\b[^.]*\bthen\b/i, 'if ... then'], [/\bnot\b[^.]*\bbut\b/i, 'not ... but']];
  it('no banned construction in the copy module', () => {
    for (const s of strings(copy)) for (const [re, name] of BANNED) expect(re.test(s), `${name}: ${s}`).toBe(false);
  });
  it('none in the words drawn by the scenes and the objects', () => {
    const root = path.resolve(__dirname, '../figures/scenes');
    for (const f of ['objects/index.ts', 'building/index.ts', 'netsuite/index.ts', 'scene0/index.ts']) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      for (const m of src.matchAll(/'([^'\n]{12,})'/g)) for (const [re, name] of BANNED) expect(re.test(m[1]), `${f} ${name}: ${m[1]}`).toBe(false);
    }
  });
  it('the lint itself catches the old captions', () => {
    for (const bad of ['The card holds a slip, not a copy of the customer.', 'Nothing is broken, rather than late.', 'Use cards instead of copies.', 'If it moves then it files.']) expect(BANNED.some(([re]) => re.test(bad)), bad).toBe(true);
  });
});
