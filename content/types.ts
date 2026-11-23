/**
 * Chapter content contract for the Course.
 *
 * A chapter is a sequence of steps. Each step owns a block of copy and names the
 * state (`figureStep`) the chapter's figure should be in while that step is on screen.
 * Copy is plain text with two inline marks only: *emphasis* and `code`.
 */

/** How a statement is known. Drives line style in figures and a small mark in copy. */
export type Provenance = 'explicit' | 'inferred' | 'illustrative';

/** A pointer into the ontology (see ontology/types.ts for node types). */
export interface AtlasRef {
  /** Ontology node type, e.g. 'physicalTable', 'concept', 'netsuiteRecord', 'subjectArea'. */
  type: string;
  /** Natural key of the node, e.g. 'DW_NS_SALES_ORDER_LINES_F' or 'NetSuite - Sales Order'. */
  key: string;
}

/** "Pull this thread": a link from a step into the Atlas. */
export interface Thread {
  label: string;
  to: AtlasRef;
  provenance: Provenance;
}

/** A lettered callout, (a), (b), (c), tied to a part of the figure. */
export interface Callout {
  letter: string;
  text: string;
}

export interface ChapterStep {
  id: string;
  heading: string;
  /** Paragraphs. Inline marks: *emphasis* and `code` only. */
  body: string[];
  /** Handwritten margin note (short; one or two lines). */
  note?: string;
  callouts?: Callout[];
  threads?: Thread[];
  /** Index of the figure state shown while this step is in view. */
  figureStep: number;
}

export interface ChapterContent {
  /** URL slug, e.g. 'follow-one-order-line'. */
  id: string;
  number: number;
  title: string;
  /** One or two sentences under the title. */
  dek: string;
  /** Key in the figure registry for this chapter's figure. */
  figure: string;
  /** Shown once per chapter when any figure data is invented. */
  illustrativeNote?: string;
  steps: ChapterStep[];
}
