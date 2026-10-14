// File: app/api/system_router.js
// Unauthenticated health/status endpoint used by the desktop app and hub to
// show whether the backend, database and speech engine are ready.
import { Router } from 'express';
import { checkConnection } from '../db/session.js';
import { asrStatus } from '../services/asr/index.js';
import { llmStatus } from '../services/llm/index.js';

const router = Router();

router.get('/health', async (req, res) => {
  let database = 'up';
  try {
    await checkConnection();
  } catch {
    database = 'down';
  }
  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'ok' : 'degraded',
    database,
    asr: asrStatus(),
    llm: llmStatus(),
    server_time: new Date().toISOString(),
  });
});

export default router;
