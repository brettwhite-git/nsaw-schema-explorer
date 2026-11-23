// The shared dimensions one subject area's bus-matrix row lists, most shared first, each with a reach bar
// (how many subject areas list it). The name opens the table; the bar opens the column in the bus matrix.
import { Link } from '../../router';
import { matrixPath, tablePath } from '../../routes';
import { reach } from '../../../explorer/data/matrix';
import { fmt, prettyTable } from '../../../explorer/data/names';
import type { CoreModel } from '../../../explorer/data/types';

export function AreaDims({ m, dims }: { m: CoreModel; dims: number[] }) {
  const total = m.subjectAreas.length;
  return (
    <ol className="ar-dims" style={{ gridTemplateRows: `repeat(${Math.ceil(dims.length / 2)}, auto)` }}>
      {dims.map((col, i) => {
        const name = m.tables[m.bus.columns[col]].name;
        const n = reach(m, col);
        return (
          <li key={col} className="ar-dim">
            <span className="ar-rank num">{i + 1}</span>
            <Link to={tablePath(name)} className="ar-dname" title={name}>{prettyTable(m, name)}</Link>
            <Link to={matrixPath({ dim: name })} className="ar-reach" aria-label={`${prettyTable(m, name)}: listed under ${fmt(n)} of ${fmt(total)} subject areas. Open in the bus matrix`}>
              <span className="ar-bar" aria-hidden="true"><i style={{ width: `${(100 * n) / total}%` }} /></span>
              <span className="ar-n num">{fmt(n)}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
