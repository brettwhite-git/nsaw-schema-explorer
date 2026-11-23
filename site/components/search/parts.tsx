// Pieces of the search page and palette: a result row set like a book index, the "Start here" entries,
// the side column of figures, the keyboard hints and the magnifier.
import type { MouseEvent, ReactNode } from 'react';
import { fmt, type ColumnModel, type CoreModel, type SearchItem } from '../../../explorer/data';
import { Link } from '../../router';
import { fieldPath, tablePath } from '../../routes';
import {
  KIND_WORD, figures, highlightParts, isMono, itemContext, itemHref, itemNotes, itemReach, pct,
} from './model';

export function Glass({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" />
    </svg>
  );
}

export function Highlight({ label, text }: { label: string; text: string }) {
  const p = highlightParts(label, text);
  if (!p) return <>{label}</>;
  return <>{p[0]}<mark>{p[1]}</mark>{p[2]}</>;
}

export const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** ↑ ↓ move  ↵ open  ⌘K search  esc … */
export function Keys({ esc }: { esc: string }) {
  return (
    <span className="s-keys" aria-hidden="true">
      <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
      <span><kbd>↵</kbd> open</span>
      <span><kbd>{isMac() ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd> search</span>
      <span><kbd>esc</kbd> {esc}</span>
    </span>
  );
}

interface RowProps {
  m: CoreModel;
  cm: ColumnModel | null;
  it: SearchItem;
  text: string;
  id: string;
  selected: boolean;
  /** open the entry (plain click on the row or its link) */
  onOpen: (href: string) => void;
  onHover: () => void;
}

/** Plain clicks open through `onOpen`; modified clicks on the link keep the browser's behaviour (new tab and so on). */
function rowClick(href: string, onOpen: (href: string) => void) {
  return {
    onClick: (e: MouseEvent<HTMLElement>) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
      e.preventDefault();
      onOpen(href);
    },
  };
}

/** One index entry: kind in italics, the name, a context line, notes, and subject areas like a page number. */
export function ResultRow({ m, cm, it, text, id, selected, onOpen, onHover }: RowProps) {
  const ctx = itemContext(m, cm, it);
  const notes = itemNotes(cm, it);
  const reach = itemReach(it);
  const href = itemHref(m, cm, it);
  return (
    <li id={id} role="option" aria-selected={selected} className={`res${selected ? ' sel' : ''}`} onMouseMove={selected ? undefined : onHover} {...rowClick(href, onOpen)}>
      <span className="kind">{KIND_WORD[it.kind]}</span>
      <span className="nm">
        <Link to={href} tabIndex={-1} className={`t ${isMono(it.kind) ? 'mono' : 'serif'}`}>
          <Highlight label={it.label} text={text} />
        </Link>
        {ctx && <span className={`ctx${ctx.style === 'grain' ? ' gs' : ''}`}>{ctx.lead}{ctx.style === 'mono' ? <span className="mono">{ctx.text}</span> : ctx.text}</span>}
      </span>
      <span className="notes">{notes.map((n, i) => <span key={n}>{i > 0 && <i>·</i>}{n}</span>)}</span>
      <span className="reach">{reach && <><b>{reach.n}</b> {reach.unit}</>}</span>
    </li>
  );
}

export interface StartEntry { kind: string; name: string; note: string; href: string; areas: number | null }

/** The three ways in on an empty search: one fact table and two NetSuite field traces. */
export function startEntries(m: CoreModel, cm: ColumnModel | null): StartEntry[] {
  const t = m.tableByName.get('DW_NS_SALES_ORDER_LINES_F');
  const f = (k: string) => cm?.fieldByKey.get(k);
  const out: StartEntry[] = [];
  if (t !== undefined) out.push({ kind: 'table ledger', name: 'DW_NS_SALES_ORDER_LINES_F', note: 'Follow one order line from the NetSuite field to the report column.', href: tablePath('DW_NS_SALES_ORDER_LINES_F'), areas: cm ? cm.tableSas[t].length : null });
  const cn = f('customer.companyname'), tr = f('transactions.tranid');
  out.push({ kind: 'impact trace', name: 'customer.companyname', note: 'Everything downstream of one NetSuite field.', href: fieldPath('customer', 'companyname'), areas: cn !== undefined ? cm!.fieldSas[cn].length : null });
  out.push({ kind: 'impact trace', name: 'transactions.tranid', note: 'The document number, across every transaction table.', href: fieldPath('transactions', 'tranid'), areas: tr !== undefined ? cm!.fieldSas[tr].length : null });
  return out;
}

export function StartRow({ e, id, selected, onHover, onOpen }: { e: StartEntry; id?: string; selected?: boolean; onHover?: () => void; onOpen: (href: string) => void }) {
  return (
    <li id={id} role={id ? 'option' : undefined} aria-selected={id ? !!selected : undefined} className={`res${selected ? ' sel' : ''}`} onMouseMove={onHover} {...rowClick(e.href, onOpen)}>
      <span className="kind">{e.kind}</span>
      <span className="nm">
        <Link to={e.href} tabIndex={id ? -1 : undefined} className="t mono">{e.name}</Link>
        <span className="ctx">{e.note}</span>
      </span>
      <span className="notes" />
      <span className="reach">{e.areas !== null && <><b>{fmt(e.areas)}</b> areas</>}</span>
    </li>
  );
}

function Fact({ n, children }: { n: string; children: ReactNode }) {
  return <div className="fact"><b>{n}</b><span>{children}</span></div>;
}

/** Positive figures computed from the data, and the most shared dimensions. */
export function SideColumn({ m, cm }: { m: CoreModel; cm: ColumnModel | null }) {
  const f = figures(m, cm);
  return (
    <aside className="side s-side" aria-label="What the data states">
      <section>
        <h2 className="h3">What the data states</h2>
        <p className="note">Counted from the lineage files when the page loads.</p>
        <div className="facts">
          {f.stated && <Fact n={pct(f.stated)}>of warehouse columns have a NetSuite source stated in Oracle’s lineage ({fmt(f.stated[0])} of {fmt(f.stated[1])})</Fact>}
          {f.reaching && <Fact n={pct(f.reaching)}>of report columns reach a stated NetSuite field ({fmt(f.reaching[0])} of {fmt(f.reaching[1])})</Fact>}
          <Fact n={fmt(f.grained[0])}>of the {fmt(f.grained[1])} fact tables have a stated grain in the Entity Key List (_SEC copies counted apart)</Fact>
        </div>
      </section>
      <section>
        <h2 className="h3">Most shared dimensions</h2>
        <p className="note">How many of the {fmt(f.areas)} subject areas each one is read in.</p>
        <ul className="dims">
          {f.shared.map(({ t, n }) => (
            <li key={t}>
              <Link to={tablePath(m.tables[t].name)} className="dim"><span className="mono">{m.tables[t].name}</span><span className="n">{fmt(n)}</span></Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
