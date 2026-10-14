// File: app/models/transcript_audio.js
// The recorded audio for a transcript (1:1), kept for AUDIO_RETENTION_DAYS so
// "Retry transcript" and "Play audio" work, then purged.
import { DataTypes, Model } from 'sequelize';

export class TranscriptAudio extends Model {}

export function initTranscriptAudio(sequelize) {
  TranscriptAudio.init(
    {
      transcript_id: { type: DataTypes.UUID, primaryKey: true },
      mime_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'audio/wav' },
      sample_rate: { type: DataTypes.INTEGER, allowNull: true },
      size_bytes: { type: DataTypes.INTEGER, allowNull: false },
      data: { type: DataTypes.BLOB, allowNull: false },
    },
    { sequelize, modelName: 'TranscriptAudio', tableName: 'transcript_audio', updatedAt: false },
  );
  return TranscriptAudio;
}
