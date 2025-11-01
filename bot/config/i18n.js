import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initI18n = () => {
  i18next
    .use(Backend)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      backend: {
        loadPath: path.join(__dirname, '../../src/lib/locales/{{lng}}.json'),
      },
      preload: ['en', 'ar'],
    });
  console.log('i18next initialized.');
};

export { i18next, initI18n };