// File: app/api/history_router.js
// Dictation history (Wispr's History table + `/history/*`).
import { Router } from 'express';
import { getLogger } from '../core/logger.js';
import { notFound } from '../core/errors.js';
import { uuidParam, validate } from '../core/validators.js';
import { getPreferences } from '../crud/preference_crud.js';
import {
  deleteAllTranscripts,
  deleteTranscript,
  getAudio,
  getLastTranscript,
  getTranscript,
  listTranscripts,
  updateTranscript,
} from '../crud/transcript_crud.js';
import { HistoryQuery, UpdateTranscriptRequest, toTranscriptOut } from '../schemas/history_schema.js';
import { learnFromEdit } from '../services/dictionary_service.js';
import { retryTranscript } from '../services/dictation_service.js';
import { publish } from '../services/realtime_service.js';

const router = Router();
const logger = getLogger('history');

async function requireTranscript(userId, id) {
  const transcript = await getTranscript(userId, id);
  if (!transcript) throw notFound('Transcript not found');
  return transcript;
}

router.get('', validate({ query: HistoryQuery }), async (req, res) => {
  const page = await listTranscripts(req.user.id, req.validatedQuery);
  res.json({
    items: page.items.map((t) => toTranscriptOut(t, { includeAudioFlag: true })),
    has_more: page.hasMore,
    next_before: page.nextBefore,
  });
});

// "Paste last transcript" / "Copy last transcript" shortcuts.
router.get('/last', async (req, res) => {
  const transcript = await getLastTranscript(req.user.id);
  if (!transcript) throw notFound('No dictations yet');
  res.json(toTranscriptOut(transcript));
});

router.delete('', async (req, res) => {
  const deleted = await deleteAllTranscripts(req.user.id);
  publish(req.user.id, 'transcript.cleared', {});
  res.json({ deleted });
});

router.get('/:id', validate({ params: uuidParam() }), async (req, res) => {
  res.json(toTranscriptOut(await requireTranscript(req.user.id, req.params.id), { includeAudioFlag: true }));
});

router.patch('/:id', validate({ params: uuidParam(), body: UpdateTranscriptRequest }), async (req, res) => {
  const transcript = await requireTranscript(req.user.id, req.params.id);
  const before = transcript.displayText;
  await updateTranscript(transcript, req.body);
  let learned = [];
  if (req.body.edited_text && req.body.edited_text !== before) {
    // Learn names / jargon the user had to correct by hand.
    try {
      learned = await learnFromEdit(req.user, await getPreferences(req.user.id), before, req.body.edited_text);
    } catch (err) {
      logger.warn(`Learning from edit failed: ${err.message}`);
    }
  }
  const out = toTranscriptOut(transcript, { includeAudioFlag: true });
  publish(req.user.id, 'transcript.updated', out);
  res.json({ ...out, learned_words: learned });
});

router.delete('/:id', validate({ params: uuidParam() }), async (req, res) => {
  if (!(await deleteTranscript(req.user.id, req.params.id))) throw notFound('Transcript not found');
  publish(req.user.id, 'transcript.deleted', { id: req.params.id });
  res.status(204).end();
});

router.get('/:id/audio', validate({ params: uuidParam() }), async (req, res) => {
  await requireTranscript(req.user.id, req.params.id);
  const audio = await getAudio(req.params.id);
  if (!audio) throw notFound('Audio is no longer available (recordings are kept for 14 days)');
  res.set({
    'Content-Type': audio.mime_type,
    'Content-Length': audio.size_bytes,
    'Content-Disposition': `inline; filename="dictation-${req.params.id}.wav"`,
    'Cache-Control': 'private, max-age=300',
  });
  res.end(Buffer.from(audio.data));
});

router.post('/:id/retry', validate({ params: uuidParam() }), async (req, res) => {
  const transcript = await requireTranscript(req.user.id, req.params.id);
  res.json(await retryTranscript(req.user, transcript));
});

export default router;
