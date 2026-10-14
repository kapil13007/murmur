// File: app/api/sync_router.js
// Live event stream (Server-Sent Events) for open hub windows and the
// desktop app: new transcripts, preference changes, notifications.
import { Router } from 'express';
import { subscribe } from '../services/realtime_service.js';

const router = Router();

router.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const unsubscribe = subscribe(req.user.id, res);
  req.on('close', unsubscribe);
});

export default router;
