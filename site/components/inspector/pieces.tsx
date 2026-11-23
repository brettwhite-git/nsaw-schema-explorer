// Small pieces the inspector sidecar is built from. Each is plain markup over tokens (styles/explorer/nav.css):
//   <Figures items={[{ n, of?, label }]} />   two-column grid of key figures (serif number, UI label)
//   <MiniStar rels highlight />              a 120x84 thumbnail star: the fact in the middle, one spoke per related
//                                            table, the highlighted ones drawn darker (solid lines, no arrows)
//   <ReachBar n total />                     a thin bar: how many of `total` subject areas list the table
//   <FactDots items />                       one mark per listed fact; filled ones are drawn in the data model
//   <GoNext actions />                       the "Go next" list of links (label, small sub line, arrow)
// A visual is usually wrapped in <InspectorVisual caption> so it sits beside (or above) one short sentence.
import type { ReactNode } from 'react';
import { Link } from '../../router';
import { fmt } from '../../../explorer/data';

export interface InspectorFigure {
  /** the number (or a short preformatted string) */
  n: number | string;
  /** shown small after the number: "2 of 4" */
  of?: number;
  label: string;
}

export interface InspectorAction {
  label: string;
  /** one short line under the label */
  sub?: string;
  /** an in-app path */
  to: string;
}

export function Figures({ items }: { items: InspectorFigure[] }) {
  if (!items.length) return null;
  return (
    <dl className="ins-figs">
      {items.map((f) => (
        <div key={f.label} className="ins-f">
          <dt>{f.label}</dt>
          <dd>
            {typeof f.n === 'number' ? fmt(f.n) : f.n}
            {f.of !== undefined && <small> of {fmt(f.of)}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function InspectorVisual({ children, caption, stack }: { children: ReactNode; caption?: ReactNode; stack?: boolean }) {
  return (
    <div className={stack ? 'ins-vis stack' : 'ins-vis'}>
      {children}
      {caption && <p>{caption}</p>}
    </div>
  );
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Thumbnail star. `rels` are physicalTable indexes; `highlight` the ones drawn darker. */
export function MiniStar({ rels, highlight }: { rels: number[]; highlight?: Set<number> }) {
  const n = rels.length, R = 34, cx = 60, cy = 42;
  return (
    <svg className="ins-mini" width="120" height="84" viewBox="0 0 120 84" aria-hidden="true">
      {rels.map((t, k) => {
        const a = (k / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
        const x = r1(cx + R * 1.35 * Math.cos(a)), y = r1(cy + R * Math.sin(a));
        const on = !!highlight?.has(t);
        return (
          <g key={t}>
            <line x1={cx} y1={cy} x2={x} y2={y} className={on ? 'mi on' : 'mi'} />
            <circle cx={x} cy={y} r={on ? 2.4 : 1.6} className={on ? 'mi-d on' : 'mi-d'} />
          </g>
        );
      })}
      <rect x={cx - 9} y={cy - 6} width="18" height="12" className="mi-c" />
    </svg>
  );
}

export function ReachBar({ n, total }: { n: number; total: number }) {
  return (
    <span className="ins-bar" role="img" aria-label={`${fmt(n)} of ${fmt(total)}`}>
      <i style={{ width: `${((100 * n) / Math.max(1, total)).toFixed(1)}%` }} />
    </span>
  );
}

export function FactDots({ items }: { items: { name: string; on: boolean }[] }) {
  return (
    <span className="ins-dots" aria-hidden="true">
      {items.map((d, i) => <i key={`${d.name}-${i}`} className={d.on ? 'on' : ''} title={d.name} />)}
    </span>
  );
}

export function GoNext({ actions, title = 'Go next' }: { actions: InspectorAction[]; title?: string }) {
  if (!actions.length) return null;
  return (
    <nav className="ins-go" aria-label={title}>
      <p className="ins-k">{title}</p>
      <ul>
        {actions.map((a) => (
          <li key={a.to + a.label}>
            <Link to={a.to}>
              <span>{a.label}</span>
              {a.sub && <small>{a.sub}</small>}
              <i aria-hidden="true">→</i>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
