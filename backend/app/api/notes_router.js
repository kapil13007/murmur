// File: app/api/notes_router.js
// Scratchpad notes (Wispr's `/api/v1/notes/sync`).
import { Router } from 'express';
import { llmLimiter } from '../core/limiter.js';
import { uuidParam, validate } from '../core/validators.js';
import {
  CreateNoteRequest,
  ListNotesQuery,
  TransformNoteRequest,
  UpdateNoteRequest,
  VersionParams,
} from '../schemas/note_schema.js';
import {
  addNote,
  editNote,
  getNoteDetail,
  getNotes,
  getNoteVersions,
  removeNote,
  restoreNoteVersion,
  transformNote,
} from '../services/note_service.js';

const router = Router();

router.get('', validate({ query: ListNotesQuery }), async (req, res) => {
  res.json(await getNotes(req.user.id, req.validatedQuery));
});

router.post('', validate({ body: CreateNoteRequest }), async (req, res) => {
  res.status(201).json(await addNote(req.user.id, req.body));
});

router.get('/:id', validate({ params: uuidParam() }), async (req, res) => {
  res.json(await getNoteDetail(req.user.id, req.params.id));
});

router.patch('/:id', validate({ params: uuidParam(), body: UpdateNoteRequest }), async (req, res) => {
  res.json(await editNote(req.user.id, req.params.id, req.body));
});

router.delete('/:id', validate({ params: uuidParam() }), async (req, res) => {
  await removeNote(req.user.id, req.params.id);
  res.status(204).end();
});

router.get('/:id/versions', validate({ params: uuidParam() }), async (req, res) => {
  res.json(await getNoteVersions(req.user.id, req.params.id));
});

router.post('/:id/versions/:versionId/restore', validate({ params: VersionParams }), async (req, res) => {
  res.json(await restoreNoteVersion(req.user.id, req.params.id, req.params.versionId));
});

router.post('/:id/transform', llmLimiter, validate({ params: uuidParam(), body: TransformNoteRequest }), async (req, res) => {
  res.json(await transformNote(req.user.id, req.params.id, req.body));
});

export default router;
