// Theme: dark is the default, light the alternate. Persisted; the flash script in index.html applies it before first paint.
export type Theme = 'dark' | 'light';
const KEY = 'drawn-theme';

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function setTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t); } catch { /* private mode: the choice just is not remembered */ }
  window.dispatchEvent(new CustomEvent('drawn:theme', { detail: t }));
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
