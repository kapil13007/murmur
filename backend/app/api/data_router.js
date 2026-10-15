// File: app/api/data_router.js
// Data and Privacy: export everything, or wipe history (Wispr's `/api/v1/data-export`).
import { Router } from 'express';
import { CommandRun, Transcript, TransformRun } from '../models/index.js';
import { exportUserData } from '../services/export_service.js';
import { publish } from '../services/realtime_service.js';

const router = Router();

router.get('/export', async (req, res) => {
  const data = await exportUserData(req.user);
  const stamp = new Date().toISOString().slice(0, 10);
  res.set('Content-Disposition', `attachment; filename="murmur-export-${stamp}.json"`);
  res.json(data);
});

// Deletes dictation, transform and command history (stats rollups are kept).
router.delete('/history', async (req, res) => {
  const where = { user_id: req.user.id };
  const [transcripts, transforms, commands] = await Promise.all([
    Transcript.destroy({ where }),
    TransformRun.destroy({ where }),
    CommandRun.destroy({ where }),
  ]);
  publish(req.user.id, 'transcript.cleared', {});
  res.json({ deleted: { transcripts, transforms, commands } });
});

export default router;
