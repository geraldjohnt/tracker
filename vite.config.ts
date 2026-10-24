/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Multi-page build: each tracker keeps its own top-level URL (index.html,
// weight.html, spending.html) so existing GitHub Pages links and bookmarks
// keep working. `base: './'` makes every asset URL relative, so the site works
// under https://<user>.github.io/<repo>/ without hardcoding the repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        weight: resolve(__dirname, 'weight.html'),
        spending: resolve(__dirname, 'spending.html'),
      },
      output: {
        // Stable, shared vendor chunks so moving between pages reuses the browser cache.
        manualChunks(id) {
          if (/[\/]src[\/](shared|styles)[\/]|[\/]derive\.ts$/.test(id)) return 'app-shared';
          if (!id.includes('node_modules')) return;
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('chart.js')) return 'vendor-chart';
          if (id.includes('react')) return 'vendor-react';
          if (id.includes('bootstrap')) return 'vendor-bootstrap';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
