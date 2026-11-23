// The inspector sidecar: ONE panel for every page (area, matrix, table, field). It shows what is selected, its key
// figures, one small visual, and where to go next. Pages build its props with the builders in
// ./inspector/builders.tsx (inspectArea, inspectFact, inspectDimension, inspectTable) or by hand.
//
// Contract (the matrix, table and field pages rely on it):
//
//   <InspectorLayout head={<header…/>} inspector={<Inspector {...props} />}>…page body…</InspectorLayout>
//
//   <Inspector
//     kind="fact" | "dimension" | "table" | "area" | "field" | "column"   // data-kind on the panel (styling hooks)
//     eyebrow="fact table"           // small caps line above the title
//     title="Sales Order Lines"      // serif, the readable name
//     mono?="DW_NS_SALES_ORDER_LINES_F"  // the physical name, in mono under the title
//     lead?="One row per sales order transaction line."   // one italic sentence (stated data only)
//     figures?={[{ n: 26, label: 'tables its diagram relates it to' }, { n: 2, of: 4, label: '…' }]}
//     visual?={<InspectorVisual caption="…"><MiniStar …/></InspectorVisual>}
//     actions?={[{ label: 'Open the table star', sub: 'the data model, the column ledger', to: '/table/…' }]}
//     onClose?={() => setQuery({ sel: null })}  // when given, a "Back to …" control drops the selection
//     closeLabel?="Back to Sales Order"         // the text of that control (default "Clear the selection")
//   >
//     {details?}   // optional children: longer lists (facts and grain, report folders, report names), each wrapped
//                  // in <InspectorSection title count?>; they sit below "Go next", so the actions stay in view
//   </Inspector>
//
// Order inside, on every page: eyebrow, title, mono name, lead, figures, visual, Go next, details, back control.
//
// Behaviour: sticky beside the page body on wide screens (340px), foldable to a 52px rail with its button. Esc drops
// the selection when `onClose` is given, and folds the panel otherwise (ignored while a dialog is open, a menu is
// open or a text field has focus); the folded state is remembered per browser.
// Keyboard: the fold button and every link are tab stops; folding moves focus to the rail and back. Under 760px
// the panel becomes an inline card under the page title (InspectorLayout places it) and does not fold.
// Copy inside follows the copy rule: positive figures only; leave a figure out rather than show a zero.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Figures, GoNext, type InspectorAction, type InspectorFigure } from './inspector/pieces';

export type { InspectorAction, InspectorFigure } from './inspector/pieces';
export { Figures, FactDots, GoNext, InspectorVisual, MiniStar, ReachBar } from './inspector/pieces';

export type InspectorKind = 'fact' | 'dimension' | 'table' | 'area' | 'field' | 'column';

export interface InspectorProps {
  kind: InspectorKind;
  eyebrow: string;
  title: string;
  mono?: string;
  lead?: string | null;
  figures?: InspectorFigure[];
  visual?: ReactNode;
  actions?: InspectorAction[];
  onClose?: () => void;
  closeLabel?: string;
  /** longer detail lists, below "Go next" */
  children?: ReactNode;
}

/** A titled block of details inside the inspector (a list, a few bars, a note). */
export function InspectorSection({ title, count, children }: { title: string; count?: number | string; children: ReactNode }) {
  return (
    <section className="ins-sec">
      <h3 className="ins-sh"><span>{title}</span>{count !== undefined && <span className="n">{count}</span>}</h3>
      {children}
    </section>
  );
}

/** "Go next": never the page you are on, no repeats, at most four (the builders list the most useful first). */
function nextSteps(actions: InspectorAction[]): InspectorAction[] {
  const here = typeof location === 'undefined' ? '' : location.pathname;
  const seen = new Set<string>();
  return actions.filter((a) => {
    const path = a.to.split(/[?#]/)[0];
    if (path === here || seen.has(a.to)) return false;
    seen.add(a.to);
    return true;
  }).slice(0, 4);
}

const KEY = 'explorer-inspector-folded';
const readFolded = (): boolean => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const writeFolded = (v: boolean) => { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* storage off */ } };
const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};
const isPhone = () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 759px)').matches;

export function Inspector({ kind, eyebrow, title, mono, lead, figures = [], visual, actions = [], onClose, closeLabel, children }: InspectorProps) {
  const [folded, setFolded] = useState(readFolded);
  const moved = useRef(false);
  const root = useRef<HTMLElement>(null);
  const set = (v: boolean) => { moved.current = true; writeFolded(v); setFolded(v); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || typing(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if ((e.target as HTMLElement | null)?.closest?.('details[open]')) return;
      if (onClose) { e.preventDefault(); onClose(); return; }
      if (folded || isPhone()) return;
      set(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [folded, onClose]);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    root.current?.querySelector<HTMLElement>(folded ? '.ins-rail' : '.ins-fold')?.focus();
  }, [folded]);

  const fold = folded && !isPhone();
  return (
    <aside ref={root} className={fold ? 'ins folded' : 'ins'} data-kind={kind} aria-label="Inspector">
      {fold ? (
        <button type="button" className="ins-rail" aria-expanded="false" aria-controls="ins-body" onClick={() => set(false)}>
          <span>Inspector</span><b>{title}</b>
        </button>
      ) : (
        <div className="ins-in" id="ins-body">
          <div className="ins-top">
            <span className="ins-kind">{eyebrow}</span>
            <button type="button" className="ins-fold" aria-expanded="true" aria-controls="ins-body" title="Fold the inspector" onClick={() => set(true)}>
              <span aria-hidden="true">›</span><span className="visually-hidden">Fold the inspector</span>
            </button>
          </div>
          <h2 className="ins-name">{title}</h2>
          {mono && mono !== title && <p className="ins-mono mono">{mono}</p>}
          {lead && <p className="ins-lead">{lead}</p>}
          <Figures items={figures} />
          {visual}
          <GoNext actions={nextSteps(actions)} />
          {children}
          {onClose && <button type="button" className="ins-back linkbtn" onClick={onClose}>{closeLabel ?? 'Clear the selection'}</button>}
          <p className="ins-foot">{onClose ? 'Esc clears the selection' : 'Esc folds the inspector'}</p>
        </div>
      )}
    </aside>
  );
}

/**
 * Page frame with the inspector: the head (title block) and body on the left, the inspector sticky on the right.
 * Under 760px the inspector sits between the head and the body as an inline card.
 */
export function InspectorLayout({ head, inspector, children, className }: { head: ReactNode; inspector: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `ins-page ${className}` : 'ins-page'}>
      <div className="ins-head">{head}</div>
      {inspector}
      <div className="ins-body">{children}</div>
    </div>
  );
}
