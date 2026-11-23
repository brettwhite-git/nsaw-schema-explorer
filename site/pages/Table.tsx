// Route: /table/:name   ?col= selects a ledger row.
// One warehouse table, any role. Each section renders only when the files give it data.
// A _SEC table is its own page, tagged secured; nothing here relates it to another table.
import { useMemo } from 'react';
import { Link, useQuery } from '../router';
import { searchPath } from '../routes';
import { useExplorer } from '../useExplorer';
import { usePage } from '../usePage';
import { findTable, hasModel, ledgerRows, sourceCoverageSentence, tableSummary } from '../../explorer/data';
import { GrainHead, KeyTags } from '../components/table/GrainHead';
import { HeaderPartner } from '../components/table/HeaderPartner';
import { Ledger } from '../components/table/Ledger';
import { ModelFactsOf, ModelSection } from '../components/table/ModelList';
import { DimensionContext, DimensionsWithFact, SubjectAreas } from '../components/table/Around';

export function Table({ table }: { table: string }) {
  const { col } = useQuery();
  const { core: m, columns: cm, ready, error } = useExplorer({ columns: true });
  const t = m ? findTable(m, table) : undefined;
  const name = m && t !== undefined ? m.tables[t].name : table;
  usePage({ title: name, ready });

  const data = useMemo(() => {
    if (!m || !cm || t === undefined) return null;
    return { s: tableSummary(m, cm, t), ledger: ledgerRows(m, cm, t) };
  }, [m, cm, t]);

  if (!ready || !m || !cm) {
    return (
      <section className="page-h">
        <h1 className="title mono">{table}</h1>
        <p className="note">{error ? `The ontology did not load: ${error}` : 'Loading the table…'}</p>
      </section>
    );
  }
  if (t === undefined || !data) {
    return (
      <section className="page-h">
        <h1 className="title">Nothing here is called <span className="mono">{table}</span>.</h1>
        <p className="sub"><Link to={searchPath(table)} className="link">Search for {table}</Link></p>
      </section>
    );
  }

  const { s, ledger } = data;
  const h = m.grain.header.get(t);
  const keyCards = [...s.grain.map((g) => ({ entity: g.entity, cols: g.cols })), ...(h ? [{ entity: h.entity, cols: [h.col.toLowerCase()] }] : [])]
    .sort((a, b) => a.entity.localeCompare(b.entity));
  const coverage = sourceCoverageSentence(cm, t);
  // a fact with a data-model diagram: the star draws the header partner, so the band below keeps only its lines
  const star = hasModel(m, t);
  const hasPartner = (!!h && !star) || (m.grain.lines.get(t)?.length ?? 0) > 0;
  const hasSide = s.records.length > 0 || keyCards.length > 0;

  return (
    <div className="tp">
      <GrainHead m={m} s={s} ledger={ledger.summary} />

      {star && <ModelSection m={m} s={s} />}

      {(hasPartner || hasSide) && (
        <section className={hasPartner ? 'tp-band' : 'tp-band solo'}>
          {hasPartner && <div className="tp-wide"><HeaderPartner m={m} cm={cm} t={t} skipHeader={star} /></div>}
          {hasSide && (
            <div className="tp-side">
              {s.records.length > 0 && (
                <div>
                  <div className="sec-h"><h2>Loaded from NetSuite</h2></div>
                  <ul className="rows tp-recs">
                    {s.records.map((r) => (
                      <li key={r.rec}><span className="mono">{r.name}</span><span className="tp-prov"><span className="tp-mark" aria-hidden="true" />stated</span></li>
                    ))}
                  </ul>
                  {coverage && <p className="sec-p small">{coverage}</p>}
                </div>
              )}
              {keyCards.length > 0 && (
                <div>
                  <div className="sec-h"><h2>In Oracle’s key list</h2><span className="faint num">{keyCards.length}</span></div>
                  <ul className="rows tp-keys">
                    {keyCards.map((k) => (
                      <li key={k.entity}><i>{k.entity}</i><span className="tp-kcols"><KeyTags cols={k.cols} /></span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <ModelFactsOf m={m} t={t} />

      {ledger.rows.length > 0 && <Ledger m={m} cm={cm} ledger={ledger} col={col} />}

      <section className="tp-band tp-around">
        <div className="tp-wide">
          {s.fact ? <DimensionsWithFact m={m} cm={cm} s={s} /> : <DimensionContext m={m} cm={cm} s={s} />}
        </div>
        <div className="tp-side"><SubjectAreas m={m} cm={cm} s={s} /></div>
      </section>
    </div>
  );
}
