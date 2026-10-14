// File: app/api/dictation_router.js
// Wispr's `/llm/asr` + `/llm/formatting` + `/llm/command_mode` endpoints.
import { Router } from 'express';
import { audioUpload } from '../core/deps.js';
import { dictationLimiter, llmLimiter } from '../core/limiter.js';
import { validate } from '../core/validators.js';
import { CommandContext, DictationContext, FormatRequest } from '../schemas/dictation_schema.js';
import { runCommand } from '../services/command_service.js';
import { formatText, processDictation } from '../services/dictation_service.js';

const router = Router();

// multipart/form-data: `audio` (WAV file) + context fields.
router.post(
  '/transcribe',
  dictationLimiter,
  audioUpload.single('audio'),
  validate({ body: DictationContext }),
  async (req, res) => {
    res.json(await processDictation(req.user, req.file, req.body));
  },
);

// Audio instruction (or `instruction` text) + optional `selected_text`.
router.post('/command', llmLimiter, audioUpload.single('audio'), validate({ body: CommandContext }), async (req, res) => {
  res.json(await runCommand(req.user, req.file, req.body));
});

// Format typed text through the same pipeline (no history, no usage).
router.post('/format', llmLimiter, validate({ body: FormatRequest }), async (req, res) => {
  res.json(await formatText(req.user, req.body));
});

export default router;
