// File: app/api/billing_router.js
// Plans & Billing (Wispr's `/api/v1/payment/*`). Checkout is simulated.
import { Router } from 'express';
import { validate } from '../core/validators.js';
import { getPreferences } from '../crud/preference_crud.js';
import { CheckoutRequest, toBillingEventOut } from '../schemas/billing_schema.js';
import {
  PLAN_CATALOG,
  cancelSubscription,
  checkout,
  claimStudentPlan,
  getBillingHistory,
  getSubscriptionSummary,
  resumeSubscription,
} from '../services/billing_service.js';
import { getWeeklyUsage } from '../services/usage_service.js';

const router = Router();

router.get('/plans', (req, res) => {
  res.json(PLAN_CATALOG);
});

router.get('/subscription', async (req, res) => {
  const [subscription, prefs] = await Promise.all([getSubscriptionSummary(req.user.id), getPreferences(req.user.id)]);
  const usage = await getWeeklyUsage(req.user.id, prefs.timezone, subscription);
  res.json({ subscription, usage });
});

router.get('/history', async (req, res) => {
  res.json((await getBillingHistory(req.user.id)).map(toBillingEventOut));
});

router.post('/checkout', validate({ body: CheckoutRequest }), async (req, res) => {
  res.json(await checkout(req.user.id, req.body));
});

router.post('/cancel', async (req, res) => {
  res.json(await cancelSubscription(req.user.id));
});

router.post('/resume', async (req, res) => {
  res.json(await resumeSubscription(req.user.id));
});

router.post('/student', async (req, res) => {
  res.json(await claimStudentPlan(req.user.id));
});

export default router;
