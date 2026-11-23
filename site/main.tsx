import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.generated.css';
import '../styles/drawn.css';
import '../figures/index';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
