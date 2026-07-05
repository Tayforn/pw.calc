// =========================================================
// Пост-білд: per-route HTML для history-роутингу і «файного СММ».
// Для кожної вкладки створює dist/<route>/index.html — копію кореневого
// index.html з унікальними <title>/description/keywords/og:*/canonical, тож
// краулери соцмереж (без JS) бачать правильні прев'ю кожної сторінки.
// Також: dist/404.html (SPA-фолбек) і — якщо доступний браузер — SSG:
// вшивання відрендереного контенту #root у per-route HTML (для індексації
// та view-source). Клієнт лишається без змін (createRoot робить свіжий рендер
// поверх), а будь-який збій SSG = graceful fallback на meta-only (білд не падає).
// =========================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync } from 'node:fs';
import { readFile as readFileP, stat as statP } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

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
    ...(route.keywords ? { 'name="keywords"': route.keywords } : {}),
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

// ============ SSG: пре-рендер контенту в HTML (headless-браузер) ============

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

/** Шлях до Chrome/Edge (env PRERENDER_CHROME або авто-детект; локально Edge, у CI google-chrome). */
function detectBrowser() {
  const env = process.env.PRERENDER_CHROME;
  if (env && existsSync(env)) return env;
  const cands = [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ];
  return cands.find((p) => existsSync(p)) || null;
}

/** Базовий шлях сайту (напр. /pw.calc/) — з переписаного vite module-скрипта. */
function detectBasePath(html) {
  const m = html.match(/<script type="module"[^>]*\ssrc="([^"]*\/)assets\//);
  return m ? m[1] : '/';
}

/** Мінімальний статик-сервер: віддає dist/ під basePath, з SPA-фолбеком. */
async function serveDist(distDir, basePath) {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (basePath !== '/') {
        if (p === basePath.slice(0, -1)) p = '/';
        else if (p.startsWith(basePath)) p = '/' + p.slice(basePath.length);
        else { res.writeHead(404); res.end(); return; }
      }
      let file = join(distDir, p);
      let st = await statP(file).catch(() => null);
      if (st && st.isDirectory()) { file = join(file, 'index.html'); st = await statP(file).catch(() => null); }
      if (!st) { file = join(distDir, 'index.html'); st = await statP(file).catch(() => null); } // SPA-фолбек
      if (!st) { res.writeHead(404); res.end(); return; }
      const ext = file.slice(file.lastIndexOf('.'));
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
      res.end(await readFileP(file));
    } catch {
      res.writeHead(500); res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

/** DOM сторінки після рендера (headless --dump-dom). */
function dumpDom(browser, url) {
  return new Promise((resolveP, rejectP) => {
    const profile = mkdtempSync(join(tmpdir(), 'ssg-'));
    const args = [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
      '--hide-scrollbars', `--user-data-dir=${profile}`, '--virtual-time-budget=7000', '--dump-dom', url,
    ];
    const ch = spawn(browser, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const timer = setTimeout(() => { ch.kill(); rejectP(new Error('timeout')); }, 35000);
    ch.stdout.on('data', (d) => (out += d));
    ch.on('error', (e) => { clearTimeout(timer); rejectP(e); });
    ch.on('close', () => { clearTimeout(timer); resolveP(out); });
  });
}

/** Внутрішній HTML #root (збалансований <div>). */
function extractRoot(html) {
  const i = html.indexOf('id="root"');
  if (i < 0) return '';
  const open = html.indexOf('>', i) + 1;
  if (open <= 0) return '';
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = open;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { if (--depth === 0) return html.slice(open, m.index); }
    else if (!m[0].endsWith('/>')) depth++;
  }
  return '';
}

/** Лишити в #root тільки панель активного роута; решту (неактивні tab-panel) —
 *  спорожнити (оболонка/сайдбар/футер лишаються). Клієнт усе одно рендерить усі
 *  панелі свіжо; це лише для чистого per-route контенту у view-source/краулерів. */
function stripInactivePanels(rootHtml, activeId) {
  const open = /<section class="tab-panel[^"]*" data-panel="([^"]+)"[^>]*>/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = open.exec(rootHtml))) {
    const id = m[1];
    const openEnd = m.index + m[0].length;
    // Кінець секції (з балансуванням вкладених <section>, якщо колись з'являться).
    const sect = /<\/?section\b[^>]*>/gi;
    sect.lastIndex = openEnd;
    let depth = 1, closeStart = -1, closeEnd = -1, sm;
    while ((sm = sect.exec(rootHtml))) {
      if (sm[0][1] === '/') { if (--depth === 0) { closeStart = sm.index; closeEnd = sm.index + sm[0].length; break; } }
      else if (!sm[0].endsWith('/>')) depth++;
    }
    if (closeStart < 0) return rootHtml; // несподівана розмітка — не чіпаємо
    out += rootHtml.slice(last, m.index);
    out += id === activeId
      ? rootHtml.slice(m.index, closeEnd) // активна панель — цілком
      : rootHtml.slice(m.index, openEnd) + rootHtml.slice(closeStart, closeEnd); // інші — порожні
    last = closeEnd;
    open.lastIndex = closeEnd;
  }
  return out + rootHtml.slice(last);
}

/** Вшити відрендерений контент у порожній <div id="root"></div> per-route файлу. */
function injectRoot(file, rootHtml) {
  const html = readFileSync(file, 'utf8');
  const out = html.replace('<div id="root"></div>', `<div id="root">${rootHtml}</div>`);
  if (out !== html) writeFileSync(file, out);
}

async function prerenderContent() {
  const browser = detectBrowser();
  if (!browser) {
    console.log('SSG: браузер не знайдено — контент не пре-рендериться (meta-only)');
    return 0;
  }
  const basePath = detectBasePath(base);
  const server = await serveDist(DIST, basePath);
  let ok = 0;
  try {
    for (const route of routes) {
      try {
        const url = `http://127.0.0.1:${server.port}${basePath}${route.id}`;
        const dom = await dumpDom(browser, url);
        const root = extractRoot(dom);
        if (root && root.replace(/\s+/g, '').length > 400) {
          injectRoot(join(DIST, route.id, 'index.html'), stripInactivePanels(root, route.id));
          ok++;
        }
      } catch (e) {
        console.warn(`  SSG ${route.id} → ${e.message}`);
      }
    }
  } finally {
    await server.close();
  }
  return ok;
}

let ssg = 0;
try {
  ssg = await prerenderContent();
} catch (e) {
  console.warn('SSG пропущено:', e.message);
}

console.log(
  `prerender: ${routes.length} сторінок${SITE_URL ? ' + sitemap' : ''} + 404.html` +
    (ssg ? ` + SSG-контент у ${ssg}` : ' (без SSG)'),
);
