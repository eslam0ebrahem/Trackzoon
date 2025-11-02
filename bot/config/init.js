// bot/config/init.js
import './env.js'; // Load .env variables
import connectDB from './db.js';

const initializeConfig = () => {
  connectDB();
};

export {
  initializeConfig,
};
