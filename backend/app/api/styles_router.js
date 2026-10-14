// File: app/api/styles_router.js
import { Router } from 'express';
import { notFound } from '../core/errors.js';
import { validate } from '../core/validators.js';
import { getPreferences } from '../crud/preference_crud.js';
import { getStyle, listStyles, updateStyle } from '../crud/style_crud.js';
import { CategoryParam, UpdateStyleRequest, toStyleOut } from '../schemas/style_schema.js';
import { getCleanupExamples, getStyleExamples } from '../services/style_service.js';

const router = Router();

router.get('', async (req, res) => {
  const [styles, prefs] = await Promise.all([listStyles(req.user.id), getPreferences(req.user.id)]);
  res.json({
    styles: styles.map(toStyleOut),
    examples: getStyleExamples(),
    cleanup_examples: getCleanupExamples(),
    auto_cleanup_level: prefs.auto_cleanup_level,
  });
});

router.put('/:category', validate({ params: CategoryParam, body: UpdateStyleRequest }), async (req, res) => {
  const profile = await getStyle(req.user.id, req.params.category);
  if (!profile) throw notFound('Style category not found');
  res.json(toStyleOut(await updateStyle(profile, req.body)));
});

export default router;
