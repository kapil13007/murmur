// File: app/db/migrator.js
// Umzug runs the files in /migrations in order and records each applied one in
// the `schema_migrations` table (the equivalent of Alembic's version table).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { BACKEND_ROOT } from '../core/config.js';
import { sequelize } from './session.js';

export function createMigrator({ logger = console } = {}) {
  const queryInterface = sequelize.getQueryInterface();
  return new Umzug({
    migrations: {
      glob: ['migrations/*.js', { cwd: BACKEND_ROOT }],
      resolve: ({ name, path: filePath, context }) => {
        const load = () => import(pathToFileURL(path.resolve(filePath)).href);
        return {
          name,
          up: async () => (await load()).up(context),
          down: async () => (await load()).down(context),
        };
      },
    },
    context: { queryInterface, Sequelize, sequelize },
    storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
    logger,
  });
}
