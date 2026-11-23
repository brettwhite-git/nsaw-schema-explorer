// Any path that is not a route.
import { navigate } from '../router';
import { searchPath } from '../routes';
import { usePage } from '../usePage';

export function NotFound({ path }: { path: string }) {
  const name = path.replace(/^\/+|\/+$/g, '');
  usePage({ title: 'Not found' });
  return (
    <section className="page-h">
      <h1 className="title">Nothing here is called <span className="mono">{name || path}</span>.</h1>
      <form
        className="nf-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(searchPath(String(new FormData(e.currentTarget).get('q') ?? '').trim()));
        }}
      >
        <label className="visually-hidden" htmlFor="nf-q">Search</label>
        <input id="nf-q" name="q" type="search" defaultValue={name.split('/').pop() ?? ''} placeholder="Search tables, fields, subject areas" />
        <button type="submit" className="btn">Search</button>
      </form>
    </section>
  );
}
