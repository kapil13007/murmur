// File: app/crud/style_crud.js
import { StyleProfile } from '../models/index.js';
import { DEFAULT_STYLE_PROFILES, STYLE_CATEGORIES } from '../models/constants.js';

export async function ensureDefaultStyles(userId, options = {}) {
  const existing = await StyleProfile.findAll({ where: { user_id: userId }, ...options });
  const have = new Set(existing.map((p) => p.category));
  const missing = DEFAULT_STYLE_PROFILES.filter((d) => !have.has(d.category));
  if (missing.length) {
    await StyleProfile.bulkCreate(
      missing.map((d) => ({ ...d, app_names: [...d.app_names], user_id: userId })),
      options,
    );
  }
}

export async function listStyles(userId) {
  await ensureDefaultStyles(userId);
  const rows = await StyleProfile.findAll({ where: { user_id: userId } });
  return rows.sort((a, b) => STYLE_CATEGORIES.indexOf(a.category) - STYLE_CATEGORIES.indexOf(b.category));
}

export async function getStyle(userId, category) {
  await ensureDefaultStyles(userId);
  return StyleProfile.findOne({ where: { user_id: userId, category } });
}

export async function updateStyle(profile, data) {
  Object.assign(profile, data);
  await profile.save();
  return profile;
}
