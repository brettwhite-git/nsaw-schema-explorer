// Route table and matching. Pure (no React, no DOM) so it is unit-tested.
export type Route =
  | { name: 'home' }
  | { name: 'course'; chapterId: string }
  | { name: 'atlas' }
  | { name: 'entity'; type: string; key: string }
  | { name: 'index' }
  | { name: 'notFound'; path: string };

interface Pattern { name: Exclude<Route['name'], 'notFound'>; pattern: string }

const PATTERNS: Pattern[] = [
  { name: 'home', pattern: '/' },
  { name: 'course', pattern: '/course/:chapterId' },
  { name: 'atlas', pattern: '/atlas' },
  { name: 'entity', pattern: '/atlas/:type/:key' },
  { name: 'index', pattern: '/index' },
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

export function matchRoute(pathname: string): Route {
  const path = pathname.split(/[?#]/)[0] || '/';
  for (const p of PATTERNS) {
    const params = matchPattern(p.pattern, path);
    if (params) return { name: p.name, ...params } as Route;
  }
  return { name: 'notFound', path };
}

export const atlasPath = (type: string, key: string): string => `/atlas/${type}/${encodeURIComponent(key)}`;
export const coursePath = (chapterId: string): string => `/course/${chapterId}`;

/** Paths that are files served by the host, not routes of this app. Links to them are plain anchors. */
export function isFilePath(path: string): boolean {
  return /^\/(legacy\.html|ontology\/|paper\/|fonts\/|assets\/)/.test(path) || /\.[a-zA-Z0-9]+$/.test(path.split(/[?#]/)[0]);
}
