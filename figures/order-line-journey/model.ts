// The pure state model of the order-line-journey figure: no DOM, no measuring, no timers.
// Everything the figure shows is an Item. An item knows the step that introduces it, the focus groups
// in which it takes the accent, and (for lines) how it was known: explicit, inferred or illustrative.
// layout.ts turns widths into Items; render.ts draws them; tests/order-line-journey.test.ts asserts the rules.
import type { AtlasRef } from '../../content/types';

export type Prov = 'explicit' | 'inferred' | 'illustrative';
export const STEP_COUNT = 8;

/** The one accent group of each step (storyboard "Accent"). Exactly one per step. */
export type FocusId = 'form-l1' | 'rec-line' | 'wh-lines' | 'fact-row' | 'grain' | 'rec-trans' | 'pill-p1' | 'number';
export const FOCUS_BY_STEP: FocusId[] = ['form-l1', 'rec-line', 'wh-lines', 'fact-row', 'grain', 'rec-trans', 'pill-p1', 'number'];
export const focusOf = (step: number): FocusId => FOCUS_BY_STEP[Math.max(0, Math.min(STEP_COUNT - 1, step))];

export interface StepMeta { id: string; caption: string; alt: string }
export const STEPS: StepMeta[] = [
  { id: 'one-form', caption: 'One sales order as typed. Invented for the example.',
    alt: 'Step 1 of 8. A sales order form, SO1041 for Harbor Supply Co., with two lines. Line 1, a pallet jack at 1,240.00, is underlined and a pencil thread leaves it.' },
  { id: 'several-records', caption: 'The form, split into the records NetSuite keeps.',
    alt: 'Step 2 of 8. A pencil spine splits the form into five NetSuite records: Transactions, TransactionLine, transactionaccountingline (drawn in pencil, not in the lineage file), customer and item. The line record is marked.' },
  { id: 'rows-land', caption: 'Rows land in tables named for what they hold. Table names drop the DW_NS_ prefix.',
    alt: 'Step 3 of 8. Three solid threads carry rows from the records into three warehouse tables: SALES_ORDER_F, SALES_ORDER_LINES_F and CUSTOMER_D. The order number TRANID and the column TRANSACTION are marked. The line table is marked.' },
  { id: 'fact-and-dimensions', caption: 'The line is a fact row. The things it points at are dimension rows.',
    alt: 'Step 4 of 8. The line fact table shows row 1 with keys 1, 88 and 5120. Three stitched, inferred links join it to the dimension tables CUSTOMER_D, ITEM_D and DAY_D. Row 1 is marked.' },
  { id: 'grain', caption: 'One row is one line, on one order, in one accounting book.',
    alt: 'Step 5 of 8. The grain keys ID and TRANSACTION are underlined. A pencil BOOK column and an invented second row show one line in two accounting books. ACCOUNTINGBOOK_D joins by an inferred link. A pencil SOURCE_RECORD_ID joins the keys.' },
  { id: 'one-record-many-tables', caption: 'One NetSuite record, many warehouse fact tables.',
    alt: 'Step 6 of 8. Behind SALES_ORDER_F a stack of three more fact tables stands for 87 that load from the one Transactions record. TransactionLine feeds 65. The Transactions record and its fan of threads are marked.' },
  { id: 'business-name', caption: 'The subject area is a view over the tables above, not another copy.',
    alt: 'Step 7 of 8. The subject area NetSuite - Sales Order gives business names to columns: Sales Order Line Number, Customer Company Name and Line Amount in Base Currency. The amounts come from the secured twin SALES_ORDER_LINES_F_SEC. Sales Order Line Number is marked.' },
  { id: 'the-number', caption: 'The number, and the way back to the form. Values invented; the path is real.',
    alt: 'Step 8 of 8. A report shows Harbor Supply Co. with 1,550.50, the sum of 1,240.00 and 310.50. An accent thread runs back from that number through the lines and the tables to the two lines of the form. Values are invented; the path is real.' },
];

/** First underscore break that leaves 12 or more characters on the first line (storyboard: SALES_ORDER_ / LINES_F_SEC). */
export function breakLabel(label: string, min = 12): string[] {
  for (let i = 0; i < label.length; i++) if (label[i] === '_' && i + 1 >= min && i + 1 < label.length) return [label.slice(0, i + 1), label.slice(i + 1)];
  return [label];
}
export const shortName = (n: string): string => n.replace(/^DW_NS_/, '');

// ---------------------------------------------------------------- items
export type Layer = 'back' | 'lines' | 'boxes' | 'text' | 'top';
export type Pt = [number, number];
export interface Tip { lines: string[]; /** where the tip hangs from */ x: number; y: number; place: 'below' | 'above' | 'right' | 'left' }
/** What a hover or focus lights (element ids), whether the rest drops to 30%, and its tip. */
export interface HoverDef {
  lit: string[];
  /** hovering this alone takes the accent from the step's own focus, even when nothing else is lit */
  solo?: boolean;
  dim?: boolean;
  /** tips by the step they start at (the last one whose fromStep <= current step shows) */
  tips?: { fromStep: number; tip: Tip }[];
}

interface Base {
  id: string;
  /** the step that introduces it. Elements only accumulate (callouts are step-scoped, see `scoped`). */
  step: number;
  /** focus groups in which this element takes the accent */
  acc?: FocusId[];
  /** hover/focus key, resolved in Spec.hovers */
  hk?: string;
  /** an Atlas page this element opens */
  ref?: AtlasRef;
  /** draw order inside its step: lower first (storyboard "Draw order inside a transition") */
  ord: number;
  /** a callout is only present while its own step is current */
  scoped?: boolean;
  /** the next group starts when this one ends, not halfway (the backward thread is sewn one segment after another) */
  seq?: boolean;
}

export interface FormItem extends Base { k: 'form'; x: number; y: number; w: number; h: number }
export interface RecItem extends Base { k: 'rec'; x: number; y: number; w: number; h: number; name: string; cap: string; pencil?: boolean }
export interface TagItem extends Base { k: 'tag'; x: number; y: number; w: number; h: number; lines: string[]; full: string; fs: number }
export interface HexItem extends Base { k: 'hex'; x: number; y: number; w: number; h: number; full: string }
export interface PillItem extends Base { k: 'pill'; x: number; y: number; w: number; h: number; lines: string[] }
export interface GhostItem extends Base { k: 'ghost'; x: number; y: number; w: number; h: number }
export interface CellDef { text: string; hk?: string; /** accent in these focus groups */ acc?: FocusId[]; pencil?: boolean }
export interface TableItem extends Base {
  k: 'table'; x: number; y: number;
  cols: { w: number; head: string; hk?: string; headAcc?: FocusId[]; pencil?: boolean }[];
  rows: { cells: CellDef[]; pencil?: boolean; acc?: FocusId[] }[];
  /** fixed height of the table frame (drawers reserve their three rows) */
  rowH: number; headH: number; fs: number; headFs: number;
}
export interface LineItem extends Base {
  k: 'line'; prov: Prov; d: string; seed: number;
  /** knots at both ends (stitched threads always, solid threads where they meet a tag) */
  knots?: [Pt, Pt] | [Pt] | null;
  /** an accent overlay that repeats another line's path (the backward thread) */
  overlayOf?: string;
  /** reveal from the end of the path back to its start (the backward thread) */
  rev?: boolean;
  len?: number;
  dur?: number;
}
export interface BoxItem extends Base {
  k: 'box'; x: number; y: number; w: number; h: number; pencil?: boolean; seed: number; paper?: boolean;
  /** text inside, written in: lines with face */
  texts?: { x: number; y: number; t: string; face: 'mono' | 'serif' | 'serifi'; px: number; anchor?: 'start' | 'middle' | 'end'; acc?: FocusId[]; muted?: boolean }[];
  /** extra rules (hairline pencil) as [x0,y0,x1,y1] */
  rules?: [number, number, number, number][];
}
export interface TextItem extends Base {
  k: 'text'; x: number; y: number; t: string; face: 'mono' | 'serif' | 'serifi'; px: number; anchor?: 'start' | 'middle' | 'end'; muted?: boolean; rot?: number;
}
export interface UnderlineItem extends Base { k: 'under'; x0: number; x1: number; y: number; seed: number }
export interface CalloutItem extends Base { k: 'callout'; letter: string; x: number; y: number; tx: number; ty: number }
export interface LegendItem extends Base { k: 'legend'; x: number; y: number; w: number }
export interface RuleItem extends Base { k: 'rule'; x0: number; x1: number; y: number; seed: number }

export type Item = FormItem | RecItem | TagItem | HexItem | PillItem | GhostItem | TableItem | LineItem | BoxItem | TextItem
  | UnderlineItem | CalloutItem | LegendItem | RuleItem;

export interface Spec {
  W: number;
  H: number;
  layout: 'wide' | 'phone';
  items: Item[];
  hovers: Record<string, HoverDef>;
  /** per step: the vertical span [y0, y1] of what that step adds (the phone camera follows it) */
  view: [number, number][];
  /** the caption of each step, wrapped for this width */
  captions: string[][];
  /** x offset the drawing is centred by */
  ox: number;
}

export const layerOf = (it: Item): Layer => {
  switch (it.k) {
    case 'ghost': return 'back';
    case 'line': return 'lines';
    case 'callout': return 'top';
    case 'text': case 'under': case 'rule': return 'text';
    default: return 'boxes';
  }
};

/** Items present at a step. Callouts are only present at their own step. */
export function itemsAt(items: Item[], step: number): Item[] {
  return items.filter((i) => (i.scoped ? i.step === step : i.step <= step));
}

/** Which elements take the accent at a step (those whose acc includes the step's focus). */
export function accentIds(items: Item[], step: number): string[] {
  const f = focusOf(step);
  const out: string[] = [];
  for (const it of itemsAt(items, step)) {
    let on = !!it.acc?.includes(f);
    if (it.k === 'table') {
      if (it.rows.some((r) => r.acc?.includes(f) || r.cells.some((c) => c.acc?.includes(f))) || it.cols.some((c) => c.headAcc?.includes(f))) on = true;
    }
    if (it.k === 'box' && it.texts?.some((t) => t.acc?.includes(f))) on = true;
    if (on) out.push(it.id);
  }
  return out;
}

/** The items that draw the thread back from the report; clicking the number replays exactly these. */
export const BACKWARD_IDS = ['rep-p3', 'bk-p3', 'bk-twin', 'bk-t2', 'bk-t1', 'bk-t1r2', 'ul-form-2', 'ul-base-1', 'ul-base-2'];
