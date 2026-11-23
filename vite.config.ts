import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One HTML entry: index.html -> site/main.tsx.
export default defineConfig({
  server: {
    port: 3001,
    strictPort: true,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
