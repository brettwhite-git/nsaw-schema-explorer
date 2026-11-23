// The Entry section: the real tiles. The warehouse band's field (every DW_NS table in the lineage file: 447, with the
// secured twins as a second outline behind their base table) and the model band's field (every subject area, 110, in
// one quiet district per functional area). Pure: ontology in, world-coordinate shapes out. They are texture, not labels.
import type { Ontology } from '../../ontology/load';
import { hatchSegments } from '../../ink/hatch';
import { bandBottom, bandTop, X0, X1 } from './model';

export type FieldStyle = 'fact' | 'dim' | 'other' | 'uni' | 'sa' | 'twin';
export interface FieldTile { x: number; y: number; w: number; h: number; style: FieldStyle; key: string; label: string; idx: number; district: number }
export interface FieldDistrict { name: string; x: number; y: number; w: number; h: number; count: number }
export interface Field { tiles: FieldTile[]; districts: FieldDistrict[]; slots: number; twins: number }

const byText = (a: string, b: string): number => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);

export function warehouseField(o: Ontology): Field {
  const nSa = o.count('subjectArea');
  const uniMin = Math.ceil(0.9 * nSa);
  const entries: { i: number; name: string; role: string; sec: boolean; base: number; sa: number }[] = [];
  const inLineage = new Set<number>();
  for (let i = 0; i < o.count('physicalTable'); i++) {
    const t = o.get('physicalTable', i);
    if (t.src & 1) { inLineage.add(i); entries.push({ i, name: t.name, role: t.role, sec: !!t.isSecured, base: t.baseTable, sa: t.saCount }); }
  }
  const isTwin = (e: { sec: boolean; base: number }): boolean => e.sec && e.base >= 0 && inLineage.has(e.base);
  const slots = entries.filter((e) => !isTwin(e));
  const twins = entries.filter(isTwin);
  const stem = (e: { name: string }): string => e.name.replace(/_SEC$/, '');
  const sorter = (a: { name: string }, b: { name: string }): number => byText(stem(a), stem(b)) || byText(a.name, b.name);
  const uni = slots.filter((e) => e.sa >= uniMin).sort(sorter);
  const rest = slots.filter((e) => e.sa < uniMin);
  const facts = rest.filter((e) => e.role === 'fact').sort(sorter);
  const dims = rest.filter((e) => e.role === 'dimension').sort(sorter);
  const other = rest.filter((e) => e.role !== 'fact' && e.role !== 'dimension').sort(sorter);
  type E = (typeof entries)[number];
  const ordered: [E, FieldStyle][] = [
    ...uni.map((e): [E, FieldStyle] => [e, 'uni']), ...facts.map((e): [E, FieldStyle] => [e, 'fact']),
    ...dims.map((e): [E, FieldStyle] => [e, 'dim']), ...other.map((e): [E, FieldStyle] => [e, 'other']),
  ];
  const x0 = X0 + 6, y0 = bandTop(2) + 4, w = X1 - X0 - 12, h = bandBottom(2) - bandTop(2) - 8;
  const cols = 26, rows = Math.ceil(ordered.length / cols);
  const px = w / cols, py = h / rows;
  const tiles: FieldTile[] = [];
  const at = new Map<number, FieldTile>();
  ordered.forEach(([e, style], k) => {
    const t: FieldTile = { x: x0 + (k % cols) * px + 0.8, y: y0 + Math.floor(k / cols) * py + 0.8, w: px - 3.6, h: py - 3.6, style, key: e.name, label: e.name, idx: e.i, district: 0 };
    tiles.push(t); at.set(e.i, t);
  });
  for (const e of twins) {
    const b = at.get(e.base)!;
    tiles.push({ x: b.x + 1.7, y: b.y + 1.4, w: b.w, h: b.h, style: 'twin', key: e.name, label: e.name, idx: e.i, district: 0 });
  }
  return { tiles, districts: [], slots: slots.length, twins: twins.length };
}

export function modelField(o: Ontology): Field {
  const nFa = o.count('functionalArea');
  const members: { i: number; label: string; name: string }[][] = Array.from({ length: nFa }, () => []);
  for (let i = 0; i < o.count('subjectArea'); i++) {
    const sa = o.get('subjectArea', i);
    const fa = o.neighbors({ type: 'subjectArea', i }, 'inFunctionalArea', 'out')[0]?.ref.i ?? 0;
    members[fa].push({ i, label: sa.label, name: sa.name });
  }
  members.forEach((m) => m.sort((a, b) => byText(a.label, b.label)));
  const order = members.map((_, i) => i).sort((a, b) => members[b].length - members[a].length || a - b);
  const NCOL = 3, gap = 14;
  const fx0 = X0 + 6, fy0 = bandTop(3) + 8, fw = X1 - X0 - 12;
  const colW = (fw - (NCOL - 1) * gap) / NCOL;
  const pw = 16, ph = 5.6, tw = 13, th = 3.6, lab = 9;
  const tcols = Math.max(1, Math.floor(colW / pw));
  const colY = new Array(NCOL).fill(fy0);
  const tiles: FieldTile[] = [];
  const districts: FieldDistrict[] = [];
  for (const fa of order) {
    let c = 0;
    for (let k = 1; k < NCOL; k++) if (colY[k] < colY[c]) c = k;
    const x = fx0 + c * (colW + gap), y = colY[c];
    const rows = Math.ceil(members[fa].length / tcols);
    districts.push({ name: o.get('functionalArea', fa).name, x, y, w: colW, h: lab + rows * ph, count: members[fa].length });
    members[fa].forEach((m, k) => {
      tiles.push({ x: x + (k % tcols) * pw + 1, y: y + lab + Math.floor(k / tcols) * ph + 1, w: tw, h: th, style: 'sa', key: m.name, label: m.label, idx: m.i, district: fa });
    });
    colY[c] = y + lab + rows * ph + 5;
  }
  return { tiles, districts, slots: tiles.length, twins: 0 };
}

// ------------------------------------------------------------------------------------------------ shapes (shared with the named tags)

export const f1 = (n: number): string => String(Math.round(n * 10) / 10);
export function tagPoly(x: number, y: number, w: number, h: number, ch = Math.min(5, h * 0.34)): number[] {
  return [x + ch, y, x + w, y, x + w, y + h, x + ch, y + h, x, y + h - ch, x, y + ch];
}
export function pillPoly(x: number, y: number, w: number, h: number): number[] {
  const r = h / 2;
  return [x + r, y, x + w - r, y, x + w - r * 0.25, y + h * 0.2, x + w, y + h * 0.5, x + w - r * 0.25, y + h * 0.8, x + w - r, y + h, x + r, y + h, x + r * 0.25, y + h * 0.8, x, y + h * 0.5, x + r * 0.25, y + h * 0.2];
}
export const polyD = (p: number[]): string => { let s = ''; for (let i = 0; i < p.length; i += 2) s += (i ? 'L' : 'M') + f1(p[i]) + ' ' + f1(p[i + 1]); return s + 'Z'; };
export const segD = (ss: number[][]): string => ss.map((s) => `M${f1(s[0])} ${f1(s[1])}L${f1(s[2])} ${f1(s[3])}`).join('');

/** Batched path data for a field: one outline path, one hatch path and one stipple path per style. */
export function fieldPaths(f: Field): Record<string, { outline: string; marks: string; dots: string }> {
  const out: Record<string, { outline: string; marks: string; dots: string }> = {};
  for (const t of f.tiles) {
    const g = (out[t.style] ??= { outline: '', marks: '', dots: '' });
    if (t.style === 'sa') {
      g.outline += polyD(pillPoly(t.x, t.y, t.w, t.h));
      g.marks += segD(hatchSegments({ x0: t.x + t.w * 0.55, y0: t.y + 1, x1: t.x + t.w - 3, y1: t.y + t.h - 1 }, 135, 1.5));
    } else {
      g.outline += polyD(tagPoly(t.x, t.y, t.w, t.h, 2.2));
      if (t.style === 'fact') g.marks += segD(hatchSegments({ x0: t.x + t.w * 0.5, y0: t.y + 0.8, x1: t.x + t.w - 0.8, y1: t.y + t.h - 0.8 }, 45, 1.5));
      else if (t.style === 'other') for (let k = 0; k < 3; k++) g.dots += `M${f1(t.x + t.w * (0.3 + 0.2 * k))} ${f1(t.y + t.h * (k % 2 ? 0.62 : 0.38))}h.01`;
      else if (t.style === 'dim' || t.style === 'uni') g.marks += `M${f1(t.x + 2.6)} ${f1(t.y + t.h / 2)}h1.4`;
    }
  }
  return out;
}
