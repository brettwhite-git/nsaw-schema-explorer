// Crisp text over painted grounds. Always real SVG text, never filtered or rasterised into the plate.
import { SIGN } from './scene';

export function signOverlay(): string {
  const { cx, cy, r1, r2 } = SIGN, th = 0.46;
  const p = (r: number): string => `M ${cx - r * Math.sin(th)} ${cy - r * Math.cos(th)} A ${r} ${r} 0 0 1 ${cx + r * Math.sin(th)} ${cy - r * Math.cos(th)}`;
  return `<svg class="over" viewBox="0 0 1200 750" xmlns="http://www.w3.org/2000/svg"><defs><path id="sg1" d="${p(r1)}"/><path id="sg2" d="${p(r2)}"/></defs>
  <text font-family="'Playfair Display',serif" font-weight="600" font-size="25" letter-spacing="2.4" fill="#E9B94E" stroke="#3A1B30" stroke-width="0.5" paint-order="stroke" text-anchor="middle"><textPath href="#sg1" startOffset="50%">ALDOUS &amp; FIG</textPath></text>
  <text font-family="'Jost',sans-serif" font-weight="500" font-size="8.5" letter-spacing="3.2" fill="#E9C77A" text-anchor="middle"><textPath href="#sg2" startOffset="50%">PATISSIERS</textPath></text></svg>`;
}

export function shopOverlay(): string {
  return `<svg class="over" viewBox="0 0 1200 750" xmlns="http://www.w3.org/2000/svg">
  <text x="600" y="98" text-anchor="middle" font-family="'Playfair Display',serif" font-style="italic" font-weight="600" font-size="26" fill="#E9B94E" stroke="#3A1B30" stroke-width="0.4" paint-order="stroke">A&amp;F</text>
  <text x="600" y="590" text-anchor="middle" font-family="'Jost',sans-serif" font-weight="500" font-size="15" letter-spacing="9" fill="#E3B558">ALDOUS &amp; FIG   ·   PATISSIERS</text></svg>`;
}

export function titleOverlay(): string {
  return `<svg class="over" viewBox="0 0 1200 750" xmlns="http://www.w3.org/2000/svg">
  <text x="600" y="147" text-anchor="middle" font-family="'Playfair Display',serif" font-style="italic" font-weight="600" font-size="38" fill="#E9B94E" stroke="#3A1B30" stroke-width="0.4" paint-order="stroke">A&amp;F</text>
  <text text-anchor="middle" font-family="'Cormorant Garamond',serif" font-weight="500" fill="#3A1F36"><tspan x="600" y="262" font-size="60">How NetSuite Data Intelligence</tspan><tspan x="600" y="334" font-size="60">is put together</tspan></text>
  <text x="600" y="432" text-anchor="middle" font-family="'Cormorant Garamond',serif" font-style="italic" font-weight="500" font-size="36" fill="#5A2D4B">A story in five floors</text>
  <text x="600" y="622" text-anchor="middle" font-family="'Jost',sans-serif" font-weight="500" font-size="17" letter-spacing="7" fill="#5A2D4B" style="font-variant-caps:all-small-caps">Aldous &amp; Fig, Patissiers</text></svg>`;
}

/** the grand plate's lettering: the name arched on the plaque, a line on the door plaque, and (cutaway) floor numerals.
 *  Design coordinates are the house's (axis 600, ground 468); z/ox/oy place them as the plate's house was placed. */
export function grandOverlay(o: { z?: number; ox?: number; oy?: number; floors?: [number, number][]; night?: boolean; door?: boolean } = {}): string {
  const z = o.z ?? 1, ox = o.ox ?? 600, oy = o.oy ?? 468, cx = 600, cy = 372, r = 201, th = 0.38;
  const arcD = (rr: number): string => `M ${cx - rr * Math.sin(th)} ${cy - rr * Math.cos(th)} A ${rr} ${rr} 0 0 1 ${cx + rr * Math.sin(th)} ${cy - rr * Math.cos(th)}`;
  const floors = (o.floors ?? []).map(([y, n]) => `<g transform="translate(${ox + (520 - 600) * z} ${oy + (y - 468) * z})"><circle r="${5.2 * Math.sqrt(z)}" fill="#5A2D4B" stroke="#D6A03C" stroke-width="0.8"/><text y="${2.3 * Math.sqrt(z)}" text-anchor="middle" font-family="'Playfair Display',serif" font-weight="700" font-size="${6.6 * Math.sqrt(z)}" fill="#F2CF7A">${n}</text></g>`).join('');
  return `<svg class="over${o.night ? ' glow' : ''}" viewBox="0 0 1200 750" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${ox} ${oy}) scale(${z}) translate(-600 -468)"><defs><path id="gsg" d="${arcD(r)}"/></defs>
  <text font-family="'Playfair Display',serif" font-weight="600" font-size="15.5" letter-spacing="2.6" fill="#EBBE55" stroke="#2E1426" stroke-width="0.35" paint-order="stroke" text-anchor="middle"><textPath href="#gsg" startOffset="50%">ALDOUS &amp; FIG</textPath></text>
  ${o.door === false ? '' : `<text x="600" y="${468 - 34 - 9.4}" text-anchor="middle" font-family="'Jost',sans-serif" font-weight="500" font-size="3.9" letter-spacing="1.1" fill="#EBC46A">PATISSIERS</text>`}</g>${floors}</svg>`;
}
