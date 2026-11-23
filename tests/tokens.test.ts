import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildTokensCss } from '../scripts/build-tokens.mjs';

const root = path.resolve(__dirname, '..');
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'tokens.json'), 'utf8'));
const css = buildTokensCss(tokens);

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('tokens.json -> CSS', () => {
  it('is the Paper ledger, light only', () => {
    expect(tokens.name).toBe('Paper ledger');
    expect(tokens.colorsDark).toBeUndefined();
    expect(tokens.paperTexture).toBeUndefined();
    expect(css).not.toContain('data-theme');
    expect(css).toContain('color-scheme: light;');
  });
  it('puts the paper colours on :root', () => {
    expect(css).toContain('--paper: #F6F5F0;');
    expect(css).toContain('--ink: #1B1A17;');
    expect(css).toContain('--accent: #9E2A1B;');
    for (const k of ['--surface-2', '--ink-2', '--ink-3', '--line', '--rule', '--edge', '--tint', '--accent-soft', '--serif', '--ui', '--mono', '--w-wire', '--w-selected']) {
      expect(css).toContain(k + ':');
    }
  });
  it('every text pair meets its stated minimum contrast', () => {
    for (const p of tokens.pairs) {
      const r = ratio(tokens.colors[p.fg].value, tokens.colors[p.bg].value);
      expect(r, `${p.fg} on ${p.bg}`).toBeGreaterThanOrEqual(p.min);
      expect(Math.abs(r - p.ratio), `${p.fg} on ${p.bg} stated ratio`).toBeLessThan(0.05);
    }
  });
  it('the committed generated file is up to date', () => {
    const onDisk = fs.readFileSync(path.join(root, 'styles/tokens.generated.css'), 'utf8');
    expect(onDisk).toBe(css);
  });
  it('explorer.css holds no hex colours (they live in tokens.json)', () => {
    const files = [path.join(root, 'styles/explorer.css'), ...fs.readdirSync(path.join(root, 'styles/explorer')).map((f) => path.join(root, 'styles/explorer', f))];
    for (const f of files) expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
