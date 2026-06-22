import { defineConfig } from 'vite';

export default defineConfig({
  // Відносні шляхи до ассетів — щоб збірка працювала і з кореня (Firebase),
  // і з підпапки (GitHub Pages: /pw.calc/), без окремих конфігів.
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: 'index.html',
    },
  },
});
