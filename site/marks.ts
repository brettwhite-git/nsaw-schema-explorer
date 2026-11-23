// Inline marks in chapter copy: *emphasis* and `code`, nothing else.
// Code wins (nothing inside backticks is parsed). A backslash escapes a marker. Unmatched markers stay literal.
export type Mark = { kind: 'text' | 'em' | 'code'; text: string };

export function parseMarks(src: string): Mark[] {
  const out: Mark[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ kind: 'text', text: buf }); buf = ''; } };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && (src[i + 1] === '*' || src[i + 1] === '`' || src[i + 1] === '\\')) { buf += src[i + 1]; i += 2; continue; }
    if (c === '`') {
      const j = src.indexOf('`', i + 1);
      if (j > i + 1) { flush(); out.push({ kind: 'code', text: src.slice(i + 1, j) }); i = j + 1; continue; }
    }
    if (c === '*') {
      let j = i + 1;
      while (j < src.length && src[j] !== '*') { if (src[j] === '\\') j++; j++; }
      if (j < src.length && j > i + 1) {
        flush();
        out.push({ kind: 'em', text: src.slice(i + 1, j).replace(/\\([*`\\])/g, '$1') });
        i = j + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}
