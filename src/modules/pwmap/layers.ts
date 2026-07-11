// =========================================================
// Карта світу PW з клієнта гри (РБ «Світ» та АТН).
//
// Повна мальована карта світу: 88 тайлів по 1024 пкс (сітка 8×11,
// файли public/assets/maps/world/{ряд 00-10}{колонка 0-7}.webp,
// конвертовані з DDS-поверхонь клієнта), разом 8192×11264 пкс.
// Світ (8000×11000 пкс, 10 пкс = 1 ігрова координата) відцентрований
// у зображенні, добитому до кратності тайлів, — звідси поля 96/132 пкс
// (без них шар зсунутий на ~10/13 координат). Сітка несумісна з нашою
// (EPSG3857, 256 пкс), тому перемальовуємо тайли в нашу сітку
// canvas-адаптером (L.GridLayer).
// =========================================================

/** Перетворення координат гри PW -> latlng карти (EPSG3857). */
export function pwToLatLng(x: number, y: number): any {
  return L.CRS.EPSG3857.unproject(L.point(x, y));
}

const WM_TILE = 1024; // розмір тайла-джерела, пкс
const WM_COLS = 8;
const WM_ROWS = 11;
const WM_W = WM_COLS * WM_TILE; // ширина повної карти, пкс
const WM_H = WM_ROWS * WM_TILE; // висота повної карти, пкс
const PX_PER_COORD = 10; // пікселів карти на 1 ігрову координату
const WM_MARGIN_X = (WM_W - 8000) / 2; // 96
const WM_MARGIN_Y = (WM_H - 11000) / 2; // 132
const HALF_WORLD = 20037508.342789244; // пів світу EPSG3857, м

// Крайні тайли-джерела — темна «обкладинка» без арту з нерівномірною
// віньєткою, і контент обривається на межі тайла різко. Тому обкладинку
// НЕ рендеримо (і не вантажимо) взагалі: все за межами контенту заливаємо
// однотонним кольором, а по краях контенту домальовуємо градієнтну віньєтку.
// Контент: рядки 1–9 × колонки 1–6 (рядок 9 — острови + вшитий авторський
// фейд півдня материка, його різати не можна).
const COVER_RGB = '37,32,22'; // колір обкладинки (семпл із порожніх тайлів)
const FADE_W = 24; // ширина віньєтки, ігрових координат

function isContentTile(row: number, col: number): boolean {
  return row >= 1 && row <= 9 && col >= 1 && col <= 6;
}

// Межі контенту в ігрових координатах (межі тайлів: x 92.8–707.2, y 89.2–1010.8).
const CONTENT_X0 = 92.8;
const CONTENT_X1 = 707.2;
const CONTENT_Y0 = 89.2; // низ островів; материк — від 191.6
const CONTENT_Y1 = 1010.8;

/** Межі карти для setMaxBounds — контент з невеликим темним полем довкола. */
export function worldMaxBounds(): any {
  return L.latLngBounds(pwToLatLng(CONTENT_X0, CONTENT_Y0), pwToLatLng(CONTENT_X1, CONTENT_Y1)).pad(0.12);
}
const FADE_BANDS: { x0: number; x1: number; y0: number; y1: number; cover: 'n' | 's' | 'e' | 'w' }[] = [
  { x0: 92.8, x1: 707.2, y0: 1010.8 - FADE_W, y1: 1010.8, cover: 'n' }, // північ (сніги)
  { x0: 92.8, x1: 92.8 + FADE_W, y0: 89.2, y1: 1010.8, cover: 'w' }, // захід
  { x0: 707.2 - FADE_W, x1: 707.2, y0: 89.2, y1: 1010.8, cover: 'e' }, // схід (море)
  { x0: 92.8, x1: 707.2, y0: 89.2, y1: 89.2 + FADE_W, cover: 's' }, // південь (острови)
];

function drawEdgeFades(ctx: CanvasRenderingContext2D, gx0: number, gyTop: number, span: number, size: number): void {
  const k = size / span;
  for (const b of FADE_BANDS) {
    const ix0 = Math.max(b.x0, gx0);
    const ix1 = Math.min(b.x1, gx0 + span);
    const iy0 = Math.max(b.y0, gyTop - span);
    const iy1 = Math.min(b.y1, gyTop);
    if (ix0 >= ix1 || iy0 >= iy1) continue;
    let grad: CanvasGradient;
    if (b.cover === 'w' || b.cover === 'e') {
      const pa = (b.x0 - gx0) * k;
      const pb = (b.x1 - gx0) * k;
      grad = b.cover === 'w'
        ? ctx.createLinearGradient(pa, 0, pb, 0)
        : ctx.createLinearGradient(pb, 0, pa, 0);
    } else {
      const pTop = (gyTop - b.y1) * k;
      const pBottom = (gyTop - b.y0) * k;
      grad = b.cover === 'n'
        ? ctx.createLinearGradient(0, pTop, 0, pBottom)
        : ctx.createLinearGradient(0, pBottom, 0, pTop);
    }
    grad.addColorStop(0, 'rgba(' + COVER_RGB + ',1)');
    grad.addColorStop(1, 'rgba(' + COVER_RGB + ',0)');
    ctx.fillStyle = grad;
    ctx.fillRect((ix0 - gx0) * k, (gyTop - iy1) * k, (ix1 - ix0) * k, (iy1 - iy0) * k);
  }
}

// Кеш завантажених тайлів-джерел (ім'я файлу: «{ряд 00-10}{колонка 0-7}»).
const wmCache: Record<string, Promise<HTMLImageElement>> = {};
function loadWmTile(row: number, col: number): Promise<HTMLImageElement> {
  const key = row + '_' + col;
  if (!wmCache[key]) {
    wmCache[key] = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src =
        import.meta.env.BASE_URL + 'assets/maps/world/' + String(row).padStart(2, '0') + col + '.webp';
    });
  }
  return wmCache[key];
}

/** Базовий шар: карта світу з клієнта, перемальована в сітку EPSG3857. */
export function createPwWorldLayer(): any {
  const Layer = L.GridLayer.extend({
    createTile(coords: any, done: (err: any, tile: HTMLElement) => void): HTMLElement {
      const size = this.getTileSize().x;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;

      // Межі нашого тайла в ігрових координатах -> у пікселях карти-джерела.
      const span = (HALF_WORLD * 2) / Math.pow(2, coords.z); // ігрових одиниць у тайлі
      const gx0 = coords.x * span - HALF_WORLD;
      const gyTop = HALF_WORLD - coords.y * span;
      const sx0 = gx0 * PX_PER_COORD + WM_MARGIN_X;
      const sy0 = WM_H - WM_MARGIN_Y - gyTop * PX_PER_COORD;
      const srcSpan = span * PX_PER_COORD;
      const scale = size / srcSpan;

      const ctx = canvas.getContext('2d');
      if (!ctx) return canvas;
      // Однотонне тло скрізь — і за межами карти, і під контентом.
      ctx.fillStyle = 'rgb(' + COVER_RGB + ')';
      ctx.fillRect(0, 0, size, size);

      const c0 = Math.max(0, Math.floor(sx0 / WM_TILE));
      const c1 = Math.min(WM_COLS - 1, Math.floor((sx0 + srcSpan - 0.01) / WM_TILE));
      const r0 = Math.max(0, Math.floor(sy0 / WM_TILE));
      const r1 = Math.min(WM_ROWS - 1, Math.floor((sy0 + srcSpan - 0.01) / WM_TILE));
      let pending = 0;
      const finish = (): void => {
        drawEdgeFades(ctx, gx0, gyTop, span, size);
        done(null, canvas);
      };
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (!isContentTile(r, c)) continue; // «обкладинку» не вантажимо взагалі
          pending++;
          loadWmTile(r, c)
            .then((img) => {
              ctx.drawImage(
                img,
                (c * WM_TILE - sx0) * scale,
                (r * WM_TILE - sy0) * scale,
                WM_TILE * scale,
                WM_TILE * scale,
              );
            })
            .catch(() => {
              /* тайл не завантажився — ділянка лишиться однотонним тлом */
            })
            .finally(() => {
              if (--pending === 0) finish();
            });
        }
      }
      if (pending === 0) setTimeout(finish); // лише тло — контенту в цьому тайлі нема
      return canvas;
    },
  });
  // Без bounds: за межами контенту всі тайли — однотонне тло (без запитів).
  return new Layer({ minZoom: 0, maxZoom: 21 });
}
