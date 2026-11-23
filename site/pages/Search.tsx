// The Index: /search?q=  A large search field with typed filter chips, tabs by kind, and ranked results set like
// a book index. With no query it shows ways in and a quiet side column of figures. Ported from lab/paper-lineage.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { chipText, fmt, FILTER_KEYS, parseQuery, plural, search, serializeQuery, type Chip, type FilterKey, type ItemKind, type SearchItem } from '../../explorer/data';
import { navigate, setQuery, useQuery } from '../router';
import { usePage } from '../usePage';
import { FILTERS, KIND_TAB, TAB_ORDER, figures, itemHref, useSearchModel } from '../components/search/model';
import { Glass, Keys, ResultRow, SideColumn, StartRow, isMac, startEntries } from '../components/search/parts';

const PAGE = 40;
const EXAMPLES = ['customer', 'sales order', 'tranid', 'type:dimension shared:yes', 'grain:line area:"Order to Cash"'];
const FILTER_HELP: [string, string][] = [
  ['grain:line', 'tables keyed per line; also document and book'],
  ['type:fact', 'warehouse role: fact, dimension, hierarchy'],
  ['area:"Order to Cash"', 'reaches a subject area in that functional area'],
  ['shared:yes', 'read in two or more subject areas'],
  ['is:field', 'one kind only: table, column, report, field, record, folder, area'],
];

/** Queries to offer when nothing matches: each filter dropped in turn, then the words alone, then the first word. */
function suggestions(chips: Chip[], text: string): string[] {
  const out: string[] = [];
  chips.forEach((_, i) => out.push(serializeQuery({ chips: chips.filter((__, j) => j !== i), text })));
  if (chips.length && text) out.push(text);
  const first = text.split(/\s+/)[0];
  if (first && first !== text) out.push(serializeQuery({ chips: [], text: first }));
  if (text.length > 4 && !text.includes(' ')) out.push(text.slice(0, Math.ceil(text.length * 0.6)));
  return [...new Set(out.filter(Boolean))].slice(0, 4);
}

export function Search() {
  const { q = '' } = useQuery();
  const { index, m, cm, extended, error } = useSearchModel({ columns: true });
  const parsed = useMemo(() => parseQuery(q), [q]);
  const { chips } = parsed;
  const hasQuery = !!(parsed.text || chips.length);

  // The input owns its free text while typing; the URL follows (debounced, replace).
  const [text, setText] = useState(parsed.text);
  const sent = useRef(q);
  useEffect(() => { if (q !== sent.current) { sent.current = q; setText(parseQuery(q).text); } }, [q]);
  const commit = (nq: string) => { sent.current = nq; setQuery({ q: nq || null }, { replace: true }); };
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const [tab, setTab] = useState<ItemKind | 'all'>('all');
  const [shownMax, setShownMax] = useState(PAGE);
  const [sel, setSel] = useState(0);
  useEffect(() => { setSel(0); setShownMax(PAGE); }, [q, tab]);

  const res = useMemo(() => (index ? search(index, parsed) : null), [index, parsed, extended]);
  const counts = useMemo(() => {
    const c = new Map<ItemKind, number>();
    for (const r of res?.results ?? []) c.set(r.kind, (c.get(r.kind) ?? 0) + 1);
    return c;
  }, [res]);
  const activeTab = tab !== 'all' && !counts.get(tab) ? 'all' : tab;
  const list = useMemo(() => (res ? (activeTab === 'all' ? res.results : res.results.filter((r) => r.kind === activeTab)) : []), [res, activeTab]);
  const shown = list.slice(0, shownMax);

  usePage({ title: hasQuery ? `Search: ${q}` : 'Search', ready: !!index && (extended || !!error) });

  const inputRef = useRef<HTMLInputElement>(null);
  const focusInput = () => requestAnimationFrame(() => { const i = inputRef.current; if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
  useEffect(() => { if (!hasQuery) inputRef.current?.focus({ preventScroll: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setChips = (next: Chip[], t = text) => { window.clearTimeout(timer.current); setText(t); commit(serializeQuery({ chips: next, text: t.trim() })); focusInput(); };
  const toggle = (f: string) => {
    const add = parseQuery(f).chips[0];
    const on = chips.some((c) => chipText(c) === f);
    setChips(on ? chips.filter((c) => chipText(c) !== f) : [...chips.filter((c) => c.k !== add.k), add]);
  };
  const setWhole = (nq: string) => { window.clearTimeout(timer.current); const p = parseQuery(nq); setText(p.text); commit(serializeQuery(p)); focusInput(); };

  const onInput = (v: string) => {
    setText(v);
    window.clearTimeout(timer.current);
    // A typed filter followed by a space becomes a chip at once.
    const mt = v.match(/(?:^|\s)(\w+):("[^"]*"|\S+)\s$/);
    if (mt && FILTER_KEYS.includes(mt[1].toLowerCase() as FilterKey)) {
      const p = parseQuery(v);
      setText(p.text ? p.text + ' ' : '');
      commit(serializeQuery({ chips: [...chips, ...p.chips], text: p.text }));
      return;
    }
    timer.current = window.setTimeout(() => commit(serializeQuery({ chips, text: v.trim() })), 120);
  };

  const open = (it: SearchItem) => { if (m) navigate(itemHref(m, cm, it)); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!shown.length) return;
      e.preventDefault();
      const n = Math.max(0, Math.min(shown.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
      setSel(n);
      document.getElementById(`sr-${n}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      window.clearTimeout(timer.current);
      if (shown[sel] && serializeQuery({ chips, text: text.trim() }) === q) open(shown[sel]);
      else commit(serializeQuery({ chips, text: text.trim() }));
    } else if (e.key === 'Backspace' && !text && chips.length) {
      e.preventDefault();
      setChips(chips.slice(0, -1), '');
    } else if (e.key === 'Escape' && (text || chips.length)) {
      e.preventDefault();
      setWhole('');
    }
  };

  const f = m ? figures(m, cm) : null;
  const tabs: (ItemKind | 'all')[] = ['all', ...TAB_ORDER.filter((k) => counts.get(k))];
  const starts = m ? startEntries(m, cm) : [];
  const tries = res && !res.total ? suggestions(chips, parsed.text) : [];

  return (
    <div className="grid s-page">
      <section className="main s-main">
        <div className="s-crumbs">
          <h1 className="s-h">{hasQuery ? 'Search' : 'Index'}</h1>
          <Keys esc="clear" />
        </div>
        {f && (
          <p className="lead">
            Search <b>{fmt(f.tables)}</b> warehouse tables
            {f.columns !== null && f.reportNames !== null && f.fields !== null
              ? <>, <b>{fmt(f.columns)}</b> columns, <b>{fmt(f.reportNames)}</b> report column names and <b>{fmt(f.fields)}</b> NetSuite fields.</>
              : <> and <b>{fmt(f.areas)}</b> subject areas.</>}
          </p>
        )}
        <div className="bigbar" role="search" onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}>
          <Glass size={20} />
          {chips.map((c, i) => (
            <span className="chip" key={`${c.k}:${c.v}:${i}`}>
              <i>{c.k}:</i><span className="mono">{c.v}</span>
              <button type="button" className="x" aria-label={`Remove filter ${chipText(c)}`} title="Remove filter" onClick={() => setChips(chips.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
          <input
            ref={inputRef}
            id="s-q"
            type="text"
            role="combobox"
            aria-label="Search"
            aria-expanded={hasQuery && shown.length > 0}
            aria-controls="s-results"
            aria-autocomplete="list"
            aria-activedescendant={hasQuery && shown[sel] ? `sr-${sel}` : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={chips.length ? 'Add words or filters' : 'customer, sales order, tranid…'}
            value={text}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKey}
          />
          <kbd className="bigbar-k" aria-hidden="true">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
        </div>
        <div className="suggest">
          <i>Filters</i>
          {FILTERS.map((x) => {
            const on = chips.some((c) => chipText(c) === x);
            return <button type="button" key={x} aria-pressed={on} className={on ? 'on' : ''} onClick={() => toggle(x)}>{x}</button>;
          })}
        </div>

        {hasQuery ? (
          <>
            {res && res.total > 0 && (
              <div className="tabs" role="group" aria-label="Show one kind">
                {tabs.map((k) => (
                  <button type="button" key={k} aria-pressed={activeTab === k} className={activeTab === k ? 'on' : ''} onClick={() => setTab(k)}>
                    {k === 'all' ? 'All' : KIND_TAB[k]} <span>{fmt(k === 'all' ? res.total : counts.get(k)!)}</span>
                  </button>
                ))}
              </div>
            )}
            {res && res.total > 0 && (
              <p className="summary" aria-live="polite">
                {plural(list.length, 'entry', 'entries')}. Exact names come first, then tables and subject areas, then columns.
                {!extended && ' Columns and NetSuite fields are still loading.'}
              </p>
            )}
            {res && res.total === 0 && (
              <div className="s-none" aria-live="polite">
                <p className="empty">Nothing here matches <span className="mono">{q}</span>.</p>
                {tries.length > 0 && (
                  <p className="tries"><i>Try</i>{tries.map((t) => <button type="button" key={t} onClick={() => setWhole(t)}>{t}</button>)}</p>
                )}
                <p className="tries"><i>Or filter by</i>{FILTERS.filter((x) => !chips.some((c) => chipText(c) === x)).slice(0, 4).map((x) => <button type="button" key={x} onClick={() => setWhole(x)}>{x}</button>)}</p>
              </div>
            )}
            {shown.length > 0 && m && (
              <ul className="results long" id="s-results" role="listbox" aria-label="Results">
                {shown.map((it, i) => (
                  <ResultRow key={`${it.kind}:${it.label}:${it.table ?? ''}:${i}`} m={m} cm={cm} it={it} text={parsed.text} id={`sr-${i}`} selected={i === sel} onOpen={navigate} onHover={() => setSel(i)} />
                ))}
              </ul>
            )}
            {list.length > shown.length && (
              <p className="summary">
                Showing {fmt(shown.length)} of {fmt(list.length)}.{' '}
                <button type="button" className="more" onClick={() => setShownMax((n) => n + PAGE * 2)}>Show {fmt(Math.min(PAGE * 2, list.length - shown.length))} more</button>
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="sec">Start here</h2>
            <ul className="results starts">{starts.map((e) => <StartRow key={e.name} e={e} onOpen={navigate} />)}</ul>
            <p className="examples"><i>Or try</i>{EXAMPLES.map((x) => <button type="button" key={x} onClick={() => setWhole(x)}>{x}</button>)}</p>
            <h2 className="sec">How filters read</h2>
            <dl className="filters">
              {FILTER_HELP.map(([k, v]) => (
                <div key={k}><dt><button type="button" onClick={() => setWhole(k)}>{k}</button></dt><dd>{v}</dd></div>
              ))}
            </dl>
          </>
        )}
        {error && !m && <p className="empty">The lineage files did not load. Reload the page to try again.</p>}
      </section>
      {m && <SideColumn m={m} cm={cm} />}
    </div>
  );
}

