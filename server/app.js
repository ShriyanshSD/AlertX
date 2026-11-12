import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import AppError from './utils/AppError.js';
import { config } from './config/env.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import sosRoutes from './routes/sosRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import { createDemoSimulator } from './services/demoSimulator.js';
import { createGeminiService } from './services/geminiService.js';

export function createApp({
  simulator,
  aiService,
  trustProxy = false,
  requestPathPrefix,
} = {}) {
  const app = express();
  const activeSimulator = simulator || createDemoSimulator({
    intervalMs: config.demoGpsIntervalMs,
    historyIntervalMs: config.locationHistoryIntervalMs,
  });
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  if (requestPathPrefix) {
    app.use((request, _response, next) => {
      if (request.url === `${requestPathPrefix}/api`
        || request.url.startsWith(`${requestPathPrefix}/api/`)) {
        request.url = request.url.slice(requestPathPrefix.length);
      }
      next();
    });
  }
  app.set('demoSimulator', activeSimulator);
  app.set('geminiService', aiService || createGeminiService({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  }));
  app.use(helmet());
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError(403, 'Origin is not allowed by CORS.'));
    },
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', apiRateLimit);

  app.get('/api/health', (_request, response) => {
    response.json({ data: { status: 'ok', demoMode: config.demoMode } });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/sos', sosRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
