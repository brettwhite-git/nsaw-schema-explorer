// Draw-in schedule of one transition: items sharing an `ord` start together; the next group starts halfway through
// the longest item of the previous one (or when it ends, for `seq` items). Pure: tested, no DOM.
import type { Item } from './model';

/** a whole transition fits in this (storyboard: 0.9 to 1.8 s) */
export const BUDGET_MS = 1750;

/** nominal length of an item's own draw-in (ms), to place the next group */
function nominal(it: Item): number {
  switch (it.k) {
    case 'form': return 1250;
    case 'rec': return 700;
    case 'tag': case 'hex': case 'pill': return 780;
    case 'ghost': return 500;
    case 'table': return 800;
    case 'box': return 800;
    case 'text': return 460;
    case 'under': return 300;
    case 'rule': return 400;
    case 'callout': return 460;
    case 'legend': return 1100;
    case 'line': return it.dur ?? 640;
  }
}

/** Start time of each group (items sharing an `ord`), and the total. */
export function schedule(items: Item[]): { start: Map<number, number>; total: number } {
  const ords = [...new Set(items.map((i) => i.ord))].sort((a, b) => a - b);
  const start = new Map<number, number>();
  let t = 0, total = 0;
  for (const o of ords) {
    const g = items.filter((i) => i.ord === o);
    const len = Math.max(...g.map(nominal));
    start.set(o, t);
    total = Math.max(total, t + len);
    t += g.some((i) => i.seq) ? len : len * 0.5;
  }
  return { start, total };
}

