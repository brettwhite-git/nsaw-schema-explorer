// Every word on screen in scenes 0 and 1 (the sheets in docs/entry-story.md, "Words on screen"). Voice rule: narration,
// present tense, no "X, not Y", no "if ... then", no "rather than", no "instead of" (tests/copy.test.ts lints this file).
export const SCENE0_WORDS = [
  'A customer comes to the counter with three questions.',
  'How do we compare with last year, when last year is in the old system?',
  'Why do we each have a different number?',
  "What about the web store and marketing data that isn't in NetSuite?",
  'The clerk pins up all three.',
  'The answers start downstairs, with one order.',
] as const;

export const SCENE1_WORDS = [
  'An order arrives. We follow this line.',
  'The clerk tears it into cards: one for the order, one for each line.',
  'Each card goes in its own drawer.',
  'Every card carries a note saying where to find the others.',
  'When a customer changes their name, the clerk changes one card.',
  'The cabinet was installed in January 2024. Older orders live in the old system.',
  'Three people measure the same order and read three numbers.',
  'Parcels arrive from the web store, marketing and the old system. The office has no drawer for them.',
  'The front office keeps today\'s business running.',
  'A copy of our line goes upstairs.',
] as const;

/** the three questions, in the customer's own words (hand-broken into two lines) and the pinned short forms */
export const QUESTION_LINES: [string, string][] = [
  ['How do we compare with last year,', 'when last year is in the old system?'],
  ['Why do we each have', 'a different number?'],
  ['What about the web store and marketing', "data that isn't in NetSuite?"],
];
export const QUESTION_SHORT = ['Last year?', 'Whose number?', 'Other systems?'] as const;

export const LEDGER = (count: number | null): string => `${count === null ? 'Many' : count} kinds of record, filed as they happen.`;

/** the plaques: the room's plain name and the product layer beneath */
export const ROOM_COPY = [
  { plain: 'front office', product: 'NetSuite' },
  { plain: 'post room', product: 'getting data in' },
  { plain: 'stock room', product: 'the warehouse' },
  { plain: 'catalogue desk', product: 'the semantic model' },
  { plain: 'counter and dock', product: 'the two ways out' },
] as const;

/** the other words drawn on objects in the scenes */
export const OBJECT_COPY = ['orders', 'lines', 'customers', 'items', 'the order', 'the customer', 'the item', 'ordered', 'shipped', 'invoiced', 'web store', 'web analytics', 'marketing', 'the old system', 'same order', 'cabinet installed', 'January 2024'] as const;
