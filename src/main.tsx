// =========================================================
// PW Калькулятор — точка входу React-застосунку.
// Після монтування дерева разово ініціалізуються legacy-модулі
// (див. src/app/legacyInit.ts і REACT-MIGRATION.md).
// =========================================================

import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Layout from './components/Layout';
import { initLegacyModules } from './app/legacyInit';

function App() {
  // Панелі монтуються один раз — після цього оживляємо калькулятори.
  useEffect(() => {
    initLegacyModules();
  }, []);
  return <Layout />;
}

// Без StrictMode: подвійне монтування в dev перетворює DOM панелей, а legacy-модулі
// вішають слухачі один раз (guard в initLegacyModules). Повернемо у фазі 3,
// коли сторінки стануть ідіоматичним React.
createRoot(document.getElementById('root')!).render(<App />);
