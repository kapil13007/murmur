// File: app/crud/transcript_crud.js
import { Op, Sequelize } from 'sequelize';
import { Transcript, TranscriptAudio } from '../models/index.js';

// Whether audio exists is computed in SQL so list queries never load the blob.
const HAS_AUDIO = [
  Sequelize.literal('EXISTS (SELECT 1 FROM transcript_audio a WHERE a.transcript_id = "Transcript"."id")'),
  'has_audio',
];

export async function listTranscripts(userId, { search, archived = false, app, before, limit = 30 }) {
  const where = { user_id: userId, is_archived: archived };
  if (app) where.app_name = app;
  if (before) where.created_at = { [Op.lt]: new Date(before) };
  if (search) {
    const pattern = `%${search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where[Op.or] = [
      { formatted_text: { [Op.iLike]: pattern } },
      { edited_text: { [Op.iLike]: pattern } },
      { asr_text: { [Op.iLike]: pattern } },
      { app_name: { [Op.iLike]: pattern } },
    ];
  }
  // Fetch one extra row to know whether another page exists.
  const rows = await Transcript.findAll({
    where,
    attributes: { include: [HAS_AUDIO] },
    order: [['created_at', 'DESC']],
    limit: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, hasMore, nextBefore: hasMore ? items[items.length - 1].created_at.toISOString() : null };
}

export function getTranscript(userId, id, options = {}) {
  return Transcript.findOne({
    where: { id, user_id: userId },
    attributes: { include: [HAS_AUDIO] },
    ...options,
  });
}

export function getLastTranscript(userId) {
  return Transcript.findOne({
    where: { user_id: userId, status: 'success', mode: { [Op.ne]: 'command' } },
    order: [['created_at', 'DESC']],
  });
}

export function createTranscript(data, options = {}) {
  return Transcript.create(data, options);
}

export async function updateTranscript(transcript, data, options = {}) {
  Object.assign(transcript, data);
  await transcript.save(options);
  return transcript;
}

export function deleteTranscript(userId, id) {
  return Transcript.destroy({ where: { id, user_id: userId } });
}

export function deleteAllTranscripts(userId) {
  return Transcript.destroy({ where: { user_id: userId } });
}

export function saveAudio(transcriptId, wavBuffer, sampleRate, options = {}) {
  return TranscriptAudio.upsert(
    {
      transcript_id: transcriptId,
      mime_type: 'audio/wav',
      sample_rate: sampleRate,
      size_bytes: wavBuffer.length,
      data: wavBuffer,
    },
    options,
  );
}

export function getAudio(transcriptId) {
  return TranscriptAudio.findByPk(transcriptId);
}

export function purgeAudioOlderThan(date) {
  return TranscriptAudio.destroy({ where: { created_at: { [Op.lt]: date } } });
}

export function deleteTranscriptsOlderThan(userIds, date) {
  if (!userIds.length) return 0;
  return Transcript.destroy({ where: { user_id: { [Op.in]: userIds }, created_at: { [Op.lt]: date } } });
}
