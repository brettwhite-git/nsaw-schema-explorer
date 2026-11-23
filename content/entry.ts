// Copy for the site's entry piece, "How NetSuite Data Intelligence is put together" (the climbing section).
// Claims are the verified ones from the owner's deck (~/Projects/nsaw-master-deck, slides 02 to 06): contrasts, plain,
// no hype. Numbers are NOT typed here: counts are filled from the ontology at run time (site/Entry.tsx).
//
// Provenance per part: explicit = the tiles are rows of the lineage file; illustrative = documented by Oracle and the
// deck, not in the lineage file (drawn in pencil).
import type { Provenance } from './types';

export interface Part {
  /** band index, bottom to top; the doors are index 4 */
  band: number;
  id: 'netsuite' | 'ingestion' | 'warehouse' | 'model' | 'doors';
  name: string;
  claim: string;
  provenance: Provenance;
  source: string;
  /** chapter that tells this part's story (id in site/chapters.ts) */
  chapter: string;
}

export const PARTS: Part[] = [
  { band: 0, id: 'netsuite', name: 'NetSuite', claim: 'The only place a fact is born. Everything above is a copy of it, or a model of it.', provenance: 'explicit', source: 'Each record is a NetSuite record that the lineage file names as a source.', chapter: 'follow-one-order-line' },
  { band: 1, id: 'ingestion', name: 'Ingestion', claim: 'Oracle runs the pipeline that lands the rows. It moves rows, not forms.', provenance: 'illustrative', source: 'From Oracle’s documentation, not the lineage file.', chapter: 'getting-data-in' },
  { band: 2, id: 'warehouse', name: 'The warehouse', claim: 'Tables of rows, one grain each. Facts hold the events. Dimensions hold what the events point at.', provenance: 'explicit', source: 'Each tile is a DW_NS table that appears in the lineage file.', chapter: 'facts-dimensions-grain' },
  { band: 3, id: 'model', name: 'The semantic model', claim: 'A model over the tables, not another copy of them.', provenance: 'explicit', source: 'Each tile is a subject area in the lineage file, grouped by functional area.', chapter: 'the-model-is-the-product' },
  { band: 4, id: 'doors', name: 'Two doors', claim: 'SQL tools read the tables, with no model in between. Analytics tools read the model, so everyone gets the same number. Pick the door before you pick the tool.', provenance: 'illustrative', source: 'From Oracle’s documentation and the deck, not the lineage file.', chapter: 'bronze-silver-gold' },
];

/** The verified two-doors claim, split between the two doors (the full sentence stays in PARTS). */
export const DOOR_CLAIMS = {
  a: 'SQL tools read the tables, with no model in between.',
  b: 'Analytics tools read the model, so everyone gets the same number.',
};

export const SECURITY = { name: 'Security', claim: 'A keyed gate on each door: duty roles, row rules and column rules.', source: 'From Oracle’s documentation, not the lineage file.' };

export const INGEST_LANES = [['managed', 'pipeline'], ['data', 'transforms'], ['data', 'augmentation']];

export const HEADLINE = ['How NetSuite Data Intelligence', 'is put together'];
export const SUBLINE = 'One order line, followed all the way up';
export const HINT = 'Start at the bottom. Scroll.';
export const HINT_STATIC = 'The whole section, then each part close up.';

/** The order form of chapter 1 (illustrative values, as in content/ch01.ts). */
export const FORM = {
  title: 'SALES ORDER  SO1041',
  customer: 'Harbor Supply Co.',
  line1: ['1  Pallet jack', '1,240.00'],
  line2: ['2  Shrink wrap', '310.50'],
};
export const WAREHOUSE_ROW = ['ID 1', 'CUSTOMER 88', 'TRANSACTION 5120'];

export interface Callout { letter: string; text: string[] }
/** Lettered call-outs per beat (close up), in the stage margins beside what they point at. */
export const CALLOUTS: Record<number, Callout[]> = {
  1: [{ letter: 'a', text: ['The form: one order,', 'typed once'] }, { letter: 'b', text: ['The records behind', 'the form'] }],
  2: [{ letter: 'a', text: ['Oracle’s conduits', 'land the rows'] }, { letter: 'b', text: ['Rows travel up,', 'forms do not'] }],
  3: [{ letter: 'a', text: ['Facts hold', 'the events'] }, { letter: 'b', text: ['Dimensions hold what', 'the events point at'] }],
  4: [{ letter: 'a', text: ['A subject area:', 'business names'] }, { letter: 'b', text: ['Each name is served', 'from a real column'] }],
  5: [{ letter: 'a', text: ['Door one: SQL', 'on the tables'] }, { letter: 'b', text: ['Door two: through', 'the model'] }],
};

export const BEAT_CAPTIONS = [
  { name: 'The ground', claim: 'One order line, followed all the way up.', count: '' },
];

export const LEGEND = { amber: 'one order line, followed all the way up', pencil: 'pencil: from Oracle’s documentation, not the lineage file' };
