// File: app/api/stats_router.js
// Home-page stat pills (Wispr's `/history/stats`).
import { Router } from 'express';
import { getPreferences } from '../crud/preference_crud.js';
import { getSummary } from '../services/stats_service.js';

const router = Router();

router.get('/summary', async (req, res) => {
  const prefs = await getPreferences(req.user.id);
  res.json(await getSummary(req.user.id, prefs.timezone));
});

export default router;
