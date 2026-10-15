import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the game from https://gabcasanova.github.io/coalition/, so the production build (and
  // `npm run preview`, which serves it locally) live under /coalition/. The dev server stays at /.
  base: command === 'build' || isPreview ? '/coalition/' : '/',
  server: { port: Number(process.env.PORT) || 5173, open: false },
  // three.js alone is ~550 kB minified, so raise the warning threshold.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1000 },
}));
