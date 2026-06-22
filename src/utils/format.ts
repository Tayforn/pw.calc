// Форматування чисел, монет, голди та екранування HTML.

const nf0 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });

export const fmt = (n: number): string =>
  Number.isFinite(n) ? nf0.format(Math.round(n)) : '—';

export const fmt2 = (n: number): string =>
  Number.isFinite(n) ? nf2.format(n) : '—';

export const fmtGold = (coins: number, goldRate: number): string => {
  if (!Number.isFinite(coins) || !goldRate) return '—';
  return nf2.format(coins / goldRate) + ' г';
};

// Юані = монети (внутрішня одиниця всіх розрахунків вартості).
export const fmtYuan = (coins: number): string => fmt(coins) + ' юані';

// Групує цифри по 3 пробілами (1000000 -> "1 000 000"); прибирає нецифри й
// провідні нулі. Для маски числових інпутів.
export const groupDigits = (str: string): string => {
  const d = String(str).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const escHtml = (s: unknown): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
