// What the scene says that is REAL (read from the ontology at runtime) and what is INVENTED (the order).
import type { Ontology } from '../../../ontology/load';

/** The invented order. One illustration label says so (DESIGN.md 0a, principle 9). */
export const ORDER = {
  no: 'SO1041',
  customer: 'Harbor Supply Co.',
  customerKey: '88',
  date: '2026-03-04',
  line1: { item: 'Pallet jack', itemKey: '12', qty: 4, rate: '310.00', amount: '1,240.00' },
  line2: { item: 'Shrink wrap', qty: 3, rate: '103.50', amount: '310.50' },
} as const;

/** The four record kinds the scene shows. Names are looked up in the ontology so casing is exactly the data's. */
export const RECORD_KEYS = { header: 'Transactions', line: 'TransactionLine', customer: 'customer', item: 'item' } as const;

export interface Names {
  header: string;
  line: string;
  customer: string;
  item: string;
  /** how many kinds of record the lineage names explicitly; null when no ontology was given */
  count: number | null;
}

/** Fallback only for a scene mounted without an ontology (the number is then left out, never invented). */
export const FALLBACK_NAMES: Names = { ...RECORD_KEYS, count: null };

export function resolveNames(o?: Ontology): Names {
  if (!o) return FALLBACK_NAMES;
  const name = (key: string): string => {
    const i = o.find('netsuiteRecord', key);
    return i === undefined ? key : o.get('netsuiteRecord', i).name;
  };
  return {
    header: name(RECORD_KEYS.header),
    line: name(RECORD_KEYS.line),
    customer: name(RECORD_KEYS.customer),
    item: name(RECORD_KEYS.item),
    count: o.core.meta.counts.explicitNetsuiteRecords,
  };
}

export const TITLE = 'How NetSuite Data Intelligence is put together.';
export const START_NOTE = 'It starts with one order.';
export const HEADLINE = ['One form on the screen.', 'Several records underneath.'] as const;
export const CALLOUT_C = 'Pointers, not copies. The line reaches its customer through its header; the customer\u2019s name lives in one place.';
export const CALLOUT_C_SHORT = 'Pointers, not copies: the customer\u2019s name lives in one place.';
export const NOTE_LINES = ['the line we follow'] as const;
export const CLOSING = 'Where a fact is born is not where you ask questions about it.';
export const SLIPS = [
  { id: 'slip1', title: 'one person\u2019s definition', body: 'sales: when ordered' },
  { id: 'slip2', title: 'one person\u2019s definition', body: 'sales: when shipped' },
  { id: 'slip3', title: 'one person\u2019s definition', body: 'sales: when invoiced' },
] as const;
export const OUTSIDE = ['web store', 'web analytics', 'marketing', 'legacy system'] as const;
export const TIME_LABELS = { before: 'nothing before go-live', live: 'go-live 1 Jan 2024' } as const;
export const CAPTION = 'Record names and counts are NetSuite\u2019s. The order and what is drawn around it are an illustration.';
