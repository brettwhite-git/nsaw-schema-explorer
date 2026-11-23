// Route -> page. On a path change, focus moves to the page's h1 (so screen readers announce it).
// Pages set their own document.title and body[data-ready] via usePage().
import { useEffect, useRef } from 'react';
import { Shell } from './Shell';
import { useLocation } from './router';
import { matchRoute } from './routes';
import { Matrix } from './pages/Matrix';
import { Compare } from './pages/Compare';
import { Area } from './pages/Area';
import { Table } from './pages/Table';
import { Field } from './pages/Field';
import { Search } from './pages/Search';
import { NotFound } from './pages/NotFound';

function useFocusH1OnPathChange(path: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // The new page has committed by now (effects run after commit), so its h1 is in the DOM.
    const h1 = document.querySelector<HTMLElement>('#main h1');
    if (!h1) return;
    if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  }, [path]);
}

export function App() {
  const loc = useLocation();
  const route = matchRoute(loc);
  const path = loc.split('?')[0];
  useFocusH1OnPathChange(path);

  let page;
  switch (route.name) {
    case 'matrix': page = <Matrix />; break;
    case 'compare': page = <Compare key={path} a={route.a} b={route.b} />; break;
    case 'area': page = <Area key={path} slug={route.slug} />; break;
    case 'table': page = <Table key={path} table={route.table} />; break;
    case 'field': page = <Field key={path} record={route.record} field={route.field} />; break;
    case 'search': page = <Search />; break;
    default: page = <NotFound key={path} path={route.path} />;
  }
  return <Shell>{page}</Shell>;
}
