// A small history-API router, in house. Matching and query helpers are pure, in routes.ts.
//
//   const route = useRoute();                 // { name: 'table', table: 'DW_NS_CUSTOMER_D' }
//   const { col } = useQuery();               // ?col=...
//   setQuery({ col: 'ID' }, { replace: true }); // patch the query, keep the path
//   navigate('/table/X');  <Link to="/table/X">X</Link>
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { isFilePath, matchRoute, parseQuery, withQuery, type Route } from './routes';

const EVENT = 'explorer:navigate';

function subscribe(cb: () => void): () => void {
  window.addEventListener('popstate', cb);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener('popstate', cb); window.removeEventListener(EVENT, cb); };
}
const snapshot = (): string => location.pathname + location.search;

export interface NavigateOptions {
  /** Replace the current history entry instead of pushing one (use for filters, selections, typing). */
  replace?: boolean;
  /** Keep the scroll position (default: scroll to top when the path changes). */
  keepScroll?: boolean;
}

export function navigate(to: string, opts: NavigateOptions = {}): void {
  if (isFilePath(to)) { location.assign(to); return; }
  if (to === snapshot()) return;
  const samePath = to.split(/[?#]/)[0] === location.pathname;
  if (opts.replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
  window.dispatchEvent(new Event(EVENT));
  if (!opts.keepScroll && !samePath && !to.includes('#')) window.scrollTo(0, 0);
}

/** The current location (`pathname + search`), re-rendering on navigation. */
export function useLocation(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '/');
}

export function useRoute(): Route {
  return matchRoute(useLocation());
}

/** The current query string as a plain object, re-rendering when it changes. */
export function useQuery(): Record<string, string> {
  return parseQuery(useLocation());
}

/**
 * Patch the query of the current path: a string sets a key, `null` removes it. Other keys are kept.
 * Pushes a history entry unless `{ replace: true }`; never scrolls.
 */
export function setQuery(patch: Record<string, string | null | undefined>, opts: { replace?: boolean } = {}): void {
  navigate(withQuery(snapshot(), patch), { replace: opts.replace, keepScroll: true });
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> { to: string; children: ReactNode }

/** An ordinary anchor (open in new tab, copy link, middle click all work); plain clicks stay in the app. */
export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    if (isFilePath(to) || /^https?:/.test(to)) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest}>{children}</a>;
}
