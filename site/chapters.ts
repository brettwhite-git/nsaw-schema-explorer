// The nine chapters (from the plan) and the lazy content registry.
import type { ChapterContent } from '../content/types';

export interface ChapterEntry {
  number: number;
  id: string;
  title: string;
  blurb: string;
  figure: string;
  drawn: boolean;
}

export const CHAPTERS: ChapterEntry[] = [
  { number: 1, id: 'follow-one-order-line', title: 'Follow one order line', blurb: 'One line on one sales order, followed from the NetSuite form to a number on a report.', figure: 'record, split, fact and dimension rows, report number', drawn: true },
  { number: 2, id: 'why-a-warehouse-exists', title: 'Why a warehouse exists', blurb: 'A ledger is asked a question it is bad at; a library and a filing cabinet explain why.', figure: 'a ledger asked a question', drawn: false },
  { number: 3, id: 'facts-dimensions-grain', title: 'Facts, dimensions, grain', blurb: 'A sewn star. A ruler sets the grain, and mixing grains double-counts.', figure: 'the sewn star, a ruler', drawn: false },
  { number: 4, id: 'shared-dimensions', title: 'Shared dimensions', blurb: 'Two facts reconcile through one Customer, and the bus matrix assembles itself.', figure: 'the bus matrix', drawn: false },
  { number: 5, id: 'star-and-cube', title: 'Star and cube', blurb: 'Rows fly to isometric cells; one is kicked out; both lanes end at the same total.', figure: 'rows into cells', drawn: false },
  { number: 6, id: 'the-model-is-the-product', title: 'The model is the product', blurb: 'Thirteen lines of SQL collapse to three picks, and a join resolves.', figure: 'SQL collapsing to picks', drawn: false },
  { number: 7, id: 'bronze-silver-gold', title: 'Bronze, silver, gold, two doors', blurb: 'Data rises a layer per engine; the same number comes out of either door.', figure: 'layers rising', drawn: false },
  { number: 8, id: 'getting-data-in', title: 'Getting data in and extending', blurb: 'Augmentation\'s three objects, two statuses, and a naming decoder.', figure: 'the naming decoder', drawn: false },
  { number: 9, id: 'who-sees-what', title: 'Who sees what', blurb: 'The same query for two users: rows fade, columns mask.', figure: 'rows fade, columns mask', drawn: false },
];

/** Chapter content by id. Only drawn chapters are listed; each is its own lazily loaded module. */
const LOADERS: Record<string, () => Promise<{ default: ChapterContent }>> = {
  'follow-one-order-line': () => import('../content/ch01'),
};

export async function loadChapter(id: string): Promise<ChapterContent | undefined> {
  const l = LOADERS[id];
  return l ? (await l()).default : undefined;
}

export const isDrawn = (id: string): boolean => id in LOADERS;
