// The bus matrix as a real <table>: rows are subject areas grouped by functional area, columns the shared
// dimensions ordered by reach (a readable head, then long-tail bands that open in place).
// Keyboard: one cell is in the tab order (roving tabindex); arrows, Home and End move; Enter or Space picks.
// Hover: the row drives the side panel (onHoverRow); the column tint is a one-line <style>, so hovering never
// re-renders the table.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { matrixRows, prettyTable, reach, type CoreModel } from '../../explorer/data';
import { matrixLayout, type Sel } from './matrix/shared';

// Every column name is slanted at SLANT degrees from horizontal. Neighbouring names sit w·sin(SLANT) apart, so a
// column must be at least lineHeight / sin(SLANT) wide: about 14px for 12px names and 12px for 10.5px ones.
// The minimums below leave a little air on top of that.
const LABEL_W = 204, BAND_W = 52, GAP = 6, HEAD_MIN = 20, MAX_W = 34, OPEN_MIN = 15, OPEN_MAX = 22;
const SLANT = 60, SIN = Math.sin((SLANT * Math.PI) / 180), COS = Math.cos((SLANT * Math.PI) / 180);
/** Longer names are cut with an ellipsis; the full name stays in the title and the aria-label. */
const NAME_MAX = 22;
const HEAD_MIN_H = 120, HEAD_MAX_H = 220, BAR_ROOM = 34;

type Slot =
  | { kind: 'col'; c: number; w: number; tail: boolean; k: number }
  | { kind: 'band'; b: number; w: number; k: number }
  | { kind: 'gap'; w: number };

function buildSlots(m: CoreModel, open: Set<number>, avail: number): { slots: Slot[]; width: number } {
  const { head, bands } = matrixLayout(m);
  const openCols = [...open].reduce((n, b) => n + bands[b].cols.length, 0);
  const closed = bands.length - open.size;
  const room = avail - LABEL_W - closed * BAND_W - bands.length * GAP - 8;
  // Opened long-tail columns reserve their minimum first; the head columns share what is left. Neither drops
  // below a readable width: when they do not fit, the matrix scrolls sideways under a pinned label column.
  const cw = Math.max(HEAD_MIN, Math.min(MAX_W, Math.floor((room - openCols * OPEN_MIN) / head.length)));
  const ecw = openCols ? Math.max(OPEN_MIN, Math.min(OPEN_MAX, cw, Math.floor((room - head.length * cw) / openCols))) : cw;
  const slots: Slot[] = [];
  let k = 1, width = LABEL_W;
  for (const c of head) { slots.push({ kind: 'col', c, w: cw, tail: false, k: k++ }); width += cw; }
  bands.forEach((bd, b) => {
    slots.push({ kind: 'gap', w: GAP }); width += GAP;
    if (open.has(b)) for (const c of bd.cols) { slots.push({ kind: 'col', c, w: ecw, tail: true, k: k++ }); width += ecw; }
    else { slots.push({ kind: 'band', b, w: BAND_W, k: k++ }); width += BAND_W; }
  });
  return { slots, width };
}

const shortName = (s: string) => (s.length > NAME_MAX ? `${s.slice(0, NAME_MAX - 1).trimEnd()}…` : s);

let measureCtx: CanvasRenderingContext2D | null = null;
/** Width in px of a column name in the font it is drawn in (the --ui family). */
function textWidth(text: string, size: number, weight: number): number {
  if (typeof document === 'undefined') return text.length * size * 0.55;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * size * 0.55;
  const family = getComputedStyle(document.documentElement).getPropertyValue('--ui').trim() || 'sans-serif';
  measureCtx.font = `${weight} ${size}px ${family}`;
  return measureCtx.measureText(text).width;
}

/** Header height that holds the longest visible name at the slant. */
function headHeight(slots: Slot[], names: string[], dim: number | null): number {
  let L = 0;
  for (const s of slots) {
    if (s.kind !== 'col') continue;
    L = Math.max(L, textWidth(shortName(names[s.c]), s.tail ? 10.5 : 12, s.c === dim ? 600 : 400));
  }
  const rise = L * SIN + 12 * COS;
  return Math.round(Math.max(HEAD_MIN_H, Math.min(HEAD_MAX_H, rise + BAR_ROOM + 12)));
}

interface View {
  cmp: boolean;
  shared: Set<number>;
  diff: Set<number>;
}

export interface BusMatrixProps {
  m: CoreModel;
  sel: Sel;
  onPickRow: (row: number) => void;
  onPickCol: (col: number) => void;
  onToggleBand: (band: number) => void;
  onHoverRow: (row: number | null) => void;
}

export const BusMatrix = memo(function BusMatrix({ m, sel, onPickRow, onPickCol, onToggleBand, onHoverRow }: BusMatrixProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const hoverStyle = useRef<HTMLStyleElement>(null);
  const hoverRow = useRef<number | null>(null);
  const [avail, setAvail] = useState(1000);
  const [focus, setFocus] = useState<{ r: number; k: number }>({ r: 0, k: 0 });
  const [fontTick, setFontTick] = useState(0);

  useEffect(() => {
    // Re-measure the column names once the web fonts are in (canvas measures with whatever is loaded).
    const fonts = document.fonts;
    if (!fonts) return;
    let live = true;
    const bump = () => { if (live) setFontTick((t) => t + 1); };
    fonts.ready.then(bump);
    fonts.addEventListener('loadingdone', bump);
    return () => { live = false; fonts.removeEventListener('loadingdone', bump); };
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setAvail(Math.round(el.clientWidth) - 12); // less the box's right padding (room for the last slanted name)
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { slots, width } = useMemo(() => buildSlots(m, sel.open, avail), [m, sel.open, avail]);
  const groups = useMemo(() => matrixRows(m), [m]);
  const names = useMemo(() => m.bus.columns.map((t) => prettyTable(m, m.tables[t].name)), [m]);
  // fontTick only invalidates the memo: the canvas measures again once the fonts have loaded.
  const headH = useMemo(() => headHeight(slots, names, sel.dim), [slots, names, sel.dim, fontTick]);
  const view = useMemo<View>(() => {
    const { a, b } = sel;
    if (a === null || b === null) return { cmp: false, shared: new Set(), diff: new Set() };
    const shared = new Set(m.bus.cells[a].filter((c) => m.rowSets[b].has(c)));
    const diff = new Set([...m.bus.cells[a], ...m.bus.cells[b]].filter((c) => !shared.has(c)));
    return { cmp: true, shared, diff };
  }, [m, sel]);
  const nSlots = slots.filter((s) => s.kind !== 'gap').length;
  const nRows = m.bus.rows.length;
  const N = m.subjectAreas.length;
  const { bands } = matrixLayout(m);

  const cellAt = (r: number, k: number) => wrap.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-k="${k}"]`) ?? null;

  const activate = useCallback((el: HTMLElement) => {
    const r = Number(el.dataset.r);
    if (r >= 0) { onPickRow(r); return; }
    if (el.dataset.c !== undefined) onPickCol(Number(el.dataset.c));
    else if (el.dataset.band !== undefined) onToggleBand(Number(el.dataset.band));
  }, [onPickRow, onPickCol, onToggleBand]);

  const onClick = (e: MouseEvent<HTMLTableElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-k]');
    if (!el) return;
    setFocus({ r: Number(el.dataset.r), k: Number(el.dataset.k) });
    activate(el);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-k]');
    if (!el) return;
    let r = Number(el.dataset.r), k = Number(el.dataset.k);
    switch (e.key) {
      case 'ArrowUp': r = Math.max(k === 0 ? 0 : -1, r - 1); break;
      case 'ArrowDown': r = Math.min(nRows - 1, r + 1); break;
      case 'ArrowLeft': k = Math.max(r < 0 ? 1 : 0, k - 1); break;
      case 'ArrowRight': k = Math.min(nSlots, k + 1); break;
      case 'Home': k = r < 0 ? 1 : 0; if (e.ctrlKey) r = 0; break;
      case 'End': k = nSlots; if (e.ctrlKey) r = nRows - 1; break;
      case 'Enter': case ' ': e.preventDefault(); activate(el); return;
      default: return;
    }
    e.preventDefault();
    const next = cellAt(r, k);
    if (next) {
      setFocus({ r, k });
      // scroll-padding on the scroller keeps the cell clear of the pinned header and label column
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  // One positioned element outside the scroll box (so it is never clipped), filled and placed through its ref.
  const showTip = (c: number | null) => {
    const t = tip.current, w = wrap.current, sc = scroller.current;
    const th = c === null ? null : w?.querySelector<HTMLElement>(`th[data-c="${c}"]`);
    if (!t || !w || !sc || !th || c === null) { if (t) t.hidden = true; return; }
    const wr = w.getBoundingClientRect(), sr = sc.getBoundingClientRect(), hr = th.getBoundingClientRect();
    const mid = hr.left + hr.width / 2;
    if (mid < sr.left + LABEL_W || mid > sr.right) { t.hidden = true; return; }
    t.textContent = `${names[c]} · ${reach(m, c)} of ${N} subject areas`;
    t.hidden = false;
    const tw = t.offsetWidth, th2 = t.offsetHeight;
    const x = Math.max(sr.left - wr.left, Math.min(sr.right - wr.left - tw, mid - wr.left - tw / 2));
    t.style.left = `${Math.round(x)}px`;
    t.style.top = `${Math.round(hr.bottom - wr.top - BAR_ROOM + 2 - th2)}px`;
  };

  const setHover = (r: number | null, c: number | null) => {
    showTip(c);
    if (hoverStyle.current) hoverStyle.current.textContent = c === null ? '' : `.bm [data-c="${c}"]{background-color:var(--tint)}.bm th[data-c="${c}"] .bm-cl{text-decoration:underline}`;
    if (r !== hoverRow.current) { hoverRow.current = r; onHoverRow(r); }
  };
  const onMouseOver = (e: MouseEvent<HTMLTableElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
    if (!el) return;
    const r = Number(el.dataset.r);
    setHover(r >= 0 ? r : null, el.dataset.c !== undefined ? Number(el.dataset.c) : null);
  };

  const { a, b, dim } = sel;
  const colCls = (c: number) => (view.cmp ? (view.diff.has(c) ? 'hot' : view.shared.has(c) ? '' : 'fade') : dim === c ? 'hot' : dim !== null ? 'fade' : '');
  const totalCols = 1 + slots.length;

  return (
    <div className="bm-wrap" ref={wrap}>
      <style ref={hoverStyle} />
      <div className="bm-bands">
        <span className="bm-bands-k">The long tail</span>
        {bands.map((bd, k) => {
          const nDiff = view.cmp ? bd.cols.filter((c) => view.diff.has(c)).length : 0;
          const on = sel.open.has(k);
          return (
            <button key={k} type="button" className={`bm-band-t${on ? ' on' : ''}`} aria-expanded={on} onClick={() => onToggleBand(k)}>
              <b>{bd.cols.length} more</b> {bd.label}
              {nDiff > 0 && <em>{nDiff} in one area only</em>}
              <span className="chev">{on ? 'hide' : 'show'}</span>
            </button>
          );
        })}
      </div>
      <div className="bm-tip" ref={tip} hidden aria-hidden="true" />
      <div className="bm-scroll" ref={scroller} style={{ scrollPaddingTop: headH, scrollPaddingLeft: LABEL_W }}
        onScroll={(e) => { showTip(null); e.currentTarget.classList.toggle('is-x', e.currentTarget.scrollLeft > 0); }}>
      <table
        className={`bm${view.cmp ? ' is-cmp' : ''}${dim !== null ? ' is-dim' : ''}`}
        style={{ width, ['--bm-head' as string]: `${headH}px` }}
        role="grid"
        aria-label="Bus matrix: subject areas by shared dimension tables"
        onClick={onClick}
        onKeyDown={onKeyDown}
        onMouseOver={onMouseOver}
        onMouseLeave={() => setHover(null, null)}
        onFocus={(e) => { const el = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); showTip(el?.dataset.c !== undefined ? Number(el.dataset.c) : null); }}
        onBlur={() => showTip(null)}
      >
        <colgroup>
          <col style={{ width: LABEL_W }} />
          {slots.map((s, i) => <col key={i} style={{ width: s.w }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="bm-corner" scope="col">
              <span className="bm-axis-t">Subject areas</span>
              <span className="bm-axis-s">by functional area</span>
              <span className="bm-axis-dl">dims listed</span>
              <span className="bm-axis-r">Reach</span>
              <span className="bm-axis-hi" aria-hidden="true">{N}</span>
              <span className="bm-axis-lo" aria-hidden="true">0</span>
            </th>
            {slots.map((s, i) => {
              if (s.kind === 'gap') return <th key={i} className="bm-gap" aria-hidden="true" />;
              const focusable = focus.r === -1 && focus.k === s.k ? 0 : -1;
              if (s.kind === 'band') {
                const bd = bands[s.b];
                const nDiff = view.cmp ? bd.cols.filter((c) => view.diff.has(c)).length : 0;
                const fade = (view.cmp && !nDiff) || (dim !== null);
                return (
                  <th key={i} scope="col" className={`bm-bh${fade ? ' fade' : ''}`} data-r={-1} data-k={s.k} data-band={s.b} tabIndex={focusable}
                    aria-expanded={false} aria-label={`${bd.cols.length} more dimensions ${bd.label}. Show them.`}>
                    <span className="bm-cl">{bd.cols.length} more</span>
                    <span className="bm-range">{bd.lo}–{bd.hi}</span>
                  </th>
                );
              }
              const c = s.c, n = reach(m, c), cls = colCls(c);
              const short = shortName(names[c]), table = m.tables[m.bus.columns[c]].name;
              return (
                <th key={i} scope="col" className={`bm-ch${s.tail ? ' tail' : ''} ${cls}`} data-r={-1} data-k={s.k} data-c={c} tabIndex={focusable}
                  aria-selected={dim === c} title={short === names[c] ? table : `${names[c]} (${table})`}
                  aria-label={`${names[c]}, listed under ${n} of ${N} subject areas`}>
                  <span className="bm-cl" aria-hidden="true">{short}</span>
                  <i className="bm-bar" style={{ height: Math.max(1, (n / N) * 24), width: Math.max(2, Math.min(6, s.w - 4)) }} />
                </th>
              );
            })}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={`${g.fa}-${g.rows[0].row}`}>
            <tr className="bm-fa">
              <th scope="rowgroup" colSpan={totalCols}>
                <span className="bm-fat">{g.name}<span className="bm-fan">{g.rows.length} {g.rows.length === 1 ? 'area' : 'areas'}</span></span>
              </th>
            </tr>
            {g.rows.map((row) => (
              <Row key={row.row} m={m} r={row.row} label={row.label} slots={slots} sel={sel} view={view} names={names}
                focusK={focus.r === row.row ? focus.k : -1} />
            ))}
          </tbody>
        ))}
      </table>
      </div>
    </div>
  );
});

interface RowProps {
  m: CoreModel;
  r: number;
  label: string;
  slots: Slot[];
  sel: Sel;
  view: View;
  names: string[];
  focusK: number;
}

const Row = memo(function Row({ m, r, label, slots, sel, view, names, focusK }: RowProps) {
  const { a, b, dim } = sel;
  const set = m.rowSets[r];
  const isAB = r === a || r === b;
  const rowFade = view.cmp ? !isAB : dim !== null && !set.has(dim);
  const ab = view.cmp ? (r === a ? 'A' : r === b ? 'B' : '') : '';
  const { bands } = matrixLayout(m);
  const tab = (k: number) => (focusK === k ? 0 : -1);
  return (
    <tr className={`bm-row${isAB ? ' sel' : ''}${rowFade ? ' fade' : ''}`} aria-selected={isAB}>
      <th scope="row" data-r={r} data-k={0} tabIndex={tab(0)} title={label}>
        <span className="bm-rh">
          {ab && <b className="bm-ab">{ab}</b>}
          <span className="bm-rl">{label}</span>
          <span className="bm-rn">{m.bus.cells[r].length}</span>
        </span>
      </th>
      {slots.map((s, i) => {
        if (s.kind === 'gap') return <td key={i} className="bm-gap" aria-hidden="true" />;
        if (s.kind === 'band') {
          const bd = bands[s.b];
          const used = bd.cols.filter((c) => set.has(c));
          const nHot = view.cmp && isAB ? used.filter((c) => view.diff.has(c)).length : 0;
          const full = s.w - 26;
          const cls = view.cmp ? (isAB ? 'both' : 'fade') : dim !== null ? 'fade' : isAB ? 'sel' : '';
          return (
            <td key={i} className={`bm-b ${cls}`} data-r={r} data-k={s.k} tabIndex={tab(s.k)}
              aria-label={used.length ? `${label} lists ${used.length} of the ${bd.cols.length} dimensions ${bd.label}` : `${label}, ${bd.cols.length} dimensions ${bd.label}`}>
              {used.length > 0 && (
                <>
                  <i className="bm-bb" style={{ width: Math.max(2, (used.length / bd.cols.length) * full) }} />
                  {nHot > 0 && <i className="bm-bb hot" style={{ width: Math.max(2, (nHot / bd.cols.length) * full) }} />}
                  <span className="bm-bn">{used.length}</span>
                </>
              )}
            </td>
          );
        }
        const c = s.c;
        const on = set.has(c);
        let cls = '';
        if (on) {
          if (view.cmp) cls = isAB ? (view.shared.has(c) ? 'both' : 'hot') : 'fade';
          else if (dim !== null) cls = c === dim ? 'hot' : 'fade';
          else if (isAB) cls = 'sel';
        }
        const hc = !view.cmp && dim === c ? ' hc' : '';
        return (
          <td key={i} className={`bm-c${on ? ' on' : ''} ${cls}${hc}`} data-r={r} data-k={s.k} data-c={c} tabIndex={tab(s.k)}
            aria-label={on ? `${label} lists ${names[c]}` : `${label}, ${names[c]}`}>
            {on && <i style={{ width: Math.min(8, s.w - 4), height: Math.min(8, s.w - 4) }} />}
          </td>
        );
      })}
    </tr>
  );
});
