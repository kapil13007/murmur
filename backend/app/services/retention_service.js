// File: app/services/retention_service.js
// Background housekeeping: expires recordings after AUDIO_RETENTION_DAYS and
// enforces "Auto-delete data every 24hrs" for users who chose it.
import { Op } from 'sequelize';
import { settings } from '../core/config.js';
import { getLogger } from '../core/logger.js';
import { deleteTranscriptsOlderThan, purgeAudioOlderThan } from '../crud/transcript_crud.js';
import { CommandRun, TransformRun, UserPreference } from '../models/index.js';

const logger = getLogger('retention');
const HOUR = 3_600_000;

export async function runRetention() {
  const audioCutoff = new Date(Date.now() - settings.AUDIO_RETENTION_DAYS * 24 * HOUR);
  const purgedAudio = await purgeAudioOlderThan(audioCutoff);

  const autoDelete = await UserPreference.findAll({
    where: { data_retention: 'auto_delete_24h' },
    attributes: ['user_id'],
    raw: true,
  });
  const userIds = autoDelete.map((p) => p.user_id);
  const dayCutoff = new Date(Date.now() - 24 * HOUR);
  let purgedTranscripts = 0;
  if (userIds.length) {
    purgedTranscripts = await deleteTranscriptsOlderThan(userIds, dayCutoff);
    const where = { user_id: { [Op.in]: userIds }, created_at: { [Op.lt]: dayCutoff } };
    await TransformRun.destroy({ where });
    await CommandRun.destroy({ where });
  }
  if (purgedAudio || purgedTranscripts) {
    logger.info(`Purged ${purgedAudio} recordings and ${purgedTranscripts} transcripts`);
  }
  return { purgedAudio, purgedTranscripts };
}

export function startRetentionJob() {
  const tick = () => runRetention().catch((err) => logger.error(`Retention job failed: ${err.message}`));
  tick();
  const timer = setInterval(tick, HOUR);
  timer.unref();
  return timer;
}
