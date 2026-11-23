// A ~60-line history-API router, in house (see report for why not wouter).
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { isFilePath, matchRoute, type Route } from './routes';

const EVENT = 'drawn:navigate';

function subscribe(cb: () => void): () => void {
  window.addEventListener('popstate', cb);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener('popstate', cb); window.removeEventListener(EVENT, cb); };
}
const snapshot = (): string => location.pathname + location.search;

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (isFilePath(to)) { location.assign(to); return; }
  if (to === snapshot()) return;
  if (opts.replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
  window.dispatchEvent(new Event(EVENT));
  if (!to.includes('#')) window.scrollTo(0, 0);
}

/** The current location, re-rendering on navigation. */
export function useLocation(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '/');
}

export function useRoute(): Route {
  return matchRoute(useLocation());
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
