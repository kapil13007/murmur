// File: app/main.js
// Builds the Express application. server.js starts it; tests import it.
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { apiRouter } from './api/api_router.js';
import { BACKEND_ROOT, settings } from './core/config.js';
import { errorHandler, notFoundHandler } from './core/errors.js';
import { getLogger } from './core/logger.js';

const timingLogger = getLogger('api.timing');
const FRONTEND_DIST = path.resolve(BACKEND_ROOT, '..', 'frontend', 'dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Server-side duration of every request, as a header and a log line.
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    const writeHead = res.writeHead;
    res.writeHead = function patchedWriteHead(...args) {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (!res.headersSent) res.setHeader('X-Response-Time-Ms', ms.toFixed(1));
      return writeHead.apply(this, args);
    };
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (req.path.startsWith('/api/')) timingLogger.info(`${ms.toFixed(1).padStart(7)}ms ${req.method.padEnd(6)} ${req.originalUrl} ${res.statusCode}`);
    });
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          // Transcript audio is played back from blob: URLs.
          mediaSrc: ["'self'", 'blob:', 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Only the hub's own origins may call the API from a browser. Requests
  // without an Origin header (desktop app main process, curl) are allowed;
  // they still need a valid bearer token for anything private.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || settings.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      exposedHeaders: ['X-Response-Time-Ms'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1', apiRouter);
  app.use('/api', notFoundHandler);

  // Optionally serve the built hub UI so one process hosts everything.
  if (settings.SERVE_FRONTEND && fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
    app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
  } else {
    app.get('/', (req, res) => res.json({ message: 'Welcome to the Whisper Flow API', docs: '/api/v1/system/health' }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
