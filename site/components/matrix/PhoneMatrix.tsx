// The matrix at phone width: two tabs. "Subject areas" groups the areas by functional area; each opens to list its
// dimensions. "Dimensions" lists every shared dimension by reach. Picking a dimension fills the panel above.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from '../../router';
import { areaPath } from '../../routes';
import { matrixRows, prettyTable, reach, type CoreModel } from '../../../explorer/data';

type Tab = 'areas' | 'dims';

export function PhoneMatrix({ m, onPickCol, dim }: { m: CoreModel; onPickCol: (c: number) => void; dim: number | null }) {
  const [tab, setTab] = useState<Tab>('areas');
  const groups = useMemo(() => matrixRows(m), [m]);
  const names = useMemo(() => m.bus.columns.map((t) => prettyTable(m, m.tables[t].name)), [m]);
  const N = m.subjectAreas.length;
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next: Tab = tab === 'areas' ? 'dims' : 'areas';
    setTab(next);
    tabs.current[next === 'areas' ? 0 : 1]?.focus();
  };
  const sorted = (cols: number[]) => cols.slice().sort((x, y) => reach(m, y) - reach(m, x) || x - y);

  return (
    <div className="mx-phone">
      <div className="mx-tabs" role="tablist" aria-label="Read the matrix by" onKeyDown={onKey}>
        <button ref={(el) => { tabs.current[0] = el; }} type="button" role="tab" id="mx-tab-areas" aria-controls="mx-panel-areas"
          aria-selected={tab === 'areas'} tabIndex={tab === 'areas' ? 0 : -1} onClick={() => setTab('areas')}>Subject areas</button>
        <button ref={(el) => { tabs.current[1] = el; }} type="button" role="tab" id="mx-tab-dims" aria-controls="mx-panel-dims"
          aria-selected={tab === 'dims'} tabIndex={tab === 'dims' ? 0 : -1} onClick={() => setTab('dims')}>Dimensions</button>
      </div>

      {tab === 'areas' ? (
        <div role="tabpanel" id="mx-panel-areas" aria-labelledby="mx-tab-areas">
          {groups.map((g) => (
            <section key={`${g.fa}-${g.rows[0].row}`} className="mx-pg">
              <h3 className="mx-pg-h">{g.name}<span>{g.rows.length} {g.rows.length === 1 ? 'area' : 'areas'}</span></h3>
              {g.rows.map((row) => (
                <details key={row.row} className="mx-pa">
                  <summary><span className="nm">{row.label}</span><span className="n">{row.dims} dims</span></summary>
                  <ul className="mx-pdims">
                    {sorted(m.bus.cells[row.row]).map((c) => (
                      <li key={c}><button type="button" onClick={() => onPickCol(c)}>{names[c]}</button></li>
                    ))}
                  </ul>
                  <Link className="linkbtn" to={areaPath(m.subjectAreas[row.sa].slug)}>Open {row.label}</Link>
                </details>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div role="tabpanel" id="mx-panel-dims" aria-labelledby="mx-tab-dims">
          <ol className="mx-pd">
            {m.bus.columns.map((_, c) => (
              <li key={c}>
                <button type="button" onClick={() => onPickCol(c)} aria-pressed={dim === c}>
                  <span className="nm">{names[c]}</span>
                  <span className="m" aria-hidden="true"><i style={{ width: `${(reach(m, c) / N) * 100}%` }} /></span>
                  <span className="n">{reach(m, c)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
