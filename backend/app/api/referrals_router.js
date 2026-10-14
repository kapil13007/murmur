// File: app/api/referrals_router.js
import { Router } from 'express';
import { validate } from '../core/validators.js';
import { ReferralInviteRequest } from '../schemas/misc_schema.js';
import { getReferralOverview, inviteFriend } from '../services/referral_service.js';

const router = Router();

router.get('', async (req, res) => res.json(await getReferralOverview(req.user)));

router.post('/invite', validate({ body: ReferralInviteRequest }), async (req, res) => {
  await inviteFriend(req.user, req.body.email);
  res.status(201).json(await getReferralOverview(req.user));
});

export default router;
