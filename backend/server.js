// File: server.js
// Process entry point: verifies the database, applies pending migrations,
// warms up the speech model and starts listening.
import { app } from './app/main.js';
import { settings } from './app/core/config.js';
import { getLogger } from './app/core/logger.js';
import { createMigrator } from './app/db/migrator.js';
import { checkConnection, sequelize } from './app/db/session.js';
import { asrStatus, warmUpAsr } from './app/services/asr/index.js';
import { llmStatus } from './app/services/llm/index.js';
import { startRetentionJob } from './app/services/retention_service.js';

const logger = getLogger('server');

async function main() {
  for (const warning of settings.warnings) logger.warn(warning);

  const version = await checkConnection().catch((err) => {
    throw new Error(`Cannot reach PostgreSQL (${err.message}). Check DATABASE_URL in backend/.env.`);
  });
  logger.info(`Connected to ${version.split(',')[0]}`);

  const migrator = createMigrator({ logger: { info() {}, warn: logger.warn, error: logger.error, debug() {} } });
  const applied = await migrator.up();
  for (const m of applied) logger.info(`Applied migration ${m.name}`);

  const asr = asrStatus();
  const llm = llmStatus();
  logger.info(`Speech-to-text: ${asr.provider} (${asr.model})`);
  logger.info(`AI formatting: ${llm.enabled ? `${llm.provider} (${llm.model})` : 'built-in rules (no LLM configured)'}`);

  warmUpAsr();
  startRetentionJob();

  const server = app.listen(settings.PORT, () => {
    logger.info(`Whisper Flow API listening on http://localhost:${settings.PORT}`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => sequelize.close().finally(() => process.exit(0)));
    // SSE streams keep connections open; don't wait on them forever.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
