import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // History-роутинг (/doll, /refine) вимагає АБСОЛЮТНОЇ бази: з відносною './'
  // ассети ламаються на вкладених шляхах. Прод (GitHub Pages) живе в підпапці
  // /pw.calc/ — база задається енв-змінною у CI; дев — корінь.
  base: command === 'build' ? process.env.VITE_BASE || '/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: 'index.html',
    },
  },
}));
