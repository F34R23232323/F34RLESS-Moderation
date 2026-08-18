import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4693', changeOrigin: true },
      '/ws': { target: 'ws://localhost:4693', ws: true },
      '/oauth': { target: 'http://localhost:4693', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});