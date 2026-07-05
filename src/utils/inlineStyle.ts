// Парс inline-CSS рядка (background-image/position тощо) у style-обʼєкт React.
// Спільно використовують сторінки, що показують іконки зі спрайтів (лялька, скілбаза).
export function styleFromCss(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const k = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (k) out[k] = decl.slice(i + 1).trim();
  }
  return out;
}
