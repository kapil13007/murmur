// File: app/api/stats_router.js
// Home stat pills + Insights (Wispr's `/history/stats`).
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../core/validators.js';
import { getPreferences } from '../crud/preference_crud.js';
import { getSubscriptionSummary } from '../services/billing_service.js';
import { getHeatmap, getSummary, getTopApps } from '../services/stats_service.js';
import { getWeeklyUsage } from '../services/usage_service.js';

const router = Router();

router.get('/summary', async (req, res) => {
  const prefs = await getPreferences(req.user.id);
  res.json(await getSummary(req.user.id, prefs.timezone));
});

router.get(
  '/heatmap',
  validate({ query: z.object({ days: z.coerce.number().int().min(7).max(400).default(371) }) }),
  async (req, res) => {
    const prefs = await getPreferences(req.user.id);
    res.json(await getHeatmap(req.user.id, prefs.timezone, req.validatedQuery.days));
  },
);

router.get('/apps', async (req, res) => {
  res.json(await getTopApps(req.user.id));
});

router.get('/usage', async (req, res) => {
  const prefs = await getPreferences(req.user.id);
  const subscription = await getSubscriptionSummary(req.user.id);
  res.json(await getWeeklyUsage(req.user.id, prefs.timezone, subscription));
});

export default router;
