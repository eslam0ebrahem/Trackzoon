import fs from 'fs';
import path from 'path';

const LOG_DIR = 'logs';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message, meta = {}) => {
    const logMessage = `[${getTimestamp()}] [INFO] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    console.log(logMessage);
    appendLog('app.log', logMessage);
  },
  
  error: (message, error = null, meta = {}) => {
    const errorStack = error?.stack || error?.message || error || '';
    const logMessage = `[${getTimestamp()}] [ERROR] ${message} ${errorStack} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    console.error(logMessage);
    appendLog('error.log', logMessage);
  },
  
  warn: (message, meta = {}) => {
    const logMessage = `[${getTimestamp()}] [WARN] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    console.warn(logMessage);
    appendLog('app.log', logMessage);
  },
  
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      const logMessage = `[${getTimestamp()}] [DEBUG] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      console.log(logMessage);
    }
  }
};

function appendLog(filename, message) {
  try {
    fs.appendFileSync(path.join(LOG_DIR, filename), message + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}
