import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, open: false },
  // three.js alone is ~550 kB minified, so raise the warning threshold.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1000 },
});
