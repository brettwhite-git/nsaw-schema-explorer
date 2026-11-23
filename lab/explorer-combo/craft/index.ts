// Craft accents for the explorer mock-up: pen-and-ink glyphs, stitched thread and ink rules (craft.css), and a small
// watercolour plate. Importing this module also loads craft.css.
import './craft.css';
export { glyph, GLYPH_KINDS } from './glyphs';
export type { GlyphKind } from './glyphs';
export { paintPlate } from './plate';
