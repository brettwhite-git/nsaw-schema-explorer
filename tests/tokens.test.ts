import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildTokensCss } from '../scripts/build-tokens.mjs';

const root = path.resolve(__dirname, '..');
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'tokens.json'), 'utf8'));
const css = buildTokensCss(tokens);

describe('tokens.json -> CSS', () => {
  it('is the chosen identity with dark as the default theme', () => {
    expect(tokens.chosen).toBe('c');
    expect(tokens.defaultTheme).toBe('dark');
    expect(tokens.variants).toBeUndefined();
    expect(tokens.provisional).toBeUndefined();
  });
  it('puts the dark variables on :root (the default)', () => {
    const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf(':root[data-theme="light"]'));
    expect(rootBlock).toContain('--paper: #101F26;');
    expect(rootBlock).toContain('--ink: #D8E6EB;');
    expect(rootBlock).toContain('--accent: #F6AE4E;');
    expect(rootBlock).toContain('color-scheme: dark;');
  });
  it('puts the light variables under [data-theme="light"]', () => {
    const light = css.slice(css.indexOf(':root[data-theme="light"]'), css.indexOf(':root[data-theme="dark"]'));
    expect(light).toContain('--paper: #F6F5F0;');
    expect(light).toContain('--ink: #12303D;');
    expect(light).toContain('--accent: #A85A00;');
    expect(light).toContain('multiply');
  });
  it('generates every token colour, line weight, texture and easing', () => {
    for (const k of ['--paper-2', '--ink-2', '--pencil', '--hair', '--edge', '--tex', '--blend', '--serif', '--mono', '--w-hairline', '--w-heavy', '--ease-draw', '--thread-dash']) {
      expect(css).toContain(k + ':');
    }
    expect(css).toContain('/paper/paper-c-dark.webp');
    expect(css).toContain('/paper/paper-c-light.webp');
  });
  it('the committed generated file is up to date', () => {
    const onDisk = fs.readFileSync(path.join(root, 'styles/tokens.generated.css'), 'utf8');
    expect(onDisk).toBe(css);
  });
  it('drawn.css holds no hex colours', () => {
    const drawn = fs.readFileSync(path.join(root, 'styles/drawn.css'), 'utf8');
    expect(drawn.replace(/#fff\b/g, '')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
