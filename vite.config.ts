import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Two HTML entries: index.html is the new site (site/main.tsx), legacy.html is the old explorer (index.tsx).
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        legacy: path.resolve(__dirname, 'legacy.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
