import { useEffect, useState, type ReactNode } from 'react';
import { Link, useRoute } from './router';
import { currentTheme, toggleTheme, type Theme } from './theme';
import { startStitches } from './stitches';
import { prefersReducedMotion } from '../figures/FigureFrame';

function ThemeToggle() {
  const [theme, setT] = useState<Theme>(currentTheme);
  useEffect(() => {
    const on = () => setT(currentTheme());
    window.addEventListener('drawn:theme', on);
    return () => window.removeEventListener('drawn:theme', on);
  }, []);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="btn theme-btn" onClick={() => toggleTheme()} aria-label={`Switch to the ${next} theme`} title={`Switch to the ${next} theme`}>
      {next} theme
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const route = useRoute();
  useEffect(() => startStitches(prefersReducedMotion()), []);
  const section = route.name === 'course' ? 'course' : route.name === 'atlas' || route.name === 'entity' ? 'atlas' : route.name === 'index' ? 'index' : '';
  const cur = (s: string) => (section === s ? 'page' : undefined);
  return (
    <div className="shell">
      <header className="mast">
        <Link to="/" className="mast-title" aria-current={route.name === 'home' ? 'page' : undefined}>The Warehouse, Drawn</Link>
        <nav className="mast-nav" aria-label="Sections">
          <Link to="/course/follow-one-order-line" aria-current={cur('course')}>Course</Link>
          <Link to="/atlas" aria-current={cur('atlas')}>Atlas</Link>
          <Link to="/index" aria-current={cur('index')}>Index</Link>
        </nav>
        <ThemeToggle />
      </header>
      <main className="sheet" id="main">{children}</main>
      <footer className="foot">
        <div className="seam" aria-hidden="true" />
        <span>A field manual for data warehousing and NetSuite Analytics Warehouse.</span>
        <a href="/legacy.html">the old explorer</a>
      </footer>
    </div>
  );
}
