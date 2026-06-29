/// <reference types="vite/client" />
// Глобали, що їх встановлюють зовнішні data-файли (r8-data.js, gsn-data.js,
// guides-data.js) та UMD-бібліотека Leaflet. Структури складні — типізуємо
// як `any`, бо вони приходять з runtime-скриптів, а не з модулів.

export {};

declare global {
  // Спорядження Р8: items[class][piece] = { name, static_char, chars }.
  const R8_DATA: {
    classes: Array<{ code: string; ua: string; arm: string }>;
    pieces: Array<{ code: string; ua: string }>;
    items: Record<string, Record<string, any>>;
  };

  interface Window {
    R8_DATA: typeof R8_DATA;
    GSN_DATA: any;
    GSN_UNKNOWN?: string;
    PW_GUIDES: any;
    // Хук, який гайди реєструють для відкриття конкретного гайда із заголовка.
    __openGuide?: (id: string) => void;
  }

  // ГСН (Хроно біжутерія). Самозбірний об'єкт: data[item][tier] = { chars }.
  const GSN_DATA: any;
  const GSN_UNKNOWN: string | undefined;

  // Гайди спільноти.
  const PW_GUIDES: {
    categories: Array<{ id: string; name: string; emoji: string }>;
    guides: Array<{
      id: string;
      cat: string;
      title: string;
      html: string;
      updated?: string;
      images?: boolean;
    }>;
  };

  // Leaflet — UMD-глобал.
  const L: any;
}
