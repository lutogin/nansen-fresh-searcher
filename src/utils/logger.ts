// Simple console logger - no bullshit, just works
const formatTime = (): string => {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace('T', ' ');
};

export const logger = {
  info: (message: string, obj?: any) => {
    console.log(`[${formatTime()}] INFO: ${message}`);
    if (obj) console.log(obj);
  },

  error: (message: string, obj?: any) => {
    console.error(`[${formatTime()}] ERROR: ${message}`);
    if (obj) console.error(obj);
  },

  warn: (message: string, obj?: any) => {
    console.warn(`[${formatTime()}] WARN: ${message}`);
    if (obj) console.warn(obj);
  },

  debug: (message: string, obj?: any) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${formatTime()}] DEBUG: ${message}`);
      if (obj) console.log(obj);
    }
  },
};

export default logger;
