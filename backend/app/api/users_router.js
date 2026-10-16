// File: app/api/users_router.js
import { Router } from 'express';
import { badRequest } from '../core/errors.js';
import { isValidTimeZone } from '../core/dates.js';
import { verifyPassword } from '../core/security.js';
import { validate } from '../core/validators.js';
import { getPreferences, updatePreferences } from '../crud/preference_crud.js';
import { deleteUser, updateUser } from '../crud/user_crud.js';
import { DeleteAccountRequest, GroqKeyRequest, OnboardingRequest, UpdateProfileRequest, toUserOut } from '../schemas/user_schema.js';
import { countUnread } from '../crud/notification_crud.js';
import { groqKeyStatus, removeGroqKey, saveGroqKey } from '../services/groq_key_service.js';

const router = Router();

router.get('/me', async (req, res) => {
  res.json({ user: toUserOut(req.user), groq_key: groqKeyStatus(req.user), unread_notifications: await countUnread(req.user.id) });
});

router.patch('/me', validate({ body: UpdateProfileRequest }), async (req, res) => {
  const user = await updateUser(req.user, req.body);
  res.json({ user: toUserOut(user) });
});

// Each user's own Groq key (never returned, only its last four characters).
router.get('/me/groq-key', (req, res) => res.json(groqKeyStatus(req.user)));
router.put('/me/groq-key', validate({ body: GroqKeyRequest }), async (req, res) => {
  res.json(await saveGroqKey(req.user, req.body.key));
});
router.delete('/me/groq-key', async (req, res) => res.json(await removeGroqKey(req.user)));

// Final step of the onboarding flow.
router.post('/me/onboarding', validate({ body: OnboardingRequest }), async (req, res) => {
  const { product_intent, role, writing_needs, typing_locations, selected_languages, timezone } = req.body;
  const prefs = await getPreferences(req.user.id);
  const changes = {
    user_information: { ...(prefs.user_information || {}), role: role || null, writing_needs },
    typing_locations,
  };
  if (selected_languages) changes.selected_languages = selected_languages;
  if (timezone && isValidTimeZone(timezone)) changes.timezone = timezone;
  await updatePreferences(prefs, changes);
  const user = await updateUser(req.user, {
    product_intent,
    onboarding_completed: true,
    onboarding_completed_at: new Date(),
  });
  res.json({ user: toUserOut(user) });
});

// "Restart tutorial" in Settings > System.
router.post('/me/onboarding/reset', async (req, res) => {
  const user = await updateUser(req.user, { onboarding_completed: false });
  res.json({ user: toUserOut(user) });
});

router.delete('/me', validate({ body: DeleteAccountRequest }), async (req, res) => {
  if (!(await verifyPassword(req.body.password, req.user.password_hash))) {
    throw badRequest('Password is incorrect');
  }
  await deleteUser(req.user);
  res.status(204).end();
});

export default router;
