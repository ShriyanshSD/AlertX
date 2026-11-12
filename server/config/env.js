import dotenv from 'dotenv';

dotenv.config();

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/resq',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  overpassUrl: process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
  cookieSecure: parseBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  demoMode: parseBoolean(process.env.DEMO_MODE, true),
  demoSimulationAutostart: parseBoolean(process.env.DEMO_SIMULATOR_AUTOSTART, false),
  demoGpsIntervalMs: Number(process.env.DEMO_GPS_INTERVAL_MS || 2000),
  locationHistoryIntervalMs: Number(process.env.LOCATION_HISTORY_INTERVAL_MS || 10000),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export function assertConfig() {
  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }
  if (config.demoGpsIntervalMs < 250 || config.locationHistoryIntervalMs < 1000) {
    throw new Error('Demo GPS intervals are below the supported minimum.');
  }
}
