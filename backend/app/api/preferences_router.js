// File: app/api/preferences_router.js
// Wispr's `/api/v1/user/preferences`: every setting in one object.
import { Router } from 'express';
import { badRequest, unprocessable } from '../core/errors.js';
import { isValidTimeZone } from '../core/dates.js';
import { validate } from '../core/validators.js';
import { getPreferences, updatePreferences } from '../crud/preference_crud.js';
import { UpdatePreferencesRequest, toPreferencesOut } from '../schemas/preference_schema.js';
import { publish } from '../services/realtime_service.js';

const router = Router();

router.get('', async (req, res) => {
  res.json(toPreferencesOut(await getPreferences(req.user.id)));
});

// A partial shortcut update must not collide with shortcuts already saved.
function assertNoShortcutConflicts(current, changes) {
  const merged = { ...current, ...changes };
  const seen = new Map();
  for (const [action, keys] of Object.entries(merged)) {
    if (!keys) continue;
    const id = [...keys].sort().join('+');
    if (seen.has(id)) {
      throw unprocessable(`That shortcut is already used for ${seen.get(id).replace(/_/g, ' ')}`, { code: 'shortcut_conflict' });
    }
    seen.set(id, action);
  }
}

router.patch('', validate({ body: UpdatePreferencesRequest }), async (req, res) => {
  if (req.body.timezone && !isValidTimeZone(req.body.timezone)) throw badRequest('Unknown time zone');
  const current = await getPreferences(req.user.id);
  if (req.body.shortcuts) assertNoShortcutConflicts(current.shortcuts, req.body.shortcuts);
  const prefs = await updatePreferences(current, req.body);
  const out = toPreferencesOut(prefs);
  // Lets the desktop app re-register hotkeys, switch microphone, etc.
  publish(req.user.id, 'preferences.updated', out);
  res.json(out);
});

export default router;
