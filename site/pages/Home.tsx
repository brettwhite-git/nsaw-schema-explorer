import { Link } from '../router';
import { CHAPTERS } from '../chapters';
import { coursePath } from '../routes';
import { Entry } from '../Entry';

export function Home() {
  return (
    <>
      <Entry />

      <header className="page-head after-entry">
        <p className="label-row">FIELD MANUAL <i /> NETSUITE ANALYTICS WAREHOUSE</p>
        <h1 className="title">The Warehouse, Drawn</h1>
        <p className="dek">A manual for data warehousing, drawn by hand and sewn from the real model. Follow one order line through it, or open any table and pull its threads.</p>
      </header>

      <section className="band" aria-labelledby="course-h">
        <div className="seam" aria-hidden="true" />
        <h2 id="course-h" className="h-label">THE COURSE <span className="h-aside">nine chapters; the first is drawn</span></h2>
        <ol className="toc">
          {CHAPTERS.map((c) => (
            <li key={c.id} className={c.drawn ? 'toc-row is-drawn' : 'toc-row'}>
              <span className="toc-num">{String(c.number).padStart(2, '0')}</span>
              <div className="toc-body">
                <h3 className="toc-title">
                  {c.drawn ? <Link to={coursePath(c.id)}>{c.title}</Link> : <span>{c.title}</span>}
                </h3>
                <p className="toc-blurb">{c.blurb}</p>
                <p className="toc-fig"><span className="mono-cap">SIGNATURE FIGURE</span> {c.figure}</p>
              </div>
              <span className="toc-state">{c.drawn ? <Link to={coursePath(c.id)} className="toc-go">read</Link> : <span className="mono-cap faint">not yet drawn</span>}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="band two" aria-labelledby="more-h">
        <div className="seam" aria-hidden="true" />
        <h2 id="more-h" className="h-label">AND TWO WAYS IN</h2>
        <div className="entries">
          <article>
            <h3 className="entry-title"><Link to="/atlas">The Atlas</Link></h3>
            <p>Every subject area, table, column and NetSuite record has a page and a URL. Each page shows its neighbours, and says how each link is known.</p>
          </article>
          <article>
            <h3 className="entry-title"><Link to="/index">The Index</Link></h3>
            <p>Search, laid out like the index at the back of a book. Not drawn yet.</p>
          </article>
        </div>
        <p className="legacy-note">Looking for the previous tool? <a href="/legacy.html">The old explorer</a> is still here, unchanged.</p>
      </section>
    </>
  );
}
