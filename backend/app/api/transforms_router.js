// File: app/api/transforms_router.js
// Transforms (Wispr's `/llm/polish_text` and `/api/v1/transform/*`).
import { Router } from 'express';
import { llmLimiter } from '../core/limiter.js';
import { uuidParam, validate } from '../core/validators.js';
import { listCommandRuns } from '../crud/transform_crud.js';
import { ApplyTransformRequest, CreateTransformRequest, UpdateTransformRequest } from '../schemas/transform_schema.js';
import {
  addTransform,
  applyTransform,
  editTransform,
  getTransformHistory,
  getTransforms,
  markRunUndone,
  removeTransform,
} from '../services/transform_service.js';

const router = Router();

router.get('', async (req, res) => {
  res.json(await getTransforms(req.user.id));
});

router.post('', validate({ body: CreateTransformRequest }), async (req, res) => {
  res.status(201).json(await addTransform(req.user.id, req.body));
});

router.post('/apply', llmLimiter, validate({ body: ApplyTransformRequest }), async (req, res) => {
  res.json(await applyTransform(req.user.id, req.body));
});

router.get('/history', async (req, res) => {
  res.json(await getTransformHistory(req.user.id));
});

router.post('/history/:id/undo', validate({ params: uuidParam() }), async (req, res) => {
  res.json(await markRunUndone(req.user.id, req.params.id));
});

// Command Mode history lives alongside transforms on the Transforms page.
router.get('/commands', async (req, res) => {
  const runs = await listCommandRuns(req.user.id);
  res.json(
    runs.map((r) => ({
      id: r.id,
      instruction: r.instruction,
      selected_text: r.selected_text,
      output_text: r.output_text,
      app_name: r.app_name,
      status: r.status,
      provider: r.provider,
      processing_ms: r.processing_ms,
      created_at: r.created_at,
    })),
  );
});

router.patch('/:id', validate({ params: uuidParam(), body: UpdateTransformRequest }), async (req, res) => {
  res.json(await editTransform(req.user.id, req.params.id, req.body));
});

router.delete('/:id', validate({ params: uuidParam() }), async (req, res) => {
  await removeTransform(req.user.id, req.params.id);
  res.status(204).end();
});

export default router;
