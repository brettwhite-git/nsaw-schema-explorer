import { Pen } from '../../figures/scenes/objects';
import { POSES, drawPose } from './poses';
import { FIG, type FigMode } from './silhouette';

const ORDER = ['clerk', 'courier', 'stock', 'cataloguer', 'counter', 'customer'];
const ROLE_TEXT: Record<string, string> = { clerk: 'clerk', courier: 'courier', stock: 'stock-keeper', cataloguer: 'cataloguer', counter: 'counter clerk', customer: 'customer' };
const MARK: Record<string, string> = { clerk: 'eyeshade', courier: 'cap and satchel', stock: 'apron and bun', cataloguer: 'spectacles and pencil', counter: 'bow tie and waistcoat', customer: 'overcoat and hat' };
export const SHEET = { w: 1200, h: 1500 };

const withMode = <T>(m: FigMode, f: () => T): T => { const old = FIG.mode; FIG.mode = m; try { return f(); } finally { FIG.mode = old; } };

export function figureSheet(p: Pen, g: SVGGElement): void {
  const big = new URLSearchParams(location.search).get('big');
  if (big) { POSES[big].forEach((pd, k) => drawPose(p, g, big, pd, 220 + k * 360, 780, 640, false)); return; }
  p.text(g, 250, 44, 'silhouette, 130 px', { size: 14, face: 'mono', fill: 'var(--ink-2)' });
  p.text(g, 700, 44, 'contour, 100 px', { size: 14, face: 'mono', fill: 'var(--ink-2)' });
  p.text(g, 1010, 44, 'silhouette, 48 px', { size: 14, face: 'mono', fill: 'var(--ink-2)' });
  ORDER.forEach((role, i) => {
    const y = 210 + i * 190;
    p.text(g, 40, y - 60, ROLE_TEXT[role], { size: 24, weight: 600 });
    p.text(g, 40, y - 36, MARK[role], { size: 14, face: 'mono', fill: 'var(--ink-2)' });
    p.hair(g, `M40 ${y + 40}H1160`, { op: 0.25 });
    POSES[role].forEach((pd, k) => {
      withMode('solid', () => drawPose(p, g, role, pd, 250 + k * 150, y, 130, false));
      p.text(g, 250 + k * 150 + 14, y + 28, pd.name, { size: 14, face: 'mono', fill: 'var(--ink-2)', anchor: 'middle' });
      withMode('contour', () => drawPose(p, g, role, pd, 700 + k * 100, y, 100, false));
      withMode('solid', () => drawPose(p, g, role, pd, 1010 + k * 60, y, 48, false));
    });
  });
  const y = 1440;
  p.text(g, 40, y - 76, 'the earlier jointed figures, for comparison', { size: 14, face: 'mono', fill: 'var(--ink-2)' });
  ORDER.forEach((role, i) => withMode('jointed', () => drawPose(p, g, role, POSES[role][0], 250 + i * 150, y, 70, false)));
}
