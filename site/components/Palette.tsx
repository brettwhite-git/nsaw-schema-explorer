// The search palette (⌘K / Ctrl-K / "/" or the search button; the Shell owns the shortcuts and the open state).
// A modal dialog with a combobox over a listbox: ↑ ↓ move, Enter opens, Esc closes, Tab stays inside, focus goes
// back where it was on close. Top results grouped by kind, then "See all results" for /search?q=.
// Results come from the core index at once and fill in when columns.json loads. Full screen on a phone.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { fmt, search, type ItemKind, type SearchItem } from '../../explorer/data';
import { navigate } from '../router';
import { searchPath } from '../routes';
import { KIND_GROUP, itemHref, useSearchModel } from './search/model';
import { Glass, ResultRow, StartRow, startEntries } from './search/parts';

export interface PaletteProps {
  open: boolean;
  onClose: () => void;
}

const TOP = 8;

export function Palette({ open, onClose }: PaletteProps) {
  if (!open) return null;
  return <PaletteDialog onClose={onClose} />;
}

type Option = { id: string; href: string } & ({ type: 'item'; it: SearchItem } | { type: 'start'; i: number } | { type: 'all' });

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const { index, m, cm, extended } = useSearchModel({ columns: true });
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const restore = useRef(true);

  // Remember the focused element, lock page scroll, and give focus back on close.
  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
      const el = returnTo.current;
      if (restore.current && el && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, []);

  const query = q.trim();
  const res = useMemo(() => (index && query ? search(index, query) : null), [index, query, extended]);
  const top = res ? res.results.slice(0, TOP) : [];

  // Group the top results by kind, in the order each kind first appears.
  const groups = useMemo(() => {
    const g: { kind: ItemKind; items: SearchItem[] }[] = [];
    for (const it of top) {
      const hit = g.find((x) => x.kind === it.kind);
      if (hit) hit.items.push(it); else g.push({ kind: it.kind, items: [it] });
    }
    return g;
  }, [res]); // eslint-disable-line react-hooks/exhaustive-deps

  const starts = m && !query ? startEntries(m, cm) : [];
  const options: Option[] = useMemo(() => {
    if (!m) return [];
    if (!query) return starts.map((e, i) => ({ id: `pal-s${i}`, href: e.href, type: 'start' as const, i }));
    const out: Option[] = [];
    for (const g of groups) for (const it of g.items) out.push({ id: `pal-${out.length}`, href: itemHref(m, cm, it), type: 'item', it });
    if (res && res.total) out.push({ id: 'pal-all', href: searchPath(query), type: 'all' });
    return out;
  }, [groups, m, cm, query, res]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(0); }, [query]);
  const cur = Math.min(sel, Math.max(0, options.length - 1));

  const close = (back = true) => { restore.current = back; onClose(); };
  const go = (href: string) => { close(false); navigate(href); };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!options.length) return;
      const n = (cur + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      setSel(n);
      document.getElementById(options[n].id)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[cur]) go(options[cur].href);
      else if (query) go(searchPath(query));
    }
  };

  // Esc closes and Tab stays inside the dialog.
  const onDialogKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...(dialogRef.current?.querySelectorAll<HTMLElement>('input, button, [href]:not([tabindex="-1"])') ?? [])];
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
    e.preventDefault();
    f[n].focus();
  };

  const optIndex = (id: string) => options.findIndex((o) => o.id === id);
  let k = 0;

  return (
    <div className="pal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={dialogRef} className="pal" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onDialogKey}>
        <div className="pal-bar">
          <Glass size={18} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search tables, columns, NetSuite fields, subject areas"
            aria-expanded={options.length > 0}
            aria-controls="pal-list"
            aria-autocomplete="list"
            aria-activedescendant={options[cur]?.id}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Search tables, columns, NetSuite fields"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <button type="button" className="pal-close" onClick={() => close()}>
            <span className="pal-close-k">esc</span><span className="pal-close-t">Close</span>
          </button>
        </div>

        <div className="pal-body">
          {!m && <p className="pal-note">Loading the lineage files…</p>}
          {m && !query && (
            <>
              <p className="pal-group" id="pal-g-start">Start here</p>
              <ul className="results pal-list" id="pal-list" role="listbox" aria-labelledby="pal-g-start">
                {starts.map((e, i) => <StartRow key={e.name} e={e} id={`pal-s${i}`} selected={cur === i} onHover={() => setSel(i)} onOpen={go} />)}
              </ul>
              <p className="pal-note">Type a table, column, NetSuite field or subject area. Filters work here too: <span className="mono">grain:line</span>, <span className="mono">type:fact</span>, <span className="mono">shared:yes</span>.</p>
            </>
          )}
          {m && query && res && (
            res.total ? (
              <div id="pal-list" role="listbox" aria-label="Results">
                {groups.map((g) => (
                  <div role="group" aria-labelledby={`pal-g-${g.kind}`} key={g.kind}>
                    <p className="pal-group" id={`pal-g-${g.kind}`} role="presentation">{KIND_GROUP[g.kind]}</p>
                    <ul className="results pal-list" role="presentation">
                      {g.items.map((it) => {
                        const id = `pal-${k++}`;
                        const i = optIndex(id);
                        return <ResultRow key={id} m={m} cm={cm} it={it} text={res.text} id={id} selected={cur === i} onOpen={go} onHover={() => setSel(i)} />;
                      })}
                    </ul>
                  </div>
                ))}
                <div
                  id="pal-all"
                  role="option"
                  aria-selected={options[cur]?.id === 'pal-all'}
                  className={`pal-all${options[cur]?.id === 'pal-all' ? ' sel' : ''}`}
                  onMouseMove={() => setSel(options.length - 1)}
                  onClick={() => go(searchPath(query))}
                >
                  See all {fmt(res.total)} results <span aria-hidden="true">→</span>
                  {!extended && <span className="pal-loading"> Columns and fields are still loading.</span>}
                </div>
              </div>
            ) : (
              <div className="pal-none" aria-live="polite">
                <p>Nothing here matches <span className="mono">{query}</span>.</p>
                {!extended && <p className="pal-note">Columns and NetSuite fields are still loading.</p>}
                <p className="tries"><i>Try</i>
                  {['is:table', 'type:fact', 'shared:yes'].map((x) => <button type="button" key={x} onClick={() => { setQ(`${x} ${query.split(/\s+/)[0]}`); inputRef.current?.focus(); }}>{x} {query.split(/\s+/)[0]}</button>)}
                </p>
              </div>
            )
          )}
        </div>

        <div className="pal-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
