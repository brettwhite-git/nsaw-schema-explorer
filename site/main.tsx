import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/source-sans-3/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '../styles/tokens.generated.css';
import '../styles/explorer.css';
import { App } from './App';
import { loadCore } from './useExplorer';

loadCore().catch(() => {}); // start fetching core.json before React mounts

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
