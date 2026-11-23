import { describe, it, expect } from 'vitest';
import { parseMarks } from '../site/marks';
import { noteLines } from '../site/Chapter';

describe('inline marks', () => {
  it('plain text is one segment', () => {
    expect(parseMarks('hello')).toEqual([{ kind: 'text', text: 'hello' }]);
  });
  it('*em* and `code`', () => {
    expect(parseMarks('a *b* c `d` e')).toEqual([
      { kind: 'text', text: 'a ' }, { kind: 'em', text: 'b' }, { kind: 'text', text: ' c ' }, { kind: 'code', text: 'd' }, { kind: 'text', text: ' e' },
    ]);
  });
  it('nothing inside code is parsed', () => {
    expect(parseMarks('`a *b* c`')).toEqual([{ kind: 'code', text: 'a *b* c' }]);
  });
  it('unmatched markers stay literal', () => {
    expect(parseMarks('2 * 3')).toEqual([{ kind: 'text', text: '2 * 3' }]);
    expect(parseMarks('a ` b')).toEqual([{ kind: 'text', text: 'a ` b' }]);
  });
  it('a backslash escapes a marker', () => {
    expect(parseMarks('\\*not em\\*')).toEqual([{ kind: 'text', text: '*not em*' }]);
  });
  it('identifiers with underscores are untouched', () => {
    expect(parseMarks('`DW_NS_SALES_ORDER_F` and *grain*')).toEqual([
      { kind: 'code', text: 'DW_NS_SALES_ORDER_F' }, { kind: 'text', text: ' and ' }, { kind: 'em', text: 'grain' },
    ]);
  });
  it('margin notes wrap at word boundaries', () => {
    expect(noteLines('one line, the whole trip')).toEqual(['one line, the whole trip']);
    expect(noteLines('the grain of the sale: one line, one row')).toEqual(['the grain of the sale: one', 'line, one row']);
    expect(noteLines('a\nb')).toEqual(['a', 'b']);
  });
});
