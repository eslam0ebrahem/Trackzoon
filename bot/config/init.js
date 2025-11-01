// bot/config/init.js
import './env.js'; // Load .env variables
import connectDB from './db.js';
import { i18next, initI18n } from './i18n.js';

const initializeConfig = () => {
  connectDB();
  initI18n();
};

export {
  initializeConfig,
  i18next,
};
