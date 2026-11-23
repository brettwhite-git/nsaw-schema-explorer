// Route table, path builders and query helpers. Pure (no React, no DOM) so it is unit-tested.
//
//   /                       bus matrix            ?dim=
//   /compare/:a/:b          compare two subject areas (slugs)
//   /area/:slug             one subject area
//   /table/:name            one warehouse table   ?col=
//   /field/:record/:field   fan-out impact trace  ?at= ?sa=   (no dot in the URL: hosts treat it as a file)
//   /search                 full results          ?q=
export type Route =
  | { name: 'matrix' }
  | { name: 'compare'; a: string; b: string }
  | { name: 'area'; slug: string }
  | { name: 'table'; table: string }
  | { name: 'field'; record: string; field: string }
  | { name: 'search' }
  | { name: 'notFound'; path: string };

export type RouteName = Route['name'];

interface Pattern { name: Exclude<RouteName, 'notFound'>; pattern: string }

const PATTERNS: Pattern[] = [
  { name: 'matrix', pattern: '/' },
  { name: 'compare', pattern: '/compare/:a/:b' },
  { name: 'area', pattern: '/area/:slug' },
  { name: 'table', pattern: '/table/:table' },
  { name: 'field', pattern: '/field/:record/:field' },
  { name: 'search', pattern: '/search' },
];

function decode(s: string): string | null {
  try { return decodeURIComponent(s); } catch { return null; }
}

/** Match one pattern against a path. `:name` segments capture (percent-decoded); anything else must be equal. */
export function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) {
      const v = decode(b[i]);
      if (v === null || v === '') return null;
      params[a[i].slice(1)] = v;
    } else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** The route for a location (`pathname`, optionally with `?query` / `#hash`, which are ignored). */
export function matchRoute(pathname: string): Route {
  const path = pathname.split(/[?#]/)[0] || '/';
  for (const p of PATTERNS) {
    const params = matchPattern(p.pattern, path);
    if (params) return { name: p.name, ...params } as Route;
  }
  return { name: 'notFound', path: decode(path) ?? path };
}

// ---------------------------------------------------------------- path builders
const seg = encodeURIComponent;
type Query = Record<string, string | null | undefined>;

export const matrixPath = (q: Query = {}): string => withQuery('/', q);
export const comparePath = (a: string, b: string): string => `/compare/${seg(a)}/${seg(b)}`;
export const areaPath = (slug: string): string => `/area/${seg(slug)}`;
export const tablePath = (table: string, q: Query = {}): string => withQuery(`/table/${seg(table)}`, q);
export const fieldPath = (record: string, field: string, q: Query = {}): string => withQuery(`/field/${seg(record)}/${seg(field)}`, q);
export const searchPath = (q?: string): string => withQuery('/search', { q: q || null });

// ---------------------------------------------------------------- query
/** Parse `?a=1&b=2` (or a full location) into a plain object. Repeated keys keep the last value. */
export function parseQuery(search: string): Record<string, string> {
  const i = search.indexOf('?');
  const s = i >= 0 ? search.slice(i + 1).split('#')[0] : '';
  return Object.fromEntries(new URLSearchParams(s));
}

/** Apply a patch to the query of `href`: a string sets the key, `null`/`undefined`/'' removes it. Keys keep their order. */
export function withQuery(href: string, patch: Query): string {
  const [base, hash = ''] = href.split('#');
  const [path, qs = ''] = base.split('?');
  const p = new URLSearchParams(qs);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') p.delete(k); else p.set(k, v);
  }
  const out = p.toString().replace(/%3A/gi, ':').replace(/%2C/gi, ',');
  return path + (out ? `?${out}` : '') + (hash ? `#${hash}` : '');
}

/** Paths that are files served by the host, not routes of this app. Links to them are plain anchors. */
export function isFilePath(path: string): boolean {
  return /^\/(ontology\/|assets\/)/.test(path) || /\.[a-zA-Z0-9]+$/.test(path.split(/[?#]/)[0]);
}
