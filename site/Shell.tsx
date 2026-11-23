// The frame around every page: skip link, header (brand + search button), main, footer, and the palette.
// ⌘K / Ctrl-K anywhere, or "/" outside a text field, opens the palette.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from './router';
import { Palette } from './components/Palette';
import { LevelBar } from './components/LevelBar';

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

function Logo() {
  return (
    <svg className="logo" width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
      <path className="logo-ray" d="M8 8 2 3M8 8l6-5M8 8l-6 5M8 8l6 5" fill="none" />
      <circle className="logo-dot" cx="8" cy="8" r="2.5" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); return; }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div className="top-in">
          <Link to="/" className="brand" aria-label="NetSuite Data Intelligence Schema Explorer, 25R4: bus matrix">
            <Logo />
            <b><span className="brand-long">NetSuite Data Intelligence </span>Schema Explorer</b>
            <small>· 25R4</small>
          </Link>
          <button type="button" className="search-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K /">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" /></svg>
            <span className="sb-long">Search tables, fields, subject areas</span>
            <span className="sb-short">Search</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
          </button>
        </div>
      </header>
      <LevelBar />
      <main id="main" className="page">{children}</main>
      <footer className="site-foot">
        <p>
          An independent reference built from Oracle's published NetSuite Analytics Warehouse 25R4 semantic model
          lineage, entity key list and table index, the NSAW 26R4 data model diagrams, and the NetSuite data lineage
          4.0 workbook.
        </p>
      </footer>
      <Palette open={open} onClose={close} />
    </>
  );
}
