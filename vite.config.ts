import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The ontology JSON is served with a long cache (vercel.json). Every data URL carries a version taken from the
// files' contents, so a deploy with new data is fetched fresh instead of read from a browser's cached copy.
function dataVersion(): string {
  const h = crypto.createHash('sha256');
  for (const f of ['core.json', 'columns.json']) {
    const p = path.resolve(__dirname, 'public/ontology', f);
    if (fs.existsSync(p)) h.update(fs.readFileSync(p));
  }
  return h.digest('hex').slice(0, 10);
}
const DATA_VERSION = dataVersion();

// One HTML entry: index.html -> site/main.tsx.
export default defineConfig({
  server: {
    port: 3001,
    strictPort: true,
    host: '0.0.0.0',
  },
  define: {
    __DATA_VERSION__: JSON.stringify(DATA_VERSION),
  },
  plugins: [
    react(),
    {
      name: 'versioned-ontology-preload',
      transformIndexHtml: (html) => html.replace('href="/ontology/core.json"', `href="/ontology/core.json?v=${DATA_VERSION}"`),
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
