// =========================================================
// Пост-білд: per-route HTML для history-роутингу і «файного СММ».
// Для кожної вкладки створює dist/<route>/index.html — копію кореневого
// index.html з унікальними <title>/description/og:*/canonical, тож
// краулери соцмереж (без JS) бачать правильні прев'ю кожної сторінки.
// Також пише dist/404.html (SPA-фолбек для невідомих шляхів на GH Pages).
// =========================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
// Абсолютна адреса сайту для og:url/canonical (задається в CI).
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');

const routes = JSON.parse(readFileSync(join(ROOT, 'src/app/routes.meta.json'), 'utf8'));
const base = readFileSync(join(DIST, 'index.html'), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function patched(route) {
  let html = base;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(route.title)}</title>`);
  const metas = {
    'name="description"': route.description,
    'property="og:title"': route.title,
    'property="og:description"': route.description,
    'name="twitter:title"': route.title,
    'name="twitter:description"': route.description,
  };
  for (const [sel, val] of Object.entries(metas)) {
    html = html.replace(new RegExp(`(<meta ${sel} content=")[^"]*(")`), `$1${esc(val)}$2`);
  }
  if (SITE_URL) {
    const url = `${SITE_URL}/${route.id}`;
    html = html.replace(
      '</title>',
      `</title>\n  <link rel="canonical" href="${url}" />\n  <meta property="og:url" content="${url}" />`,
    );
  }
  return html;
}

for (const route of routes) {
  const dir = join(DIST, route.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), patched(route));
}
// Невідомі шляхи: GH Pages віддає 404.html → SPA відкриється на дефолтній вкладці.
writeFileSync(join(DIST, '404.html'), base);

// sitemap.xml (якщо відома адреса сайту)
if (SITE_URL) {
  const urls = routes.map((r) => `  <url><loc>${SITE_URL}/${r.id}</loc></url>`).join('\n');
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

console.log(`prerender: ${routes.length} сторінок${SITE_URL ? ' + sitemap' : ''} + 404.html`);
